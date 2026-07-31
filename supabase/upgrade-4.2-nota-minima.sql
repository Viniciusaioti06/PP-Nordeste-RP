-- Atualiza a escala da triagem automática para 0 a 10.
alter table public.recruitment_settings
  alter column minimum_score type numeric(4,1) using minimum_score::numeric;

alter table public.recruitment_settings
  alter column minimum_score set default 7;

update public.recruitment_settings
set minimum_score = 7, updated_at = now()
where id = 1 and (minimum_score is null or minimum_score < 0 or minimum_score > 10 or minimum_score = 4);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'recruitment_settings_minimum_score_range') then
    alter table public.recruitment_settings
      add constraint recruitment_settings_minimum_score_range
      check (minimum_score >= 0 and minimum_score <= 10);
  end if;
end $$;
