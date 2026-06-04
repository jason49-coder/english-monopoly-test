with upserted_course as (
  insert into public.courses (
    slug,
    name,
    tags,
    patterns,
    ask_patterns,
    ask_mode,
    enabled_tasks,
    is_published
  )
  values (
    'unit-1-animals-food',
    'Unit 1 Animals and Food',
    array['animals', 'food'],
    array['I see a ___ .', 'I like ___ .', 'This is a ___ .'],
    array['Do you like ___?', 'Can you see ___?'],
    'auto',
    array['say', 'sentence', 'spell', 'ask', 'act', 'choose'],
    true
  )
  on conflict (slug) do update
  set
    name = excluded.name,
    tags = excluded.tags,
    patterns = excluded.patterns,
    ask_patterns = excluded.ask_patterns,
    ask_mode = excluded.ask_mode,
    enabled_tasks = excluded.enabled_tasks,
    is_published = excluded.is_published,
    updated_at = now()
  returning id
),
deleted_words as (
  delete from public.words
  where course_id = (select id from upserted_course)
)
insert into public.words (course_id, position, word, meaning, category, sentence)
select
  (select id from upserted_course),
  item.position,
  item.word,
  item.meaning,
  item.category,
  item.sentence
from (
  values
    (0, 'cat', '貓', 'animals', 'This is a cat.'),
    (1, 'dog', '狗', 'animals', 'I see a dog.'),
    (2, 'rabbit', '兔子', 'animals', 'The rabbit can jump.'),
    (3, 'apple', '蘋果', 'food', 'I like apples.'),
    (4, 'banana', '香蕉', 'food', 'I want a banana.'),
    (5, 'milk', '牛奶', 'food', 'I drink milk.'),
    (6, 'red', '紅色', 'colors', 'It is red.'),
    (7, 'blue', '藍色', 'colors', 'I see blue.')
) as item(position, word, meaning, category, sentence);
