create extension if not exists pgcrypto;

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  name text not null,
  tags text[] not null default '{}',
  patterns text[] not null default array['I see a ___ .'],
  ask_patterns text[] not null default array['Do you like ___?', 'Can you see ___?'],
  ask_mode text not null default 'auto',
  enabled_tasks text[] not null default array['say', 'sentence', 'spell', 'ask', 'act', 'choose'],
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint courses_slug_key unique (slug),
  constraint courses_name_not_blank check (length(btrim(name)) > 0),
  constraint courses_slug_not_blank check (length(btrim(slug)) > 0),
  constraint courses_ask_mode_check check (ask_mode in ('auto', 'template', 'student'))
);

create table if not exists public.words (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  position integer not null default 0,
  word text not null,
  meaning text not null default '',
  category text not null default '',
  sentence text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint words_word_not_blank check (length(btrim(word)) > 0),
  constraint words_position_nonnegative check (position >= 0)
);

create index if not exists courses_slug_idx on public.courses (slug);
create index if not exists courses_updated_at_idx on public.courses (updated_at desc);
create index if not exists words_course_position_idx on public.words (course_id, position, created_at);
create index if not exists words_course_word_idx on public.words (course_id, word);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists courses_set_updated_at on public.courses;
create trigger courses_set_updated_at
before update on public.courses
for each row execute function public.set_updated_at();

drop trigger if exists words_set_updated_at on public.words;
create trigger words_set_updated_at
before update on public.words
for each row execute function public.set_updated_at();

alter table public.courses enable row level security;
alter table public.words enable row level security;

grant usage on schema public to anon, authenticated;
grant select on public.courses to anon, authenticated;
grant select on public.words to anon, authenticated;
grant insert, update, delete on public.courses to anon, authenticated;
grant insert, update, delete on public.words to anon, authenticated;
grant all on public.courses to service_role;
grant all on public.words to service_role;

create or replace function public.teacher_write_allowed()
returns boolean
language sql
stable
as $$
  select encode(
    digest(
      coalesce(
        nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-teacher-token',
        ''
      ),
      'sha256'
    ),
    'hex'
  ) = '8372aaf6c6bf0e0e231ecc4e43015f7d57d3fc6eefaf44719527af5dd79bc0cd';
$$;

grant execute on function public.teacher_write_allowed() to anon, authenticated;

drop policy if exists "Public can read published courses" on public.courses;
create policy "Public can read published courses"
on public.courses
for select
to anon, authenticated
using (is_published = true);

drop policy if exists "Public can read words from published courses" on public.words;
create policy "Public can read words from published courses"
on public.words
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.courses
    where courses.id = words.course_id
      and courses.is_published = true
  )
);

drop policy if exists "Teachers can insert courses" on public.courses;
create policy "Teachers can insert courses"
on public.courses
for insert
to anon, authenticated
with check (public.teacher_write_allowed());

drop policy if exists "Teachers can update courses" on public.courses;
create policy "Teachers can update courses"
on public.courses
for update
to anon, authenticated
using (public.teacher_write_allowed())
with check (public.teacher_write_allowed());

drop policy if exists "Teachers can delete courses" on public.courses;
create policy "Teachers can delete courses"
on public.courses
for delete
to anon, authenticated
using (public.teacher_write_allowed());

drop policy if exists "Teachers can insert words" on public.words;
create policy "Teachers can insert words"
on public.words
for insert
to anon, authenticated
with check (public.teacher_write_allowed());

drop policy if exists "Teachers can update words" on public.words;
create policy "Teachers can update words"
on public.words
for update
to anon, authenticated
using (public.teacher_write_allowed())
with check (public.teacher_write_allowed());

drop policy if exists "Teachers can delete words" on public.words;
create policy "Teachers can delete words"
on public.words
for delete
to anon, authenticated
using (public.teacher_write_allowed());
