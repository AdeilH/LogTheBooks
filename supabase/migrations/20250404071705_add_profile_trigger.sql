-- Function to automatically create a profile entry when a new user signs up
-- Ensure 'uuid-ossp' extension is enabled (should be by default)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- Insert into public.profiles using the new user's id and email
  insert into public.profiles (id, username)
  values (new.id, new.email);
  return new;
end;
$$;

-- Trigger to call the function after a new user is inserted into auth.users
-- Drop trigger first if it exists from a failed attempt (idempotent)
drop trigger if exists on_auth_user_created on auth.users; 
-- Create the trigger
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Grant usage on the function to the necessary roles if needed (might depend on security setup)
-- grant execute on function public.handle_new_user() to postgres, service_role, authenticated;
-- Note: Granting might not be strictly necessary if function security is definer,
-- but explicit grants can sometimes help depending on context.
