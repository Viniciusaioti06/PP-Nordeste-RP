-- ============================================================
-- Polícia Penal NRP — Discord OAuth + prevenção de duplicidade
-- Execute este arquivo uma vez no SQL Editor do Supabase.
-- ============================================================

-- Registro permanente das identidades utilizadas em inscrições.
create table if not exists public.candidate_identities (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete restrict,
  discord_user_id text not null unique,
  discord_username text not null,
  passport_normalized text not null unique,
  application_id uuid unique references public.recruitment_applications(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.candidate_identities enable row level security;

-- Candidatos autenticados pelo Discord não recebem perfil interno de recrutador.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.raw_app_meta_data->>'provider','') = 'discord' then
    return new;
  end if;

  insert into public.profiles(
    id,display_name,username,email,discord,role,active,permissions
  )
  values(
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name',''),
    new.raw_user_meta_data->>'username',
    new.email,
    new.raw_user_meta_data->>'discord',
    'recruiter',
    true,
    '{}'::jsonb
  )
  on conflict(id) do nothing;

  return new;
end;
$$;

-- Retorna se a conta autenticada já possui inscrição.
create or replace function public.candidate_registration_status()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_application public.recruitment_applications;
begin
  if auth.uid() is null then
    return jsonb_build_object('has_application',false);
  end if;

  select a.*
    into v_application
    from public.recruitment_applications a
   where a.user_id = auth.uid()
   order by a.created_at desc
   limit 1;

  if v_application.id is null then
    return jsonb_build_object('has_application',false);
  end if;

  return jsonb_build_object(
    'has_application',true,
    'protocol',v_application.protocol,
    'passport',v_application.passport,
    'status',v_application.status
  );
end;
$$;

revoke all on function public.candidate_registration_status() from public;
grant execute on function public.candidate_registration_status() to authenticated;

-- Submissão segura: exige identidade Discord e bloqueia conta/passaporte repetidos.
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
  if auth.uid() is null then
    raise exception 'DISCORD_AUTH_REQUIRED';
  end if;

  select
    coalesce(
      i.identity_data->>'id',
      i.identity_data->>'sub',
      i.id::text
    ),
    coalesce(
      i.identity_data->>'global_name',
      i.identity_data->>'full_name',
      i.identity_data->>'name',
      i.identity_data->>'preferred_username',
      i.identity_data->>'user_name',
      'Usuário do Discord'
    )
    into v_discord_user_id, v_discord_username
    from auth.identities i
   where i.user_id = auth.uid()
     and i.provider = 'discord'
   order by i.created_at asc
   limit 1;

  if nullif(trim(v_discord_user_id),'') is null then
    raise exception 'DISCORD_AUTH_REQUIRED';
  end if;

  if not coalesce(
    (select recruitment_open from public.recruitment_settings where id=1),
    false
  ) then
    raise exception 'As inscrições estão fechadas';
  end if;

  v_passport_normalized := lower(
    regexp_replace(coalesce(p_application->>'passport',''),'[^a-zA-Z0-9]','','g')
  );

  if length(v_passport_normalized) < 1 then
    raise exception 'Passaporte inválido';
  end if;

  select exists(
    select 1
      from public.candidate_identities ci
     where ci.auth_user_id = auth.uid()
        or ci.discord_user_id = v_discord_user_id
  )
  into v_existing;

  if v_existing or exists(
    select 1
      from public.recruitment_applications a
     where a.user_id = auth.uid()
  ) then
    raise exception 'DISCORD_ALREADY_USED';
  end if;

  if exists(
    select 1
      from public.candidate_identities ci
     where ci.passport_normalized = v_passport_normalized
  ) or exists(
    select 1
      from public.recruitment_applications a
     where lower(regexp_replace(a.passport,'[^a-zA-Z0-9]','','g')) = v_passport_normalized
  ) then
    raise exception 'PASSPORT_ALREADY_USED';
  end if;

  insert into public.recruitment_applications(
    user_id,
    protocol,
    character_name,
    passport,
    discord,
    character_age,
    city_time,
    availability,
    experience,
    answers,
    automatic_score,
    manual_score,
    maximum_automatic_score,
    status,
    public_note,
    reviewer_notes,
    physical_recruiter,
    eliminatory_triggered,
    question_snapshot,
    timeline
  )
  values(
    auth.uid(),
    p_application->>'protocol',
    trim(p_application->>'character_name'),
    trim(p_application->>'passport'),
    v_discord_username,
    nullif(p_application->>'character_age','')::integer,
    p_application->>'city_time',
    p_application->>'availability',
    p_application->>'experience',
    coalesce(p_application->'answers','{}'::jsonb),
    coalesce((p_application->>'automatic_score')::integer,0),
    nullif(p_application->>'manual_score','')::integer,
    coalesce((p_application->>'maximum_automatic_score')::integer,0),
    p_application->>'status',
    coalesce(p_application->>'public_note',''),
    coalesce(p_application->>'reviewer_notes',''),
    coalesce(p_application->>'physical_recruiter',''),
    coalesce((p_application->>'eliminatory_triggered')::boolean,false),
    coalesce(p_application->'question_snapshot','[]'::jsonb),
    coalesce(p_application->'timeline','[]'::jsonb)
  )
  returning * into v_result;

  begin
    insert into public.candidate_identities(
      auth_user_id,
      discord_user_id,
      discord_username,
      passport_normalized,
      application_id
    )
    values(
      auth.uid(),
      v_discord_user_id,
      v_discord_username,
      v_passport_normalized,
      v_result.id
    );
  exception
    when unique_violation then
      if exists(
        select 1 from public.candidate_identities
         where auth_user_id=auth.uid()
            or discord_user_id=v_discord_user_id
      ) then
        raise exception 'DISCORD_ALREADY_USED';
      end if;
      raise exception 'PASSPORT_ALREADY_USED';
  end;

  return v_result;
end;
$$;

revoke all on function public.submit_recruitment_application(jsonb) from public;
grant execute on function public.submit_recruitment_application(jsonb) to authenticated;

create index if not exists candidate_identities_created_at_idx
  on public.candidate_identities(created_at desc);
