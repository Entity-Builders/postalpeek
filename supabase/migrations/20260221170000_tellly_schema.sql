-- Tellly SaaS Schema
-- Creates tables for professional profiles, shareable briefing links, and submitted briefings

-- Profiles (extends Supabase auth.users)
create table public.tellly_profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text,
  profession text,
  created_at timestamptz default now()
);

-- Shareable links
create table public.briefing_links (
  id uuid default gen_random_uuid() primary key,
  slug text unique not null,
  owner_id uuid references public.tellly_profiles(id) on delete cascade not null,
  title text not null,
  profession_context text,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Submitted briefings
create table public.briefings (
  id uuid default gen_random_uuid() primary key,
  link_id uuid references public.briefing_links(id) on delete cascade not null,
  client_input text not null,
  curated_json jsonb not null,
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.tellly_profiles enable row level security;
alter table public.briefing_links enable row level security;
alter table public.briefings enable row level security;

-- Profiles: user can only read/update own
create policy "Users read own profile" on public.tellly_profiles
  for select using (auth.uid() = id);
create policy "Users update own profile" on public.tellly_profiles
  for update using (auth.uid() = id);
create policy "Users insert own profile" on public.tellly_profiles
  for insert with check (auth.uid() = id);

-- Links: owner can CRUD, anyone can read active links (for client access)
create policy "Owner manages own links" on public.briefing_links
  for all using (auth.uid() = owner_id);
create policy "Public reads active links" on public.briefing_links
  for select using (is_active = true);

-- Briefings: owner can read via link ownership, anyone can insert (client submits)
create policy "Owner reads own briefings" on public.briefings
  for select using (
    link_id in (select id from public.briefing_links where owner_id = auth.uid())
  );
create policy "Anyone can insert briefing" on public.briefings
  for insert with check (true);

-- Auto-create profile on user signup
create or replace function public.handle_tellly_new_user()
returns trigger as $$
begin
  insert into public.tellly_profiles (id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created_tellly
  after insert on auth.users
  for each row execute procedure public.handle_tellly_new_user();
