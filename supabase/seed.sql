with upserted_course as (
  insert into public.courses (
    slug,
    name,
    tags,
    enabled_tasks,
    is_published,
    sort_order
  )
  values (
    'unit-1-animals-food',
    'Unit 1 Animals and Food',
    array['animals', 'food'],
    array['say', 'sentence', 'spell', 'ask', 'act', 'choose'],
    true,
    0
  )
  on conflict (slug) do update
  set
    name = excluded.name,
    tags = excluded.tags,
    enabled_tasks = excluded.enabled_tasks,
    is_published = excluded.is_published,
    sort_order = excluded.sort_order,
    updated_at = now()
  returning id
),
deleted_words as (
  delete from public.words
  where course_id = (select id from upserted_course)
)
insert into public.words (course_id, position, en, zh, sentence, phonetic, image)
select
  (select id from upserted_course),
  item.position,
  item.en,
  item.zh,
  item.sentence,
  '',
  ''
from (
  values
    (0, 'cat', '貓', 'This is a cat.'),
    (1, 'dog', '狗', 'I see a dog.'),
    (2, 'rabbit', '兔子', 'The rabbit can jump.'),
    (3, 'apple', '蘋果', 'I like apples.'),
    (4, 'banana', '香蕉', 'I want a banana.'),
    (5, 'milk', '牛奶', 'I drink milk.'),
    (6, 'red', '紅色', 'It is red.'),
    (7, 'blue', '藍色', 'I see blue.')
) as item(position, en, zh, sentence);
