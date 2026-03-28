-- Client Question Replies: admin (professional) can answer client questions
create table public.client_question_replies (
  id uuid default gen_random_uuid() primary key,
  briefing_id uuid references public.briefings(id) on delete cascade not null,
  question_index smallint not null,
  question_text text not null,
  answer_text text not null,
  created_at timestamptz default now()
);

alter table public.client_question_replies enable row level security;

-- Owner can insert & update (professional answers via dashboard)
create policy "Owner manages client question replies" on public.client_question_replies
  for all using (
    briefing_id in (
      select b.id from public.briefings b
      join public.briefing_links l on b.link_id = l.id
      where l.owner_id = auth.uid()
    )
  );

-- Anyone can read (client sees admin replies without auth)
create policy "Anyone can read client question replies" on public.client_question_replies
  for select using (true);
