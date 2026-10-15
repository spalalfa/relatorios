-- MÓDULO DE ROTAS SPAL
-- Execute no Supabase SQL Editor do mesmo projeto usado pelo painel.
-- A alteração preserva as sugestões existentes e não muda spal_coletas.

begin;

alter table public.spal_coletas_sugestoes
  add column if not exists endereco text,
  add column if not exists numero text,
  add column if not exists complemento text,
  add column if not exists bairro text,
  add column if not exists cidade text,
  add column if not exists uf text,
  add column if not exists cep text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

-- Uma configuração de base por região.
-- regiao_id é texto para evitar incompatibilidade com o tipo atual de spal_regioes.id.
create table if not exists public.spal_rotas_config (
  id bigint generated always as identity primary key,
  regiao_id text not null unique,
  base_nome text not null default 'Base da região',
  base_endereco text,
  base_latitude double precision,
  base_longitude double precision,
  atualizado_em timestamptz not null default now(),
  constraint spal_rotas_latitude_valida
    check (base_latitude is null or base_latitude between -90 and 90),
  constraint spal_rotas_longitude_valida
    check (base_longitude is null or base_longitude between -180 and 180)
);

create index if not exists idx_spal_rotas_config_regiao
  on public.spal_rotas_config(regiao_id);

alter table public.spal_rotas_config enable row level security;

-- Alinha com o painel atual: requireAdmin exige autenticação e ADMIN_EMAILS está vazio.
-- Se houver usuários autenticados que não devam administrar rotas, restrinja esta policy
-- por e-mail/claim e atualize ADMIN_EMAILS antes de produção.
drop policy if exists "spal_rotas_config_authenticated_all" on public.spal_rotas_config;
create policy "spal_rotas_config_authenticated_all"
  on public.spal_rotas_config
  for all
  to authenticated
  using (true)
  with check (true);

grant select, insert, update, delete on public.spal_rotas_config to authenticated;
grant usage, select on sequence public.spal_rotas_config_id_seq to authenticated;

commit;

-- Depois de executar:
-- 1. Abra Administração > Sugestões.
-- 2. Clique em "Endereço" ao lado de cada sugestão frequente e salve o endereço/localização.
-- 3. Abra Administração > Planejamento de rotas.
-- 4. Escolha data e região, cadastre/localize a base e salve.
-- 5. Clique em "Montar rota sugerida".
