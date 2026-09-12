-- Supabase SQL Editor で実行
create table if not exists public.progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null,
  round_no smallint not null check (round_no between 1 and 3),
  completed_at timestamptz not null default now(),
  primary key (user_id, item_id, round_no)
);

alter table public.progress enable row level security;

revoke all on table public.progress from anon, authenticated;
grant select, insert, update, delete on table public.progress to authenticated;

drop policy if exists "progress_select_own" on public.progress;
create policy "progress_select_own"
on public.progress for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "progress_insert_own" on public.progress;
create policy "progress_insert_own"
on public.progress for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "progress_update_own" on public.progress;
create policy "progress_update_own"
on public.progress for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "progress_delete_own" on public.progress;
create policy "progress_delete_own"
on public.progress for delete
to authenticated
using ((select auth.uid()) = user_id);

create index if not exists progress_user_completed_idx
on public.progress(user_id, completed_at desc);
