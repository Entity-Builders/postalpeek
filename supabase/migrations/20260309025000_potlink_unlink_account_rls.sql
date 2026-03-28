-- Add RLS policy allowing users to delete their own account links
create policy "Users can delete their own account links"
  on public.potlink_account_links for delete
  using (auth.uid() = user_id);
