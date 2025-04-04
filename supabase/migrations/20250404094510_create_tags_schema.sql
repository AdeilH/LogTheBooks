-- 1. Create Tags table (user-specific)
create table tags (
  id bigint generated by default as identity primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamp with time zone default now(),
  name text not null,
  -- Ensure a user cannot have the same tag name twice
  constraint unique_user_tag_name unique (user_id, name)
);

-- 2. Create Log Tags junction table
create table log_tags (
  log_id bigint references public.book_logs(id) on delete cascade not null,
  tag_id bigint references public.tags(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamp with time zone default now(),
  -- Composite primary key to prevent duplicates for the same user/log/tag
  constraint log_tags_pkey primary key (log_id, tag_id, user_id)
);

-- 3. Add Indexes
create index idx_tags_user_id on tags(user_id);
create index idx_log_tags_log_id on log_tags(log_id);
create index idx_log_tags_tag_id on log_tags(tag_id);
create index idx_log_tags_user_id on log_tags(user_id);

-- 4. Enable Row Level Security (RLS)
alter table tags enable row level security;
alter table log_tags enable row level security;

-- 5. RLS Policies for Tags
create policy "Users can view their own tags." on tags
  for select using ( auth.uid() = user_id );

create policy "Users can insert their own tags." on tags
  for insert with check ( auth.uid() = user_id );

create policy "Users can update their own tags." on tags
  for update using ( auth.uid() = user_id );

create policy "Users can delete their own tags." on tags
  for delete using ( auth.uid() = user_id );

-- 6. RLS Policies for Log Tags (Junction Table)
create policy "Users can view their own log_tags." on log_tags
  for select using ( auth.uid() = user_id );

create policy "Users can insert their own log_tags." on log_tags
  for insert with check ( auth.uid() = user_id );

-- Policy for updates might not be needed if users only add/delete tag associations
-- create policy "Users can update their own log_tags." on log_tags
--  for update using ( auth.uid() = user_id );

create policy "Users can delete their own log_tags." on log_tags
  for delete using ( auth.uid() = user_id );
