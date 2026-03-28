-- RPC to fetch linked accounts details securely
create or replace function public.get_potlink_linked_accounts_info()
returns table (
  linked_user_id uuid,
  email text,
  name text,
  created_at timestamp with time zone
) as $$
begin
  return query
  select 
    l.linked_user_id,
    u.email::text,
    (u.raw_user_meta_data->>'name')::text as name,
    l.created_at
  from public.potlink_account_links l
  join auth.users u on l.linked_user_id = u.id
  where l.user_id = auth.uid();
end;
$$ language plpgsql security definer;
