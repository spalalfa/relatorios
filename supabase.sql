-- SUPABASE: execute este SQL no SQL Editor do seu projeto.
create extension if not exists pgcrypto;

create table if not exists public.processos (
  id uuid primary key default gen_random_uuid(),
  data text,
  cte text not null,
  nf text not null,
  cliente text,
  volume text,
  acr text,
  senha text,
  status text not null default 'GERADA'
    check (status in ('GERADA','ABERTA','LIBERADA')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists processos_nf_idx on public.processos(nf);
create index if not exists processos_cte_idx on public.processos(cte);
create index if not exists processos_acr_idx on public.processos(acr);
create index if not exists processos_cliente_idx on public.processos(cliente);
create index if not exists processos_senha_idx on public.processos(senha);

alter table public.processos enable row level security;

-- Para uma primeira versão interna, permitindo leitura/escrita pela chave anon.
-- Se o sistema for ficar público, recomendo trocar estas policies por login
-- e permissões específicas.
drop policy if exists "anon_select_processos" on public.processos;
drop policy if exists "anon_insert_processos" on public.processos;
drop policy if exists "anon_update_processos" on public.processos;

create policy "anon_select_processos" on public.processos for select to anon using (true);
create policy "anon_insert_processos" on public.processos for insert to anon with check (true);
create policy "anon_update_processos" on public.processos for update to anon using (true) with check (true);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists processos_updated_at on public.processos;
create trigger processos_updated_at before update on public.processos
for each row execute function public.set_updated_at();

-- Dados iniciais equivalentes aos dois relatórios fornecidos:
insert into public.processos (data,cte,nf,cliente,volume,acr,senha,status) values
('17/09/2026','10/13152815','867137','ECOLAB','08','6545516',null,'GERADA'),
('17/09/2026','11/8025995','398570','ELETRO NACIONAL','1','6542737',null,'GERADA'),
('17/09/2026','263/13153216','578090','ECOLAB','2','6546099',null,'GERADA'),
('17/09/2026','263/13152967','777621','KLUBER','1','6545691',null,'GERADA'),
('09/09/2026','10/13104576','865440','ECOLAB','2','6467316','37742','ABERTA'),
('09/09/2026','263/13106595','573683','ECOLAB','1','6470384','37742','ABERTA'),
('09/09/2026','263/13115582','8425','PROFILTRO','1','6485136','37742','ABERTA'),
('09/09/2026','263/13115583','8426','PROFILTRO','1','6485137','37742','ABERTA'),
('09/09/2026','52/13120478','15975','MOVEX','1','6493342','37742','ABERTA');
