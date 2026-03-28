-- Create postalpeek_images bucket
insert into storage.buckets (id, name, public)
values ('postalpeek_images', 'postalpeek_images', true)
on conflict (id) do nothing;

create policy "Images are publicly accessible."
  on storage.objects for select
  using ( bucket_id = 'postalpeek_images' );

create policy "Service role can upload images."
  on storage.objects for insert
  with check ( bucket_id = 'postalpeek_images' );

create policy "Service role can update images."
  on storage.objects for update
  with check ( bucket_id = 'postalpeek_images' );

-- Create postalpeek_streetview_queries table
create table public.postalpeek_streetview_queries (
  id uuid primary key default gen_random_uuid(),
  address text not null unique,
  image_path text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.postalpeek_streetview_queries enable row level security;

-- Policies for postalpeek_streetview_queries
create policy "Public can read streetview queries"
  on public.postalpeek_streetview_queries for select
  using ( true );

create policy "Service role can insert streetview queries"
  on public.postalpeek_streetview_queries for insert
  with check ( true );
