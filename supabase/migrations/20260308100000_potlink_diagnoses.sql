create table public.potlink_diagnosis_logs (
    id uuid default gen_random_uuid() primary key,
    pot_id uuid references public.pots(id) on delete cascade not null,
    user_id uuid references auth.users not null default auth.uid(),
    image_url text not null,
    user_query text,
    ai_diagnosis text not null,
    urgency text not null check (urgency in ('low', 'medium', 'high')),
    action_plan jsonb not null default '[]'::jsonb,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS
alter table public.potlink_diagnosis_logs enable row level security;

create policy "Users can view own diagnosis logs"
    on public.potlink_diagnosis_logs for select
    using (auth.uid() = user_id);

create policy "Users can insert own diagnosis logs"
    on public.potlink_diagnosis_logs for insert
    with check (auth.uid() = user_id);

create policy "Users can delete own diagnosis logs"
    on public.potlink_diagnosis_logs for delete
    using (auth.uid() = user_id);
