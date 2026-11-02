-- ==========================================================================
-- Caderninho — supabase.sql
-- Rode UMA vez no Supabase: "SQL Editor" > "New query" > cole tudo > Run.
--
-- Guarda UMA linha por usuário com o "caderninho" inteiro em JSON.
-- A sincronização do app (sync.js) junta os dados de vários aparelhos
-- (função Store.merge) e grava o resultado aqui.
--
-- Segurança: com RLS ligado, cada pessoa só enxerga e altera a PRÓPRIA linha
-- (auth.uid() = user_id). Sem estas regras, a chave anon exporia os dados de todos.
-- ==========================================================================

create table if not exists public.caderninho_data (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb       not null,
  -- "version" evita que dois aparelhos se sobrescrevam: o app só grava se a versão
  -- que leu ainda for a atual; senão baixa de novo, junta e tenta outra vez.
  version    bigint      not null default 1,
  updated_at timestamptz not null default now(),
  -- trava de tamanho (~5 MB) para ninguém encher o banco com lixo
  constraint caderninho_data_size check (octet_length(data::text) < 5000000)
);

alter table public.caderninho_data enable row level security;

drop policy if exists "caderninho_select_own" on public.caderninho_data;
drop policy if exists "caderninho_insert_own" on public.caderninho_data;
drop policy if exists "caderninho_update_own" on public.caderninho_data;
drop policy if exists "caderninho_delete_own" on public.caderninho_data;

create policy "caderninho_select_own" on public.caderninho_data
  for select to authenticated using (auth.uid() = user_id);

create policy "caderninho_insert_own" on public.caderninho_data
  for insert to authenticated with check (auth.uid() = user_id);

create policy "caderninho_update_own" on public.caderninho_data
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "caderninho_delete_own" on public.caderninho_data
  for delete to authenticated using (auth.uid() = user_id);

-- Quem não está logado (role anon) não recebe nenhuma permissão na tabela.
revoke all on public.caderninho_data from anon;
grant select, insert, update, delete on public.caderninho_data to authenticated;

-- Autenticação (painel Supabase > Authentication > Providers > Email):
--  • "Confirm email" LIGADO é o recomendado em produção (o app avisa a pessoa para confirmar).
--  • Em Authentication > URL Configuration, coloque o endereço onde o app está publicado
--    em "Site URL" (é para onde o link do e-mail leva).
