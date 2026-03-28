-- Create Fixed Expenses Table
create table public.fixed_expenses (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  amount numeric not null,
  user_id uuid references auth.users not null default auth.uid()
);

-- Enable RLS
alter table public.fixed_expenses enable row level security;

-- Policies
create policy "Users can view their own fixed expenses" on public.fixed_expenses for select using (auth.uid() = user_id);
create policy "Users can insert their own fixed expenses" on public.fixed_expenses for insert with check (auth.uid() = user_id);
create policy "Users can update their own fixed expenses" on public.fixed_expenses for update using (auth.uid() = user_id);
create policy "Users can delete their own fixed expenses" on public.fixed_expenses for delete using (auth.uid() = user_id);
