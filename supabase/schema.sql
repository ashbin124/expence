-- Run this in Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  title text not null,
  amount numeric(12, 2) not null check (amount <> 0),
  category text not null,
  date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.budgets (
  user_id uuid primary key references auth.users (id) on delete cascade,
  budget_limit numeric(12, 2) not null check (budget_limit >= 0),
  updated_at timestamptz not null default now()
);

create index if not exists idx_transactions_user_date
  on public.transactions (user_id, date desc);

alter table public.transactions enable row level security;
alter table public.budgets enable row level security;

drop policy if exists "tx_select_own" on public.transactions;
create policy "tx_select_own"
  on public.transactions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "tx_insert_own" on public.transactions;
create policy "tx_insert_own"
  on public.transactions
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "tx_update_own" on public.transactions;
create policy "tx_update_own"
  on public.transactions
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "tx_delete_own" on public.transactions;
create policy "tx_delete_own"
  on public.transactions
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "budget_select_own" on public.budgets;
create policy "budget_select_own"
  on public.budgets
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "budget_insert_own" on public.budgets;
create policy "budget_insert_own"
  on public.budgets
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "budget_update_own" on public.budgets;
create policy "budget_update_own"
  on public.budgets
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "budget_delete_own" on public.budgets;
create policy "budget_delete_own"
  on public.budgets
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);
