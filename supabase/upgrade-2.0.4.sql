-- ============================================================
-- Polícia Penal — Upgrade 2.0.4
-- Último acesso + auditoria confiável
-- Execute uma vez no SQL Editor do Supabase.
-- ============================================================

create or replace function public.register_staff_login()
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado';
  end if;

  update public.profiles
     set last_login = v_now,
         updated_at = v_now
   where id = auth.uid()
     and active = true;

  if not found then
    raise exception 'Perfil interno ativo não encontrado';
  end if;

  return v_now;
end;
$$;

revoke all on function public.register_staff_login() from public;
grant execute on function public.register_staff_login() to authenticated;

create or replace function public.write_audit_event(
  p_action text,
  p_resource_type text,
  p_resource_id text default null,
  p_old_data jsonb default null,
  p_new_data jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
  v_id uuid;
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
    coalesce(nullif(v_profile.display_name,''), v_profile.email, 'Usuário'),
    v_profile.role::text,
    left(coalesce(nullif(trim(p_action),''),'unknown'),120),
    left(coalesce(nullif(trim(p_resource_type),''),'unknown'),120),
    p_resource_id,
    p_old_data,
    p_new_data
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.write_audit_event(text,text,text,jsonb,jsonb) from public;
grant execute on function public.write_audit_event(text,text,text,jsonb,jsonb) to authenticated;

-- Mantém a leitura restrita a quem possui permissão de auditoria.
drop policy if exists audit_read on public.audit_logs;
create policy audit_read on public.audit_logs
for select to authenticated
using(public.has_permission('audit_view'));

-- A gravação passa a ocorrer pela função write_audit_event.
drop policy if exists audit_insert on public.audit_logs;

-- Índices para ordenar e pesquisar com mais eficiência.
create index if not exists profiles_last_login_idx
  on public.profiles(last_login desc nulls last);

create index if not exists audit_logs_created_at_idx
  on public.audit_logs(created_at desc);

create index if not exists audit_logs_actor_name_idx
  on public.audit_logs(lower(actor_name));

create index if not exists audit_logs_action_idx
  on public.audit_logs(action);
