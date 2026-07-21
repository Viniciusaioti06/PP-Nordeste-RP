-- ============================================================
-- Polícia Penal — Upgrade 2.0.6
-- Manutenção: exclusão segura de todas as inscrições
-- Execute uma vez no SQL Editor do Supabase.
-- ============================================================

create or replace function public.delete_all_recruitment_applications()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
  v_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado';
  end if;

  select *
    into v_profile
    from public.profiles
   where id = auth.uid()
     and active = true;

  if v_profile.id is null then
    raise exception 'Perfil interno ativo não encontrado';
  end if;

  if not coalesce((v_profile.permissions->>'settings_manage')::boolean, false)
     and not coalesce((v_profile.permissions->>'applications_delete')::boolean, false) then
    raise exception 'Você não possui permissão para excluir todas as inscrições';
  end if;

  select count(*)::integer
    into v_count
    from public.recruitment_applications;

  delete from public.recruitment_applications;

  insert into public.audit_logs (
    actor_id,
    actor_name,
    actor_role,
    action,
    resource_type,
    resource_id,
    old_data,
    new_data
  )
  values (
    v_profile.id,
    coalesce(nullif(v_profile.display_name,''),v_profile.email,'Usuário'),
    v_profile.role::text,
    'applications_cleared',
    'application',
    'all',
    jsonb_build_object('deleted_count',v_count),
    null
  );

  return v_count;
end;
$$;

revoke all on function public.delete_all_recruitment_applications() from public;
grant execute on function public.delete_all_recruitment_applications() to authenticated;
