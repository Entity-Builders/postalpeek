-- Tablia Schema
-- AI-powered QR menu adapter for restaurants & bars
-- Tables: profiles, venues, menus, categories, items

-- ─── Profiles (extends Supabase auth.users) ─────────────────────

create table public.tablia_profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text,
  business_name text,
  created_at timestamptz default now()
);

-- ─── Venues (Restaurant/Bar) ────────────────────────────────────

create table public.tablia_venues (
  id uuid default gen_random_uuid() primary key,
  owner_id uuid references public.tablia_profiles(id) on delete cascade not null,
  name text not null,
  slug text unique not null,
  description text,
  cuisine_type text,
  logo_url text,
  address text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── Menus ──────────────────────────────────────────────────────

create table public.tablia_menus (
  id uuid default gen_random_uuid() primary key,
  venue_id uuid references public.tablia_venues(id) on delete cascade not null,
  name text not null default 'Menú Principal',
  source_type text not null default 'text', -- url, pdf, image, text
  source_content text, -- original input (URL, pasted text, file path)
  status text not null default 'draft', -- draft, parsing, review, published
  parsed_json jsonb, -- raw AI output for reference
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── Menu Categories (Sections) ─────────────────────────────────

create table public.tablia_menu_categories (
  id uuid default gen_random_uuid() primary key,
  menu_id uuid references public.tablia_menus(id) on delete cascade not null,
  name text not null,
  description text,
  icon text,
  sort_order integer not null default 0,
  is_visible boolean not null default true
);

-- ─── Menu Items (Dishes/Drinks) ─────────────────────────────────

create table public.tablia_menu_items (
  id uuid default gen_random_uuid() primary key,
  category_id uuid references public.tablia_menu_categories(id) on delete cascade not null,
  menu_id uuid references public.tablia_menus(id) on delete cascade not null,
  name text not null,
  description text,
  price numeric(10,2) not null default 0,
  currency text not null default 'ARS',
  image_url text,
  tags text[] default '{}',
  is_available boolean not null default true,
  sort_order integer not null default 0
);

-- ═══════════════════════════════════════════════════════════════
-- RLS Policies
-- ═══════════════════════════════════════════════════════════════

alter table public.tablia_profiles enable row level security;
alter table public.tablia_venues enable row level security;
alter table public.tablia_menus enable row level security;
alter table public.tablia_menu_categories enable row level security;
alter table public.tablia_menu_items enable row level security;

-- ─── Profiles ───────────────────────────────────────────────────

create policy "Users read own profile" on public.tablia_profiles
  for select using (auth.uid() = id);
create policy "Users update own profile" on public.tablia_profiles
  for update using (auth.uid() = id);
create policy "Users insert own profile" on public.tablia_profiles
  for insert with check (auth.uid() = id);

-- ─── Venues ─────────────────────────────────────────────────────

create policy "Owner manages own venues" on public.tablia_venues
  for all using (auth.uid() = owner_id);
create policy "Public reads venues by slug" on public.tablia_venues
  for select using (true);

-- ─── Menus ──────────────────────────────────────────────────────

create policy "Owner manages own menus" on public.tablia_menus
  for all using (
    venue_id in (select id from public.tablia_venues where owner_id = auth.uid())
  );
create policy "Public reads published menus" on public.tablia_menus
  for select using (status = 'published');

-- ─── Categories ─────────────────────────────────────────────────

create policy "Owner manages own categories" on public.tablia_menu_categories
  for all using (
    menu_id in (
      select m.id from public.tablia_menus m
      join public.tablia_venues v on m.venue_id = v.id
      where v.owner_id = auth.uid()
    )
  );
create policy "Public reads visible categories" on public.tablia_menu_categories
  for select using (
    is_visible = true and
    menu_id in (select id from public.tablia_menus where status = 'published')
  );

-- ─── Items ──────────────────────────────────────────────────────

create policy "Owner manages own items" on public.tablia_menu_items
  for all using (
    menu_id in (
      select m.id from public.tablia_menus m
      join public.tablia_venues v on m.venue_id = v.id
      where v.owner_id = auth.uid()
    )
  );
create policy "Public reads available items" on public.tablia_menu_items
  for select using (
    is_available = true and
    menu_id in (select id from public.tablia_menus where status = 'published')
  );

-- ═══════════════════════════════════════════════════════════════
-- Auto-create profile on signup
-- ═══════════════════════════════════════════════════════════════

create or replace function public.handle_tablia_new_user()
returns trigger as $$
begin
  insert into public.tablia_profiles (id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created_tablia
  after insert on auth.users
  for each row execute procedure public.handle_tablia_new_user();
