
-- ============================================================
-- POLÍCIA PENAL CEARÁ — RELEASE 1.1
-- Execute este arquivo inteiro no SQL Editor do Supabase.
-- ============================================================

create extension if not exists pgcrypto;

do $$ begin
  create type public.staff_role as enum ('recruiter','supervisor','admin');
exception when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  username text unique,
  email text,
  discord text,
  role public.staff_role not null default 'recruiter',
  active boolean not null default true,
  permissions jsonb not null default '{}'::jsonb,
  last_login timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recruitment_settings (
  id integer primary key default 1 check (id=1),
  recruitment_open boolean not null default true,
  minimum_score integer not null default 4,
  retry_days integer not null default 7,
  show_public_reason boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.recruitment_settings(id) values(1) on conflict(id) do nothing;

create table if not exists public.recruitment_questions (
  id text primary key,
  title text not null,
  description text not null default '',
  category text not null default 'Geral',
  question_type text not null check(question_type in ('objective','eliminatory','open')),
  required boolean not null default true,
  active boolean not null default true,
  order_position integer not null default 1,
  points integer not null default 0,
  options jsonb not null default '[]'::jsonb,
  correct_option text,
  eliminatory_options jsonb not null default '[]'::jsonb,
  min_length integer not null default 0,
  manual_criteria text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recruitment_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  protocol text unique not null,
  character_name text not null,
  passport text not null,
  discord text not null,
  character_age integer,
  city_time text,
  availability text,
  experience text,
  answers jsonb not null default '{}'::jsonb,
  automatic_score integer not null default 0,
  manual_score integer,
  maximum_automatic_score integer not null default 0,
  status text not null default 'Em análise',
  public_note text not null default '',
  reviewer_notes text not null default '',
  reviewer_id uuid references auth.users(id),
  physical_recruiter text not null default '',
  eliminatory_triggered boolean not null default false,
  question_snapshot jsonb not null default '[]'::jsonb,
  timeline jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists recruitment_applications_status_idx on public.recruitment_applications(status);
create index if not exists recruitment_applications_passport_idx on public.recruitment_applications(passport);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  audience_status text not null,
  active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  actor_name text not null default 'Sistema',
  actor_role text not null default 'system',
  action text not null,
  resource_type text not null,
  resource_id text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

-- Funções auxiliares
create or replace function public.current_profile()
returns public.profiles
language sql stable security definer set search_path=public
as $$ select * from public.profiles where id=auth.uid() $$;

create or replace function public.has_permission(p_permission text)
returns boolean
language sql stable security definer set search_path=public
as $$
  select coalesce((select active and coalesce((permissions->>p_permission)::boolean,false)
                   from public.profiles where id=auth.uid()),false)
$$;

create or replace function public.needs_initial_admin()
returns boolean
language sql stable security definer set search_path=public
as $$ select not exists(select 1 from public.profiles where role='admin') $$;
grant execute on function public.needs_initial_admin() to anon, authenticated;

create or replace function public.bootstrap_first_admin(
  p_display_name text,p_username text,p_discord text
) returns boolean
language plpgsql security definer set search_path=public
as $$
begin
  if auth.uid() is null then raise exception 'Autenticação necessária'; end if;
  if exists(select 1 from public.profiles where role='admin') then raise exception 'Administrador inicial já existe'; end if;
  insert into public.profiles(id,display_name,username,email,discord,role,active,permissions)
  select auth.uid(),p_display_name,p_username,email,p_discord,'admin',true,
  '{"dashboard_view":true,"candidates_view":true,"candidates_review":true,"candidates_approve":true,"candidates_reject":true,"interviews_manage":true,"questions_view":true,"questions_manage":true,"settings_manage":true,"staff_manage":true,"audit_view":true,"applications_delete":true,"announcements_manage":true}'::jsonb
  from auth.users where id=auth.uid()
  on conflict(id) do update set display_name=excluded.display_name,username=excluded.username,
  email=excluded.email,discord=excluded.discord,role='admin',active=true,permissions=excluded.permissions;
  return true;
end $$;
grant execute on function public.bootstrap_first_admin(text,text,text) to authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
  insert into public.profiles(id,display_name,username,email,discord,role,active,permissions)
  values(new.id,coalesce(new.raw_user_meta_data->>'display_name',''),
         new.raw_user_meta_data->>'username',new.email,new.raw_user_meta_data->>'discord',
         'recruiter',true,'{}'::jsonb)
  on conflict(id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.submit_recruitment_application(p_application jsonb)
returns public.recruitment_applications
language plpgsql security definer set search_path=public
as $$
declare result public.recruitment_applications;
begin
  if not (select recruitment_open from public.recruitment_settings where id=1) then
    raise exception 'As inscrições estão fechadas';
  end if;
  insert into public.recruitment_applications(
    protocol,character_name,passport,discord,character_age,city_time,availability,experience,
    answers,automatic_score,manual_score,maximum_automatic_score,status,public_note,
    reviewer_notes,physical_recruiter,eliminatory_triggered,question_snapshot,timeline
  ) values(
    p_application->>'protocol',p_application->>'character_name',p_application->>'passport',
    p_application->>'discord',nullif(p_application->>'character_age','')::integer,
    p_application->>'city_time',p_application->>'availability',p_application->>'experience',
    coalesce(p_application->'answers','{}'::jsonb),
    coalesce((p_application->>'automatic_score')::integer,0),
    nullif(p_application->>'manual_score','')::integer,
    coalesce((p_application->>'maximum_automatic_score')::integer,0),
    p_application->>'status',coalesce(p_application->>'public_note',''),
    coalesce(p_application->>'reviewer_notes',''),coalesce(p_application->>'physical_recruiter',''),
    coalesce((p_application->>'eliminatory_triggered')::boolean,false),
    coalesce(p_application->'question_snapshot','[]'::jsonb),
    coalesce(p_application->'timeline','[]'::jsonb)
  ) returning * into result;
  return result;
end $$;
grant execute on function public.submit_recruitment_application(jsonb) to anon, authenticated;

create or replace function public.lookup_recruitment_application(p_protocol text,p_passport text)
returns public.recruitment_applications
language sql security definer set search_path=public
as $$
  select * from public.recruitment_applications
  where lower(protocol)=lower(trim(p_protocol)) and passport=trim(p_passport)
  limit 1
$$;
grant execute on function public.lookup_recruitment_application(text,text) to anon, authenticated;

create or replace function public.public_announcements_for_status(p_status text)
returns table(id uuid,title text,message text,audience_status text,created_at timestamptz)
language sql security definer set search_path=public
as $$
  select id,title,message,audience_status,created_at
  from public.announcements
  where active=true and (audience_status=p_status or audience_status='Todos')
  order by created_at desc
$$;
grant execute on function public.public_announcements_for_status(text) to anon,authenticated;

-- RLS
alter table public.profiles enable row level security;
alter table public.recruitment_settings enable row level security;
alter table public.recruitment_questions enable row level security;
alter table public.recruitment_applications enable row level security;
alter table public.announcements enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select on public.profiles for select to authenticated
using(id=auth.uid() or public.has_permission('staff_manage'));

drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles for update to authenticated
using(public.has_permission('staff_manage')) with check(public.has_permission('staff_manage'));

drop policy if exists public_active_questions on public.recruitment_questions;
create policy public_active_questions on public.recruitment_questions for select to anon,authenticated
using(active=true or public.has_permission('questions_view'));

drop policy if exists questions_manage on public.recruitment_questions;
create policy questions_manage on public.recruitment_questions for all to authenticated
using(public.has_permission('questions_manage')) with check(public.has_permission('questions_manage'));

drop policy if exists settings_public_read on public.recruitment_settings;
create policy settings_public_read on public.recruitment_settings for select to anon,authenticated using(true);

drop policy if exists settings_manage on public.recruitment_settings;
create policy settings_manage on public.recruitment_settings for update to authenticated
using(public.has_permission('settings_manage')) with check(public.has_permission('settings_manage'));

drop policy if exists applications_staff_select on public.recruitment_applications;
create policy applications_staff_select on public.recruitment_applications for select to authenticated
using(public.has_permission('candidates_view'));

drop policy if exists applications_staff_update on public.recruitment_applications;
create policy applications_staff_update on public.recruitment_applications for update to authenticated
using(public.has_permission('candidates_review')) with check(public.has_permission('candidates_review'));

drop policy if exists announcements_staff_read on public.announcements;
create policy announcements_staff_read on public.announcements for select to authenticated
using(public.has_permission('announcements_manage') or public.has_permission('interviews_manage'));

drop policy if exists announcements_manage on public.announcements;
create policy announcements_manage on public.announcements for all to authenticated
using(public.has_permission('announcements_manage')) with check(public.has_permission('announcements_manage'));

drop policy if exists audit_read on public.audit_logs;
create policy audit_read on public.audit_logs for select to authenticated
using(public.has_permission('audit_view'));

drop policy if exists audit_insert on public.audit_logs;
create policy audit_insert on public.audit_logs for insert to authenticated
with check(actor_id=auth.uid());

-- Dados iniciais do questionário
insert into public.recruitment_questions
(id,title,description,category,question_type,required,active,order_position,points,options,correct_option,eliminatory_options,min_length,manual_criteria)
values
('provocation','Um detento começa a provocar verbalmente um agente. Como você reage?','Avalia postura e respeito aos procedimentos.','Conduta','objective',true,true,1,3,
'[{"id":"p1","label":"Mantenho a postura e sigo o procedimento adequado.","points":3},{"id":"p2","label":"Respondo no mesmo tom para impor respeito.","points":1},{"id":"p3","label":"Uso força imediatamente.","points":0}]','p1','[]',0,''),
('hierarchy','Você recebe uma ordem que considera equivocada, mas que não viola nenhuma regra.','Avalia respeito à hierarquia.','Hierarquia','objective',true,true,2,3,
'[{"id":"h1","label":"Cumpro e depois converso pelo canal correto.","points":3},{"id":"h2","label":"Discuto publicamente com o superior.","points":1},{"id":"h3","label":"Ignoro e faço do meu jeito.","points":0}]','h1','[]',0,''),
('corruption','Você aceitaria dinheiro ou favores para facilitar a fuga de um preso?','Critério eliminatório de ética.','Ética','eliminatory',true,true,3,0,
'[{"id":"c1","label":"Não, em nenhuma hipótese.","points":0},{"id":"c2","label":"Talvez, dependendo da situação.","points":0},{"id":"c3","label":"Sim, caso a recompensa fosse boa.","points":0}]','c1','["c2","c3"]',0,''),
('escape','Durante uma transferência, um preso tenta fugir e outro agente começa a atirar sem autorização. Como você reage?','Descreva os procedimentos adotados.','Roleplay','open',true,true,4,10,'[]',null,'[]',50,'Avaliar controle emocional, comunicação, preservação da vida e proporcionalidade.'),
('force','Como equilibrar autoridade, respeito e uso proporcional da força?','Explique os limites da atuação.','Conduta','open',true,true,5,10,'[]',null,'[]',50,'Avaliar proporcionalidade e escalonamento do uso da força.'),
('motivation','Por que deseja ingressar na Polícia Penal?','Apresente sua motivação.','Perfil','open',true,true,6,10,'[]',null,'[]',50,'Avaliar autenticidade, maturidade e alinhamento.')
on conflict(id) do nothing;

grant usage on schema public to anon,authenticated;
grant select on public.recruitment_questions,public.recruitment_settings to anon,authenticated;
grant select,update on public.recruitment_applications to authenticated;
grant select,insert,update,delete on public.recruitment_questions,public.announcements to authenticated;
grant select,insert on public.audit_logs to authenticated;
grant select,update on public.profiles to authenticated;
