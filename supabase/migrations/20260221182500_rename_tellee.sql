-- Rename Tellly → Tellee
-- Rename table
alter table public.tellly_profiles rename to tellee_profiles;

-- Recreate the trigger function with the new name and table reference
create or replace function public.handle_tellee_new_user()
returns trigger as $$
begin
  insert into public.tellee_profiles (id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

-- Drop old trigger and function
drop trigger if exists on_auth_user_created_tellly on auth.users;
drop function if exists public.handle_tellly_new_user();

-- Recreate trigger with new function
create trigger on_auth_user_created_tellee
  after insert on auth.users
  for each row execute procedure public.handle_tellee_new_user();
