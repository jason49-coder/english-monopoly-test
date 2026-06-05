const MAX_WORDS = 500;
const MAX_TEXT_LENGTH = 1000;
const VALID_TASKS = new Set(["say", "sentence", "spell", "ask", "act", "choose"]);
const VALID_ASK_MODES = new Set(["auto", "template", "student"]);
const WRITE_ENV_KEYS = ["TEACHER_WRITE_TOKEN", "SUPABASE_ACCESS_TOKEN", "SUPABASE_PROJECT_REF"] as const;

declare const Netlify: { env?: { get?: (name: string) => string | undefined } } | undefined;
declare const process: { env?: Record<string, string | undefined> } | undefined;

export default async (req: Request) => {
  if (req.method === "OPTIONS") {
    return jsonResponse({}, 204);
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const expectedToken = getEnv("TEACHER_WRITE_TOKEN");
  const accessToken = getEnv("SUPABASE_ACCESS_TOKEN");
  const projectRef = getEnv("SUPABASE_PROJECT_REF");

  const envValues = {
    TEACHER_WRITE_TOKEN: expectedToken,
    SUPABASE_ACCESS_TOKEN: accessToken,
    SUPABASE_PROJECT_REF: projectRef,
  };
  const missingEnv = WRITE_ENV_KEYS.filter((name) => !envValues[name]);

  if (missingEnv.length) {
    return jsonResponse({
      error: "Supabase write environment is not configured.",
      missing: missingEnv,
    }, 500);
  }

  const token = readBearerToken(req.headers.get("Authorization")) || req.headers.get("x-teacher-token") || "";
  if (!timingSafeEqual(token, expectedToken)) {
    return jsonResponse({ error: "Invalid teacher write token." }, 401);
  }

  let body;
  try {
    body = await req.json();
  } catch (error) {
    return jsonResponse({ error: "Invalid JSON body." }, 400);
  }

  let lesson;
  try {
    lesson = normalizeLesson(body?.lesson);
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Invalid lesson." }, 400);
  }

  try {
    const result = await executeSupabaseSql(projectRef, accessToken, buildUpsertCourseSql(lesson));
    const saved = result?.value?.[0] || {};

    return jsonResponse({
      id: saved.id,
      slug: saved.slug || lesson.slug,
      name: saved.name || lesson.name,
      wordCount: Number(saved.word_count) || lesson.words.length,
    });
  } catch (error) {
    console.error("Supabase course write failed", error);
    return jsonResponse({ error: "Supabase write failed." }, 502);
  }
};

export const config = {
  path: "/api/courses",
};

function getEnv(name: string) {
  const globals = globalThis as typeof globalThis & {
    Netlify?: { env?: { get?: (key: string) => string | undefined } };
    process?: { env?: Record<string, string | undefined> };
  };

  const netlifyEnv = typeof Netlify !== "undefined" ? Netlify?.env?.get?.(name) : "";
  const processEnv = typeof process !== "undefined" ? process?.env?.[name] : "";

  return netlifyEnv
    || processEnv
    || globals.Netlify?.env?.get?.(name)
    || globals.process?.env?.[name]
    || "";
}

function readBearerToken(value: string | null) {
  const match = String(value || "").match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function timingSafeEqual(a: string, b: string) {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  let mismatch = left.length ^ right.length;
  const length = Math.max(left.length, right.length);

  for (let index = 0; index < length; index += 1) {
    mismatch |= (left[index] || 0) ^ (right[index] || 0);
  }

  return mismatch === 0;
}

function normalizeLesson(value: unknown) {
  const source = typeof value === "object" && value ? value as Record<string, unknown> : {};
  const name = sanitizeText(source.name, 120) || "Untitled lesson";
  const slug = createCourseSlug(source.slug || name);
  const words = Array.isArray(source.words)
    ? source.words.slice(0, MAX_WORDS).map(normalizeWord).filter((item) => item.word)
    : [];

  if (!words.length) {
    throw new Error("At least one word is required.");
  }

  return {
    name,
    slug,
    tags: normalizeTextArray(source.tags, 40, 40),
    patterns: normalizeTextArray(source.patterns, 40, 160, ["I see a ___ ."]),
    askMode: VALID_ASK_MODES.has(String(source.askMode)) ? String(source.askMode) : "auto",
    askPatterns: normalizeTextArray(source.askPatterns, 40, 160, ["Do you like ___?", "Can you see ___?"]),
    enabledTasks: normalizeTasks(source.enabledTasks),
    words,
  };
}

function normalizeWord(value: unknown) {
  const source = typeof value === "object" && value ? value as Record<string, unknown> : {};
  return {
    word: sanitizeText(source.word, 120),
    meaning: sanitizeText(source.meaning, 180),
    category: sanitizeText(source.category, 80),
    sentence: sanitizeText(source.sentence, 300),
  };
}

function normalizeTextArray(value: unknown, maxItems: number, maxLength: number, fallback: string[] = []) {
  const source = Array.isArray(value)
    ? value
    : String(value || "").split(/\r?\n|,/);
  const normalized = [...new Set(source
    .map((item) => sanitizeText(item, maxLength))
    .filter(Boolean))]
    .slice(0, maxItems);

  return normalized.length ? normalized : fallback;
}

function normalizeTasks(value: unknown) {
  const tasks = Array.isArray(value) ? value.map((item) => String(item)) : [];
  const normalized = [...new Set(tasks.filter((item) => VALID_TASKS.has(item)))];
  return normalized.length ? normalized : ["say", "sentence", "spell"];
}

function sanitizeText(value: unknown, maxLength = MAX_TEXT_LENGTH) {
  return String(value || "")
    .replaceAll("\u0000", "")
    .trim()
    .slice(0, maxLength);
}

function createCourseSlug(value: unknown) {
  const slug = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "my-course";
}

function buildUpsertCourseSql(lesson: ReturnType<typeof normalizeLesson>) {
  const lessonJson = sqlJsonLiteral(lesson);

  return `
with input as (
  select ${lessonJson} as lesson
),
upserted_course as (
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
  select
    lesson->>'slug',
    lesson->>'name',
    coalesce(array(select jsonb_array_elements_text(coalesce(lesson->'tags', '[]'::jsonb))), array[]::text[]),
    coalesce(array(select jsonb_array_elements_text(coalesce(lesson->'patterns', '[]'::jsonb))), array['I see a ___ .']::text[]),
    coalesce(array(select jsonb_array_elements_text(coalesce(lesson->'askPatterns', '[]'::jsonb))), array['Do you like ___?', 'Can you see ___?']::text[]),
    lesson->>'askMode',
    coalesce(array(select jsonb_array_elements_text(coalesce(lesson->'enabledTasks', '[]'::jsonb))), array['say', 'sentence', 'spell']::text[]),
    true
  from input
  on conflict (slug) do update
  set
    name = excluded.name,
    tags = excluded.tags,
    patterns = excluded.patterns,
    ask_patterns = excluded.ask_patterns,
    ask_mode = excluded.ask_mode,
    enabled_tasks = excluded.enabled_tasks,
    is_published = true,
    updated_at = now()
  returning id, slug, name
),
deleted_words as (
  delete from public.words
  where course_id = (select id from upserted_course)
),
inserted_words as (
  insert into public.words (course_id, position, word, meaning, category, sentence)
  select
    (select id from upserted_course),
    (item.ordinality - 1)::integer,
    item.value->>'word',
    coalesce(item.value->>'meaning', ''),
    coalesce(item.value->>'category', ''),
    coalesce(item.value->>'sentence', '')
  from input
  cross join lateral jsonb_array_elements(coalesce(lesson->'words', '[]'::jsonb)) with ordinality as item(value, ordinality)
  where length(btrim(coalesce(item.value->>'word', ''))) > 0
  order by item.ordinality
  returning id
)
select
  (select id::text from upserted_course) as id,
  (select slug from upserted_course) as slug,
  (select name from upserted_course) as name,
  (select count(*) from inserted_words)::integer as word_count;
`.trim();
}

function sqlJsonLiteral(value: unknown) {
  return `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
}

async function executeSupabaseSql(projectRef: string, accessToken: string, query: string) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${encodeURIComponent(projectRef)}/database/query`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message || payload.error || `Supabase Management API error ${response.status}`);
  }

  return payload;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
