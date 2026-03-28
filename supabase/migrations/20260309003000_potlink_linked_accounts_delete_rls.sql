-- Update RLS Policies for pots table
drop policy if exists "Users can delete their own pots" on public.pots;

create policy "Users can delete their own pots"
  on public.pots for delete
  using (
    auth.uid() = user_id OR 
    exists (
      select 1 from public.potlink_account_links 
      where potlink_account_links.user_id = auth.uid() 
      and potlink_account_links.linked_user_id = pots.user_id
    )
  );

-- Update RLS Policies for care_schedules table
drop policy if exists "Users can delete their own care schedules" on public.care_schedules;

create policy "Users can delete their own care schedules"
  on public.care_schedules for delete
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
drop policy if exists "Users can delete their own care logs" on public.care_logs;

create policy "Users can delete their own care logs"
  on public.care_logs for delete
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

-- Update RLS for potlink_diagnosis_logs table (in case it needs to be deleted)
drop policy if exists "Users can delete own diagnosis logs" on public.potlink_diagnosis_logs;

create policy "Users can delete own diagnosis logs"
  on public.potlink_diagnosis_logs for delete
  using (
    auth.uid() = user_id OR 
    exists (
      select 1 from public.potlink_account_links 
      where potlink_account_links.user_id = auth.uid() 
      and potlink_account_links.linked_user_id = potlink_diagnosis_logs.user_id
    )
  );
