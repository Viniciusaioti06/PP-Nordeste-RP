
-- Estrutura inicial para futura integração com Supabase
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'candidate' check (role in ('candidate','recruiter','supervisor','admin')),
  display_name text,
  created_at timestamptz default now()
);

create table if not exists recruitment_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  protocol text unique not null,
  character_name text not null,
  passport text not null,
  discord text not null,
  character_age integer,
  city_time text,
  availability text,
  experience text,
  automatic_score integer default 0,
  manual_score integer,
  status text not null default 'Em análise',
  public_note text,
  reviewer_notes text,
  reviewer_id uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists recruitment_answers (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references recruitment_applications(id) on delete cascade,
  question_key text not null,
  answer_text text,
  points integer default 0,
  eliminatory_triggered boolean default false
);

create table if not exists recruitment_status_history (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references recruitment_applications(id) on delete cascade,
  status text not null,
  changed_by uuid references auth.users(id),
  note text,
  created_at timestamptz default now()
);


-- Release 1.0: cargos, permissões e auditoria
create table if not exists staff_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  permission text not null,
  allowed boolean not null default false,
  unique(user_id, permission)
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id),
  action text not null,
  resource_type text not null,
  resource_id text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz default now()
);

-- Exemplos de políticas deverão ser aplicados após definir uma função segura
-- para obter o cargo do usuário autenticado.
