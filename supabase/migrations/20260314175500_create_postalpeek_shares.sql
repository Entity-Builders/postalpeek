-- Create postalpeek_shares table for single-use share links
create table if not exists public.postalpeek_shares (
  id uuid primary key default gen_random_uuid(),
  postcard_id uuid not null references public.postalpeek_postcards(id) on delete cascade,
  is_used boolean not null default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.postalpeek_shares enable row level security;

-- Policies
create policy "Anyone can insert a share link"
  on public.postalpeek_shares for insert
  with check (true);

create policy "Anyone can read an unused share link"
  on public.postalpeek_shares for select
  using (is_used = false);

create policy "Anyone can mark a share link as used"
  on public.postalpeek_shares for update
  using (is_used = false)
  with check (is_used = true);
