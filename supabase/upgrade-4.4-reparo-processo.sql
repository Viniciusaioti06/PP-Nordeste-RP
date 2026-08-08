-- ============================================================
-- Polícia Penal NRP — Reparo 4.4 do processo de análise
-- Seguro: não apaga inscrições nem respostas.
-- Execute UMA VEZ no SQL Editor do Supabase.
-- ============================================================

alter table public.recruitment_applications
  add column if not exists reviewer_id uuid references auth.users(id);

alter table public.recruitment_applications
  alter column automatic_score type numeric(5,2)
  using automatic_score::numeric;

alter table public.recruitment_applications
  alter column maximum_automatic_score type numeric(5,2)
  using maximum_automatic_score::numeric;

drop policy if exists applications_staff_select on public.recruitment_applications;
create policy applications_staff_select
on public.recruitment_applications
for select to authenticated
using (public.has_permission('candidates_view'));

drop policy if exists applications_staff_update on public.recruitment_applications;
create policy applications_staff_update
on public.recruitment_applications
for update to authenticated
using (public.has_permission('candidates_review'))
with check (public.has_permission('candidates_review'));

update public.profiles
set permissions =
  case role::text
    when 'admin' then '{"dashboard_view":true,"candidates_view":true,"candidates_review":true,"candidates_approve":true,"candidates_reject":true,"interviews_manage":true,"questions_view":true,"questions_manage":true,"announcements_manage":true,"settings_manage":true,"staff_manage":true,"audit_view":true,"applications_delete":true}'::jsonb
    when 'supervisor' then '{"dashboard_view":true,"candidates_view":true,"candidates_review":true,"candidates_approve":true,"candidates_reject":true,"interviews_manage":true,"questions_view":true,"questions_manage":true,"announcements_manage":true,"audit_view":true}'::jsonb
    when 'recruiter' then '{"dashboard_view":true,"candidates_view":true,"candidates_review":true,"candidates_approve":true,"candidates_reject":true,"interviews_manage":true,"questions_view":true}'::jsonb
    else '{}'::jsonb
  end || coalesce(permissions, '{}'::jsonb),
  updated_at = now()
where active = true;

create or replace function public.submit_recruitment_application(p_application jsonb)
returns public.recruitment_applications
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_result public.recruitment_applications;
  v_discord_user_id text;
  v_discord_username text;
  v_passport_normalized text;
  v_existing boolean;
begin
  if auth.uid() is null then raise exception 'DISCORD_AUTH_REQUIRED'; end if;

  select
    coalesce(i.identity_data->>'id', i.identity_data->>'sub', i.id::text),
    coalesce(i.identity_data->>'global_name', i.identity_data->>'full_name', i.identity_data->>'name', i.identity_data->>'preferred_username', i.identity_data->>'user_name', 'Usuário do Discord')
    into v_discord_user_id, v_discord_username
    from auth.identities i
   where i.user_id = auth.uid() and i.provider = 'discord'
   order by i.created_at asc limit 1;

  if nullif(trim(v_discord_user_id),'') is null then raise exception 'DISCORD_AUTH_REQUIRED'; end if;
  if not coalesce((select recruitment_open from public.recruitment_settings where id=1), false) then raise exception 'As inscrições estão fechadas'; end if;

  v_passport_normalized := lower(regexp_replace(coalesce(p_application->>'passport',''),'[^a-zA-Z0-9]','','g'));
  if length(v_passport_normalized) < 1 then raise exception 'Passaporte inválido'; end if;

  select exists(select 1 from public.candidate_identities ci where ci.auth_user_id=auth.uid() or ci.discord_user_id=v_discord_user_id) into v_existing;
  if v_existing or exists(select 1 from public.recruitment_applications a where a.user_id=auth.uid()) then raise exception 'DISCORD_ALREADY_USED'; end if;

  if exists(select 1 from public.candidate_identities ci where ci.passport_normalized=v_passport_normalized)
     or exists(select 1 from public.recruitment_applications a where lower(regexp_replace(a.passport,'[^a-zA-Z0-9]','','g'))=v_passport_normalized) then
    raise exception 'PASSPORT_ALREADY_USED';
  end if;

  insert into public.recruitment_applications(
    user_id,protocol,character_name,passport,discord,character_age,city_time,availability,experience,
    answers,automatic_score,manual_score,maximum_automatic_score,status,public_note,reviewer_notes,
    physical_recruiter,eliminatory_triggered,question_snapshot,timeline
  ) values (
    auth.uid(),p_application->>'protocol',trim(p_application->>'character_name'),trim(p_application->>'passport'),v_discord_username,
    nullif(p_application->>'character_age','')::integer,p_application->>'city_time',p_application->>'availability',p_application->>'experience',
    coalesce(p_application->'answers','{}'::jsonb),coalesce((p_application->>'automatic_score')::numeric,0),
    nullif(p_application->>'manual_score','')::numeric,coalesce((p_application->>'maximum_automatic_score')::numeric,0),
    coalesce(p_application->>'status','Em análise'),coalesce(p_application->>'public_note',''),coalesce(p_application->>'reviewer_notes',''),
    coalesce(p_application->>'physical_recruiter',''),coalesce((p_application->>'eliminatory_triggered')::boolean,false),
    coalesce(p_application->'question_snapshot','[]'::jsonb),coalesce(p_application->'timeline','[]'::jsonb)
  ) returning * into v_result;

  begin
    insert into public.candidate_identities(auth_user_id,discord_user_id,discord_username,passport_normalized,application_id)
    values(auth.uid(),v_discord_user_id,v_discord_username,v_passport_normalized,v_result.id);
  exception when unique_violation then
    if exists(select 1 from public.candidate_identities where auth_user_id=auth.uid() or discord_user_id=v_discord_user_id) then
      raise exception 'DISCORD_ALREADY_USED';
    end if;
    raise exception 'PASSPORT_ALREADY_USED';
  end;

  return v_result;
end;
$$;

revoke all on function public.submit_recruitment_application(jsonb) from public;
grant execute on function public.submit_recruitment_application(jsonb) to authenticated;
