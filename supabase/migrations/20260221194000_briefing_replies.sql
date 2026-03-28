-- Briefing Replies: clients can answer suggested questions inline
create table public.briefing_replies (
  id uuid default gen_random_uuid() primary key,
  briefing_id uuid references public.briefings(id) on delete cascade not null,
  question_index smallint not null,
  question_text text not null,
  answer_text text not null,
  created_at timestamptz default now()
);

alter table public.briefing_replies enable row level security;

-- Anyone can insert (client submits reply without auth)
create policy "Anyone can insert reply" on public.briefing_replies
  for insert with check (true);

-- Owner reads via chain: reply → briefing → link → owner
create policy "Owner reads own replies" on public.briefing_replies
  for select using (
    briefing_id in (
      select b.id from public.briefings b
      join public.briefing_links l on b.link_id = l.id
      where l.owner_id = auth.uid()
    )
  );
