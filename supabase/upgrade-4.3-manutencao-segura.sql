-- ============================================================
-- Polícia Penal NRP — Manutenção segura 4.3
-- Execute este arquivo UMA VEZ no SQL Editor do Supabase.
--
-- A função abaixo:
--   1. remove os vínculos antifraude;
--   2. remove todas as inscrições;
--   3. registra a operação na auditoria;
-- tudo dentro da mesma transação.
-- ============================================================

create or replace function public.admin_clear_recruitment_data(
  p_actor_id uuid,
  p_actor_name text,
  p_actor_role text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_application_count integer := 0;
  v_identity_count integer := 0;
begin
  select count(*)::integer
    into v_application_count
    from public.recruitment_applications;

  -- A tabela pode não existir em instalações antigas.
  if to_regclass('public.candidate_identities') is not null then
    execute 'select count(*)::integer from public.candidate_identities'
      into v_identity_count;

    execute 'delete from public.candidate_identities where id is not null';
  end if;

  delete from public.recruitment_applications
   where id is not null;

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
    p_actor_id,
    coalesce(nullif(trim(p_actor_name), ''), 'Administrador'),
    coalesce(nullif(trim(p_actor_role), ''), 'admin'),
    'applications_cleared',
    'recruitment_maintenance',
    'all',
    jsonb_build_object(
      'deleted_applications', v_application_count,
      'deleted_identities', v_identity_count
    ),
    jsonb_build_object(
      'remaining_applications', 0,
      'remaining_identities', 0
    )
  );

  return jsonb_build_object(
    'deleted_applications', v_application_count,
    'deleted_identities', v_identity_count
  );
end;
$$;

revoke all on function public.admin_clear_recruitment_data(uuid,text,text)
  from public, anon, authenticated;

grant execute on function public.admin_clear_recruitment_data(uuid,text,text)
  to service_role;

-- A função RPC antiga deixa de ser acessível pelo navegador.
revoke all on function public.delete_all_recruitment_applications()
  from public, anon, authenticated;
