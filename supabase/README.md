# Supabase database setup

This project stores shared course data in two public-schema tables:

- `courses`: lesson metadata, sentence patterns, task settings, and publish state.
- `words`: vocabulary rows that belong to a course.

## Create the database tables

1. Open your Supabase project dashboard.
2. Go to SQL Editor.
3. Paste and run `supabase/schema.sql`.
4. Confirm that `courses` and `words` exist in Table Editor.

The schema enables Row Level Security. Public browser clients can read only published courses and their words. Browser write access is intentionally not enabled yet.

## Environment values

After creating a Supabase project, add these values to the local `.env` file:

```env
SUPABASE_ACCESS_TOKEN=
SUPABASE_PROJECT_REF=
SUPABASE_URL=
SUPABASE_ANON_KEY=
TEACHER_WRITE_TOKEN=
```

Use the Project URL and anon/publishable key from Supabase project settings. Do not put a service role key in browser code.
`TEACHER_WRITE_TOKEN` is the shared teacher password used by the Netlify Function before it writes course data.

## Seed the first course

Run `supabase/seed.sql` after `supabase/schema.sql` to create the starter course:

- `Unit 1 Animals and Food`
- 8 vocabulary words

The seed is safe to rerun. It upserts the course by slug and refreshes that course's word list.
