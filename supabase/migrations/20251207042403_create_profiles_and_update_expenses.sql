-- Create Profiles Table
create table public.profiles (
  id uuid references auth.users not null primary key,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  monthly_income numeric default 0,
  fixed_expenses numeric default 0,
  savings_percentage numeric default 0,
  currency text default 'ARS'
);

alter table public.profiles enable row level security;

create policy "Users can view their own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can insert their own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "Users can update their own profile" on public.profiles for update using (auth.uid() = id);

-- Update Expenses Table
alter table public.expenses add column original_amount numeric;
-- Change date to timestamp with time zone for precision
alter table public.expenses alter column date type timestamp with time zone using date::timestamp with time zone;
