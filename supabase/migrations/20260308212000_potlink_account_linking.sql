-- Create Account Links Table
create table public.potlink_account_links (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users not null,
    linked_user_id uuid references auth.users not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(user_id, linked_user_id)
);

-- Enable RLS for account links
alter table public.potlink_account_links enable row level security;

create policy "Users can view their own account links"
    on public.potlink_account_links for select
    using (auth.uid() = user_id or auth.uid() = linked_user_id);

-- Create Share Codes Table
create table public.potlink_share_codes (
    code text primary key,
    user_id uuid references auth.users not null,
    expires_at timestamp with time zone not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS for share codes
alter table public.potlink_share_codes enable row level security;

create policy "Users can view their own share codes"
    on public.potlink_share_codes for select
    using (auth.uid() = user_id);

-- RPC to generate share code
create or replace function public.generate_potlink_share_code()
returns text as $$
declare
    new_code text;
    uid uuid;
begin
    uid := auth.uid();
    if uid is null then
        raise exception 'Not authenticated';
    end if;
    
    -- Generate 6 chars alphanumeric uppercase
    new_code := upper(substring(md5(random()::text) from 1 for 6));
    
    -- Insert code expiring in 24 hours
    insert into public.potlink_share_codes (code, user_id, expires_at)
    values (new_code, uid, now() + interval '24 hours')
    on conflict (code) do update
    set user_id = EXCLUDED.user_id, expires_at = EXCLUDED.expires_at;
    
    return new_code;
end;
$$ language plpgsql security definer;

-- RPC to link account using share code
create or replace function public.link_potlink_account(share_code text)
returns boolean as $$
declare
    target_user_id uuid;
    current_user_id uuid;
begin
    current_user_id := auth.uid();
    if current_user_id is null then
        raise exception 'Not authenticated';
    end if;

    -- Find valid code
    select user_id into target_user_id
    from public.potlink_share_codes
    where code = upper(share_code) and expires_at > now();
    
    if target_user_id is null then
        raise exception 'Invalid or expired share code';
    end if;
    
    if target_user_id = current_user_id then
        raise exception 'Cannot link to your own account';
    end if;

    -- Insert bidirectional links
    insert into public.potlink_account_links (user_id, linked_user_id)
    values (current_user_id, target_user_id)
    on conflict do nothing;
    
    insert into public.potlink_account_links (user_id, linked_user_id)
    values (target_user_id, current_user_id)
    on conflict do nothing;
    
    -- Invalidate code
    delete from public.potlink_share_codes where code = upper(share_code);
    
    return true;
end;
$$ language plpgsql security definer;

-- Update RLS Policies for pots table
drop policy if exists "Users can view their own pots" on public.pots;
drop policy if exists "Users can update their own pots" on public.pots;

create policy "Users can view their own pots"
  on public.pots for select
  using (
    auth.uid() = user_id OR 
    exists (
      select 1 from public.potlink_account_links 
      where potlink_account_links.user_id = auth.uid() 
      and potlink_account_links.linked_user_id = pots.user_id
    )
  );

create policy "Users can update their own pots"
  on public.pots for update
  using (
    auth.uid() = user_id OR 
    exists (
      select 1 from public.potlink_account_links 
      where potlink_account_links.user_id = auth.uid() 
      and potlink_account_links.linked_user_id = pots.user_id
    )
  );

-- Update RLS Policies for potlink_diagnosis_logs table
drop policy if exists "Users can view own diagnosis logs" on public.potlink_diagnosis_logs;
drop policy if exists "Users can insert own diagnosis logs" on public.potlink_diagnosis_logs;

create policy "Users can view own diagnosis logs"
  on public.potlink_diagnosis_logs for select
  using (
    auth.uid() = user_id OR 
    exists (
      select 1 from public.potlink_account_links 
      where potlink_account_links.user_id = auth.uid() 
      and potlink_account_links.linked_user_id = potlink_diagnosis_logs.user_id
    )
  );

create policy "Users can insert own diagnosis logs"
  on public.potlink_diagnosis_logs for insert
  with check (
    -- Let them insert if they own the parent pot or are linked to the parent pot's owner
    exists (
      select 1 from public.pots 
      where pots.id = potlink_diagnosis_logs.pot_id 
      and (
        pots.user_id = auth.uid() OR
        exists (
          select 1 from public.potlink_account_links 
          where potlink_account_links.user_id = auth.uid() 
          and potlink_account_links.linked_user_id = pots.user_id
        )
      )
    )
  );

-- Update RLS Policies for care_schedules table
drop policy if exists "Users can view their own care schedules" on public.care_schedules;
drop policy if exists "Users can update their own care schedules" on public.care_schedules;

create policy "Users can view their own care schedules"
  on public.care_schedules for select
  using (
    exists (
      select 1 from public.pots 
      where pots.id = care_schedules.pot_id 
      and (
        pots.user_id = auth.uid() OR
        exists (
          select 1 from public.potlink_account_links 
          where potlink_account_links.user_id = auth.uid() 
          and potlink_account_links.linked_user_id = pots.user_id
        )
      )
    )
  );

create policy "Users can update their own care schedules"
  on public.care_schedules for update
  using (
    exists (
      select 1 from public.pots 
      where pots.id = care_schedules.pot_id 
      and (
        pots.user_id = auth.uid() OR
        exists (
          select 1 from public.potlink_account_links 
          where potlink_account_links.user_id = auth.uid() 
          and potlink_account_links.linked_user_id = pots.user_id
        )
      )
    )
  );

-- Update RLS Policies for care_logs table
drop policy if exists "Users can view their own care logs" on public.care_logs;
drop policy if exists "Users can insert their own care logs" on public.care_logs;

create policy "Users can view their own care logs"
  on public.care_logs for select
  using (
    exists (
      select 1 from public.pots 
      where pots.id = care_logs.pot_id 
      and (
        pots.user_id = auth.uid() OR
        exists (
          select 1 from public.potlink_account_links 
          where potlink_account_links.user_id = auth.uid() 
          and potlink_account_links.linked_user_id = pots.user_id
        )
      )
    )
  );

create policy "Users can insert their own care logs"
  on public.care_logs for insert
  with check (
    exists (
      select 1 from public.pots 
      where pots.id = care_logs.pot_id 
      and (
        pots.user_id = auth.uid() OR
        exists (
          select 1 from public.potlink_account_links 
          where potlink_account_links.user_id = auth.uid() 
          and potlink_account_links.linked_user_id = pots.user_id
        )
      )
    )
  );
