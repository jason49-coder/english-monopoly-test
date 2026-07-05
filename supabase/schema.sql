create extension if not exists pgcrypto;

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  name text not null,
  tags text[] not null default '{}',
  enabled_tasks text[] not null default array['say', 'sentence', 'spell', 'ask', 'act', 'choose'],
  is_published boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint courses_slug_key unique (slug),
  constraint courses_name_not_blank check (length(btrim(name)) > 0),
  constraint courses_slug_not_blank check (length(btrim(slug)) > 0)
);

alter table public.courses
add column if not exists sort_order integer not null default 0;

create table if not exists public.words (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  position integer not null default 0,
  en text not null,
  zh text not null,
  sentence text not null default '',
  phonetic text not null default '',
  image text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint words_en_not_blank check (length(btrim(en)) > 0),
  constraint words_zh_not_blank check (length(btrim(zh)) > 0),
  constraint words_position_nonnegative check (position >= 0)
);

create table if not exists public.maintenance_heartbeat (
  id text primary key default 'github-actions',
  checked_at timestamptz not null default now(),
  source text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint maintenance_heartbeat_id_not_blank check (length(btrim(id)) > 0)
);

create index if not exists courses_slug_idx on public.courses (slug);
create index if not exists courses_sort_order_idx on public.courses (sort_order asc, updated_at desc);
create index if not exists courses_updated_at_idx on public.courses (updated_at desc);
create index if not exists words_course_position_idx on public.words (course_id, position, created_at);
create index if not exists words_course_en_idx on public.words (course_id, en);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  if tg_table_schema = 'public' and tg_table_name = 'courses' then
    if new.slug is not distinct from old.slug
      and new.name is not distinct from old.name
      and new.tags is not distinct from old.tags
      and new.enabled_tasks is not distinct from old.enabled_tasks
      and new.is_published is not distinct from old.is_published
    then
      return new;
    end if;
  end if;

  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if exists (select 1 from public.courses)
    and not exists (select 1 from public.courses where sort_order <> 0)
  then
    update public.courses
    set sort_order = ranked.sort_order
    from (
      select
        id,
        ((row_number() over (order by updated_at desc, created_at desc, id)) - 1) * 100 as sort_order
      from public.courses
    ) as ranked
    where courses.id = ranked.id;
  end if;
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

drop trigger if exists maintenance_heartbeat_set_updated_at on public.maintenance_heartbeat;
create trigger maintenance_heartbeat_set_updated_at
before update on public.maintenance_heartbeat
for each row execute function public.set_updated_at();

alter table public.courses enable row level security;
alter table public.words enable row level security;
alter table public.maintenance_heartbeat enable row level security;

grant usage on schema public to anon, authenticated;
grant select on public.courses to anon, authenticated;
grant select on public.words to anon, authenticated;
grant select, insert, update on public.maintenance_heartbeat to anon, authenticated;
grant insert, update, delete on public.courses to anon, authenticated;
grant insert, update, delete on public.words to anon, authenticated;
grant all on public.courses to service_role;
grant all on public.words to service_role;
grant all on public.maintenance_heartbeat to service_role;

create or replace function public.teacher_write_allowed()
returns boolean
language sql
stable
as $$
  select encode(
    extensions.digest(
      coalesce(
        nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-teacher-token',
        ''
      ),
      'sha256'
    ),
    'hex'
  ) = 'b7229ba8b70fde3939425c1e6284c37dfb452f55dbb0d51ce9c060fe50aedbc0';
$$;

grant execute on function public.teacher_write_allowed() to anon, authenticated;

drop function if exists public.save_course_with_words(
  uuid,
  text,
  text,
  text[],
  text[],
  boolean,
  jsonb
);

create or replace function public.save_course_with_words(
  p_course_id uuid,
  p_slug text,
  p_name text,
  p_tags text[],
  p_enabled_tasks text[],
  p_is_published boolean,
  p_sort_order integer,
  p_words jsonb
)
returns table (id uuid, slug text, name text, word_count integer, sort_order integer)
language plpgsql
security invoker
set search_path = public
as $$
declare
  saved_course public.courses%rowtype;
  normalized_words jsonb := coalesce(p_words, '[]'::jsonb);
  inserted_word_count integer := 0;
  has_legacy_word_columns boolean := false;
begin
  if not public.teacher_write_allowed() then
    raise sqlstate '42501' using message = 'Teacher write token is invalid.';
  end if;

  -- 課程身份只由 p_course_id 決定。名稱／網址代碼在此做伺服器端防護（前端也會預檢），
  -- 確保任何情況都不會撞到別門課程：更新時不能改成別人的名稱或代碼，
  -- 新增時不能與既有課程同名或同代碼（也就是絕不因為同名而變成覆蓋既有課程）。
  if p_course_id is not null then
    if exists (
      select 1 from public.courses
      where courses.id <> p_course_id
        and lower(btrim(courses.name)) = lower(btrim(p_name))
    ) then
      raise exception using message = '課程名稱已被其他課程使用，請換一個名稱。';
    end if;
    if exists (
      select 1 from public.courses
      where courses.id <> p_course_id
        and courses.slug = p_slug
    ) then
      raise exception using message = '課程網址代碼已被其他課程使用，請換一個代碼。';
    end if;
  else
    if exists (
      select 1 from public.courses
      where lower(btrim(courses.name)) = lower(btrim(p_name))
    ) then
      raise exception using message = '課程名稱已存在，請換一個名稱或改為編輯既有課程。';
    end if;
    if exists (
      select 1 from public.courses
      where courses.slug = p_slug
    ) then
      raise exception using message = '課程網址代碼已存在，請換一個代碼或改為編輯既有課程。';
    end if;
  end if;

  if p_course_id is not null then
    update public.courses
    set
      slug = p_slug,
      name = p_name,
      tags = coalesce(p_tags, '{}'::text[]),
      enabled_tasks = coalesce(p_enabled_tasks, array['say', 'sentence', 'spell', 'ask', 'act', 'choose']::text[]),
      is_published = coalesce(p_is_published, true),
      sort_order = coalesce(p_sort_order, courses.sort_order),
      updated_at = now()
    where courses.id = p_course_id
    returning * into saved_course;

    if saved_course.id is null then
      raise exception 'Course not found';
    end if;
  else
    insert into public.courses (
      slug,
      name,
      tags,
      enabled_tasks,
      is_published,
      sort_order
    )
    values (
      p_slug,
      p_name,
      coalesce(p_tags, '{}'::text[]),
      coalesce(p_enabled_tasks, array['say', 'sentence', 'spell', 'ask', 'act', 'choose']::text[]),
      coalesce(p_is_published, true),
      coalesce(p_sort_order, coalesce((select min(sort_order) from public.courses), 100) - 100)
    )
    returning * into saved_course;
  end if;

  delete from public.words
  where course_id = saved_course.id;

  select
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'words'
        and column_name = 'word'
    )
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'words'
        and column_name = 'meaning'
    )
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'words'
        and column_name = 'category'
    )
  into has_legacy_word_columns;

  if has_legacy_word_columns then
    execute $insert$
      insert into public.words (
        course_id,
        position,
        en,
        zh,
        sentence,
        phonetic,
        image,
        word,
        meaning,
        category
      )
      select
        $1,
        coalesce(item.position, item.fallback_position)::integer,
        btrim(item.en),
        btrim(item.zh),
        coalesce(item.sentence, ''),
        coalesce(item.phonetic, ''),
        coalesce(item.image, ''),
        btrim(item.en),
        btrim(item.zh),
        ''
      from (
        select
          (row_number() over () - 1)::integer as fallback_position,
          word_item.*
        from jsonb_to_recordset($2) as word_item(
          position integer,
          en text,
          zh text,
          sentence text,
          phonetic text,
          image text
        )
      ) as item
      where length(btrim(coalesce(item.en, ''))) > 0
        and length(btrim(coalesce(item.zh, ''))) > 0
    $insert$ using saved_course.id, normalized_words;
  else
    insert into public.words (
      course_id,
      position,
      en,
      zh,
      sentence,
      phonetic,
      image
    )
    select
      saved_course.id,
      coalesce(item.position, item.fallback_position)::integer,
      btrim(item.en),
      btrim(item.zh),
      coalesce(item.sentence, ''),
      coalesce(item.phonetic, ''),
      coalesce(item.image, '')
    from (
      select
        (row_number() over () - 1)::integer as fallback_position,
        word_item.*
      from jsonb_to_recordset(normalized_words) as word_item(
        position integer,
        en text,
        zh text,
        sentence text,
        phonetic text,
        image text
      )
    ) as item
    where length(btrim(coalesce(item.en, ''))) > 0
      and length(btrim(coalesce(item.zh, ''))) > 0;
  end if;

  get diagnostics inserted_word_count = row_count;

  return query
  select saved_course.id, saved_course.slug, saved_course.name, inserted_word_count, saved_course.sort_order;
end;
$$;

grant execute on function public.save_course_with_words(
  uuid,
  text,
  text,
  text[],
  text[],
  boolean,
  integer,
  jsonb
) to anon, authenticated;

create or replace function public.save_course_with_words(
  p_course_id uuid,
  p_slug text,
  p_name text,
  p_tags text[],
  p_enabled_tasks text[],
  p_is_published boolean,
  p_words jsonb
)
returns table (id uuid, slug text, name text, word_count integer, sort_order integer)
language sql
security invoker
set search_path = public
as $$
  select *
  from public.save_course_with_words(
    p_course_id,
    p_slug,
    p_name,
    p_tags,
    p_enabled_tasks,
    p_is_published,
    null::integer,
    p_words
  );
$$;

grant execute on function public.save_course_with_words(
  uuid,
  text,
  text,
  text[],
  text[],
  boolean,
  jsonb
) to anon, authenticated;

create or replace function public.reorder_courses(
  p_course_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not public.teacher_write_allowed() then
    raise sqlstate '42501' using message = 'Teacher write token is invalid.';
  end if;

  if coalesce(array_length(p_course_ids, 1), 0) = 0 then
    return;
  end if;

  update public.courses
  set sort_order = ranked.sort_order
  from (
    select
      course_id,
      ((ordinality::integer - 1) * 100) as sort_order
    from unnest(p_course_ids) with ordinality as ordered(course_id, ordinality)
  ) as ranked
  where courses.id = ranked.course_id;
end;
$$;

revoke all on function public.reorder_courses(uuid[]) from public;
grant execute on function public.reorder_courses(uuid[]) to anon, authenticated;

-- 課程名稱全域唯一（忽略大小寫與前後空白），避免「新課程」「 新課程 」「新課程」大小寫差異被當成不同課程。
-- 若既有資料已存在重複名稱，先跳過索引建立，讓上方 save_course_with_words 防覆蓋邏輯仍可先套用。
-- 清理重複名稱後重跑 schema，本區塊會補上 courses_name_lower_key。
do $$
begin
  if exists (
    select 1
    from public.courses
    group by lower(btrim(name))
    having count(*) > 1
  ) then
    raise notice 'Skipped courses_name_lower_key because duplicate course names exist. Rename duplicates and rerun schema.sql.';
  else
    execute 'create unique index if not exists courses_name_lower_key on public.courses (lower(btrim(name)))';
  end if;
end;
$$;

create or replace function public.export_course_backup()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.teacher_write_allowed() then
    raise sqlstate '42501' using message = 'Teacher write token is invalid.';
  end if;

  return jsonb_build_object(
    'exported_at', now(),
    'courses', coalesce((
      select jsonb_agg(to_jsonb(c) order by c.sort_order asc, c.updated_at desc)
      from public.courses c
    ), '[]'::jsonb),
    'words', coalesce((
      select jsonb_agg(to_jsonb(w) order by w.course_id, w.position, w.created_at)
      from public.words w
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.export_course_backup() from public;
grant execute on function public.export_course_backup() to anon, authenticated;

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

drop policy if exists "Teachers can read courses" on public.courses;
create policy "Teachers can read courses"
on public.courses
for select
to anon, authenticated
using (public.teacher_write_allowed());

drop policy if exists "Teachers can read words" on public.words;
create policy "Teachers can read words"
on public.words
for select
to anon, authenticated
using (public.teacher_write_allowed());

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

drop policy if exists "Teachers can read maintenance heartbeat" on public.maintenance_heartbeat;
create policy "Teachers can read maintenance heartbeat"
on public.maintenance_heartbeat
for select
to anon, authenticated
using (public.teacher_write_allowed());

drop policy if exists "Teachers can insert maintenance heartbeat" on public.maintenance_heartbeat;
create policy "Teachers can insert maintenance heartbeat"
on public.maintenance_heartbeat
for insert
to anon, authenticated
with check (public.teacher_write_allowed());

drop policy if exists "Teachers can update maintenance heartbeat" on public.maintenance_heartbeat;
create policy "Teachers can update maintenance heartbeat"
on public.maintenance_heartbeat
for update
to anon, authenticated
using (public.teacher_write_allowed())
with check (public.teacher_write_allowed());

-- ---------------------------------------------------------------------------
-- 套用前檢查：courses_name_lower_key（名稱全域唯一）需要既有資料無重複名稱。
-- 若下方查詢有回傳列，schema 會先套用 RPC 防覆蓋邏輯並跳過唯一索引；
-- 請手動合併／改名後重跑 schema.sql，補上 courses_name_lower_key：
--
--   select lower(btrim(name)) as name_key, count(*) as n, array_agg(id) as ids
--   from public.courses
--   group by lower(btrim(name))
--   having count(*) > 1;
-- ---------------------------------------------------------------------------
