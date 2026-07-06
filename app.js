const STORAGE_KEY = "english-monopoly-mvp-v1";
const COURSE_LIBRARY_KEY = "english-monopoly-course-library-v1";
const TEACHER_WRITE_TOKEN_KEY = "english-monopoly-teacher-write-token-v1";
const SUPABASE_PUBLIC_CONFIG = {
  url: "https://ybbttuzmwfxwigllfxda.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InliYnR0dXptd2Z4d2lnbGxmeGRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1ODgwMzQsImV4cCI6MjA5NjE2NDAzNH0.WtcBOa22ZecFStci2uo7hG1bk0mU6YEbiqAsMtzOyiA",
};
const SUPABASE_SCRIPT_SRC = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
const COURSE_AUTOSAVE_DELAY = 3200;
const CLOUD_SYNC_MAX_ATTEMPTS = 8;
const CLOUD_SYNC_RETRY_DELAY = 8000;

const taskLabels = {
  say: "Read the word",
  sentence: "Make a sentence",
  spell: "Spell the word",
  ask: "Answer a question",
  act: "Performance",
  choose: "Choose the Answer",
};

const defaultLesson = {
  name: "Unit 1 Animals and Food",
  slug: "unit-1-animals-food",
  tags: ["animals", "food"],
  enabledTasks: ["say", "sentence", "spell", "ask", "act", "choose"],
  words: [
    { en: "cat", zh: "貓" },
    { en: "dog", zh: "狗" },
    { en: "rabbit", zh: "兔子" },
    { en: "apple", zh: "蘋果" },
    { en: "banana", zh: "香蕉" },
    { en: "milk", zh: "牛奶" },
    { en: "red", zh: "紅色" },
    { en: "blue", zh: "藍色" },
  ],
};

const teamColors = ["#e85648", "#138b84", "#3b82f6", "#7c3aed"];
const TEAM_AVATARS = ["🐰", "🐻", "🦁", "🐯", "🐸", "🐼", "🦊", "🐨"];

const defaultTeams = [
  { id: "red", name: "Red Team", color: teamColors[0], position: 0, score: 0, avatar: "🐰" },
  { id: "green", name: "Green Team", color: teamColors[1], position: 0, score: 0, avatar: "🐻" },
  { id: "blue", name: "Blue Team", color: teamColors[2], position: 0, score: 0, avatar: "🦁" },
];

const legacyTeamNames = {
  "紅隊": "Red Team",
  "綠隊": "Green Team",
  "藍隊": "Blue Team",
};

const tilePath = [
  [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1],
  [7, 2], [7, 3], [7, 4], [7, 5], [7, 6], [7, 7],
  [6, 7], [5, 7], [4, 7], [3, 7], [2, 7], [1, 7],
  [1, 6], [1, 5], [1, 4], [1, 3], [1, 2],
];

const boardTypes = [
  "start", "word", "sentence", "spell", "action", "chance",
  "word", "sentence", "spell", "action", "chance", "word",
  "sentence", "spell", "action", "chance", "word", "sentence",
  "spell", "action", "chance", "word", "sentence", "spell",
];

const tileTypeText = {
  start: "起點",
  word: "Read the word",
  sentence: "Make a sentence",
  spell: "Spell the word",
  ask: "Answer a question",
  action: "Performance",
  choose: "Choose the Answer",
  chance: "機會卡",
};

const boardTileText = {
  start: { label: "起點", title: "出發", short: "起點", meta: "+100", tooltip: "經過起點有獎勵" },
  word: { label: "Read the word", title: "Read", short: "Read", meta: "Read", tooltip: "Read the word" },
  sentence: { label: "Make a sentence", title: "Make", short: "Make", meta: "Make", tooltip: "Make a sentence" },
  spell: { label: "Spell the word", title: "Spell", short: "Spell", meta: "Spell", tooltip: "Spell the word" },
  ask: { label: "Answer a question", title: "Question", short: "Q&A", meta: "Q&A", tooltip: "Answer a question" },
  action: { label: "Performance", title: "Act", short: "Act", meta: "Act", tooltip: "Performance" },
  choose: { label: "Choose the Answer", title: "Choose", short: "Choose", meta: "Choose", tooltip: "Choose the Answer" },
  chance: { label: "機會卡", title: "幸運卡", short: "?", meta: "驚喜任務", tooltip: "抽一張驚喜任務卡" },
};


let state = loadState();
let toastTimer = null;
let celebrationTimer = null;
let memoryFeedbackTimer = null;
let courseAutosaveTimer = null;
let courseAutosaveQueued = false;
let supabaseClient = null;
let supabaseScriptPromise = null;
let cloudCourseLibrary = [];
let teacherAccessUnlocked = false;
const cloudSave = {
  saving: false,
  verifying: false,
  operation: "",
  tokenStatus: "empty",
  tokenMessage: "",
};
const cloudSync = {
  status: "idle",
  message: "",
  retryTimer: null,
};
const courseDelete = {
  pendingCourseId: "",
  deletingCourseId: "",
};
const teacherUi = {
  expandedWordIndexes: new Set(),
};
const animation = {
  rolling: false,
  movingTeamId: null,
  diceValue: null,
  celebrate: false,
  celebrationMessage: "",
  memoryFeedback: null,
};

const gameCatalog = {
  monopoly: {
    title: "美語大富翁",
    badge: "多人輪流",
    icon: "🎲",
    summary: "擲骰前進，走到格子後完成 Read the word、Make a sentence、Spell the word 或機會卡任務。",
    action: "玩大富翁",
  },
  memory: {
    title: "記憶翻牌",
    badge: "英文配中文",
    icon: "🃏",
    summary: "輪流翻兩張牌，把英文單字和中文意思配成一組。",
    action: "玩翻牌",
  },
};
applyRouteView();
ensureGameShape();

function loadState() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (stored && stored.lesson && stored.game) {
      return stored;
    }
  } catch (error) {
    console.warn("Unable to load saved state", error);
  }

  return {
    view: "game",
    chromeCollapsed: true,
    activeGame: "hub",
    lesson: structuredClone(defaultLesson),
    courseEditor: freshCourseEditorState("new"),
    game: freshGameState(),
    memory: null,
    toast: "",
  };
}

function freshGameState(options = {}) {
  const wordCount = Number.isFinite(Number(options.wordCount))
    ? Math.max(0, Number(options.wordCount))
    : defaultLesson.words.length;
  const teams = options.teams || defaultTeams;
  const enabledTasks = normalizeTaskList(options.enabledTasks || defaultLesson.enabledTasks, defaultLesson.enabledTasks);

  return {
    teams: resetTeams(teams),
    enabledTasks,
    started: Boolean(options.started),
    currentTeamIndex: 0,
    dice: 1,
    phase: "ready",
    currentTask: null,
    currentTile: 0,
    wordDrawPile: buildWordDrawPile(wordCount),
    lastWordIndex: null,
    round: 1,
    log: ["遊戲準備好了。"],
  };
}

function freshMemoryState(options = {}) {
  const teams = options.teams || defaultTeams;
  const maxPairs = Math.min(12, getLessonWords().length);
  const pairCount = maxPairs ? clamp(Number(options.pairCount) || 6, 1, maxPairs) : 0;
  const imageMode = Boolean(options.imageMode);

  return {
    started: Boolean(options.started),
    pairCount,
    imageMode,
    cards: buildMemoryCards(pairCount, imageMode),
    flippedIds: [],
    matchedIds: [],
    scores: Object.fromEntries(teams.map((team) => [team.id, 0])),
    currentTeamIndex: 0,
    locked: false,
    moves: 0,
    log: [imageMode ? "翻兩張牌，把圖片和英文配成一組！" : "選兩張牌，把英文和中文配成一組。"],
  };
}

function resetTeams(teams) {
  return structuredClone(teams).map((team, index) => ({
    id: team.id || `team-${index + 1}`,
    name: normalizeTeamName(team.name, index),
    color: team.color || teamColors[index % teamColors.length],
    avatar: team.avatar || TEAM_AVATARS[index % TEAM_AVATARS.length],
    position: 0,
    score: 0,
  }));
}

function getDefaultTeamName(index) {
  return `Team ${index + 1}`;
}

function normalizeTeamName(name, index = 0) {
  const fallback = getDefaultTeamName(index);
  const text = String(name || "").trim();
  if (!text) return fallback;

  const numberedTeam = text.match(/^第\s*(\d+)\s*隊$/);
  if (numberedTeam) return `Team ${numberedTeam[1]}`;

  return legacyTeamNames[text] || text;
}

function buildWordDrawPile(wordCount) {
  const safeWordCount = Math.max(0, wordCount);
  return shuffle(Array.from({ length: safeWordCount }, (_, wordIndex) => wordIndex));
}

function buildMemoryCards(pairCount, imageMode = false) {
  const words = shuffle(getLessonWords()).slice(0, pairCount);
  const cards = words.flatMap((item, index) => {
    const pairId = `pair-${index}`;
    if (imageMode && item.image) {
      return [
        {
          id: `${pairId}-img`,
          pairId,
          kind: "圖片",
          text: item.en,
          image: item.image,
          answer: item.en,
        },
        {
          id: `${pairId}-word`,
          pairId,
          kind: "英文",
          text: item.en,
          answer: item.en,
        },
      ];
    }
    return [
      {
        id: `${pairId}-word`,
        pairId,
        kind: "英文",
        text: item.en,
        answer: item.zh || item.en,
      },
      {
        id: `${pairId}-meaning`,
        pairId,
        kind: "中文",
        text: item.zh || item.en,
        answer: item.en,
      },
    ];
  });

  return shuffle(cards);
}

function ensureMemoryShape() {
  const maxPairs = Math.min(12, getLessonWords().length);
  const pairCount = maxPairs ? clamp(Number(state.memory?.pairCount) || 6, 1, maxPairs) : 0;
  const imageMode = Boolean(state.memory?.imageMode);
  const validCards = Array.isArray(state.memory?.cards)
    && state.memory.cards.length === pairCount * 2
    && state.memory.cards.every((card) => card?.id && card?.pairId && card?.text);

  if (!state.memory || !validCards) {
    state.memory = freshMemoryState({
      teams: state.game.teams,
      pairCount,
      imageMode,
      started: false,
    });
  }

  state.memory.pairCount = pairCount;
  state.memory.imageMode = Boolean(state.memory.imageMode);
  state.memory.flippedIds = Array.isArray(state.memory.flippedIds) ? state.memory.flippedIds : [];
  state.memory.matchedIds = Array.isArray(state.memory.matchedIds) ? state.memory.matchedIds : [];
  state.memory.log = Array.isArray(state.memory.log) ? state.memory.log : ["選兩張牌，把英文和中文配成一組。"];
  state.memory.scores = state.memory.scores && typeof state.memory.scores === "object" ? state.memory.scores : {};
  state.game.teams.forEach((team) => {
    if (!Number.isFinite(state.memory.scores[team.id])) {
      state.memory.scores[team.id] = 0;
    }
  });
  Object.keys(state.memory.scores).forEach((teamId) => {
    if (!state.game.teams.some((team) => team.id === teamId)) {
      delete state.memory.scores[teamId];
    }
  });
  if (!Number.isInteger(state.memory.currentTeamIndex) || state.memory.currentTeamIndex >= state.game.teams.length) {
    state.memory.currentTeamIndex = 0;
  }
  state.memory.locked = Boolean(state.memory.locked);
  state.memory.started = Boolean(state.memory.started);
  state.memory.moves = Number(state.memory.moves) || 0;

  if (!maxPairs) {
    state.memory.started = false;
    state.memory.locked = false;
    state.memory.cards = [];
    state.memory.flippedIds = [];
    state.memory.matchedIds = [];
  }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function ensureGameShape() {
  state.lesson = normalizeLesson(state.lesson || defaultLesson);
  ensureCourseEditorShape();

  if (!["hub", "monopoly", "memory"].includes(state.activeGame)) {
    state.activeGame = "hub";
  }

  if (typeof state.chromeCollapsed !== "boolean") {
    state.chromeCollapsed = state.view === "game";
  }

  if (!state.game) {
    state.game = freshGameState({ wordCount: getLessonWords().length });
  }

  if (!Array.isArray(state.game.teams) || !state.game.teams.length) {
    state.game.teams = resetTeams(defaultTeams);
  }

  state.game.enabledTasks = normalizeTaskList(
    state.game.enabledTasks || state.lesson?.enabledTasks,
    defaultLesson.enabledTasks,
  );

  if (typeof state.game.started !== "boolean") {
    state.game.started = false;
  }

  state.game.teams.forEach((team, index) => {
    team.name = normalizeTeamName(team.name, index);
    delete team.stars;
  });

  const wordCount = getLessonWords().length;
  const pile = state.game.wordDrawPile;
  const validPile = Array.isArray(pile)
    && pile.every((wordIndex) => Number.isInteger(wordIndex) && wordIndex >= 0 && wordIndex < wordCount);

  if (!validPile) {
    state.game.wordDrawPile = buildWordDrawPile(wordCount);
  }

  if (!wordCount) {
    state.game.started = false;
    state.game.phase = "ready";
    state.game.currentTask = null;
    state.game.wordDrawPile = [];
    state.game.lastWordIndex = null;
  }

  if (state.game.boardWordOrder) {
    delete state.game.boardWordOrder;
  }

  if (state.game.lastWordIndex !== null && (
    !Number.isInteger(state.game.lastWordIndex)
    || state.game.lastWordIndex < 0
    || state.game.lastWordIndex >= wordCount
  )) {
    state.game.lastWordIndex = null;
  }

  ensureMemoryShape();
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    view: state.view,
    chromeCollapsed: state.chromeCollapsed,
    activeGame: state.activeGame,
    lesson: state.lesson,
    courseEditor: state.courseEditor,
    game: state.game,
    memory: state.memory,
  }));
}

function loadCourseLibrary() {
  return cloudCourseLibrary
    .map(normalizeSavedCourse)
    .filter(Boolean)
    .sort(compareSavedCourses);
}

function saveCourseLibrary(courses) {
  cloudCourseLibrary = Array.isArray(courses)
    ? courses.map(normalizeSavedCourse).filter(Boolean).sort(compareSavedCourses)
    : [];
  clearLegacyLocalCourseLibrary();
}

function compareSavedCourses(a, b) {
  const orderDiff = getSavedCourseSortOrder(a) - getSavedCourseSortOrder(b);
  if (orderDiff) return orderDiff;

  const updatedDiff = (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0);
  if (updatedDiff) return updatedDiff;

  return String(a.lesson?.name || "").localeCompare(String(b.lesson?.name || ""), "zh-Hant");
}

function getSavedCourseSortOrder(course) {
  const value = Number(course?.sortOrder);
  return Number.isFinite(value) ? value : 0;
}

function assignCourseSortOrders(courses) {
  return courses
    .map((course, index) => normalizeSavedCourse({
      ...course,
      sortOrder: index * 100,
    }))
    .filter(Boolean);
}

function getNewCourseSortOrder() {
  const courses = loadCourseLibrary();
  if (!courses.length) return 0;
  return Math.min(...courses.map(getSavedCourseSortOrder)) - 100;
}

function clearLegacyLocalCourseLibrary() {
  try {
    localStorage.removeItem(COURSE_LIBRARY_KEY);
  } catch (error) {
    console.warn("Unable to clear legacy local course library", error);
  }
}

function getSupabaseConfig() {
  const override = window.ENGLISH_MONOPOLY_SUPABASE || {};
  return {
    url: override.url || SUPABASE_PUBLIC_CONFIG.url,
    anonKey: override.anonKey || SUPABASE_PUBLIC_CONFIG.anonKey,
  };
}

function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;

  const { url, anonKey } = getSupabaseConfig();
  if (!url || !anonKey || typeof window.supabase?.createClient !== "function") {
    return null;
  }

  supabaseClient = window.supabase.createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
  return supabaseClient;
}

async function getSupabaseClientAsync() {
  let client = getSupabaseClient();
  if (client) return client;

  await loadSupabaseScript();
  client = getSupabaseClient();
  if (!client) {
    throw new Error("Supabase SDK loaded, but createClient is unavailable.");
  }
  return client;
}

function loadSupabaseScript() {
  if (typeof window.supabase?.createClient === "function") {
    return Promise.resolve();
  }

  if (supabaseScriptPromise) return supabaseScriptPromise;

  supabaseScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const timeout = setTimeout(() => {
      script.remove();
      reject(new Error("Supabase SDK load timed out."));
    }, 6000);

    script.src = SUPABASE_SCRIPT_SRC;
    script.async = true;
    script.onload = () => {
      clearTimeout(timeout);
      resolve();
    };
    script.onerror = () => {
      clearTimeout(timeout);
      reject(new Error("Supabase SDK failed to load."));
    };

    (document.head || document.body).appendChild(script);
  });

  return supabaseScriptPromise;
}

async function syncCloudCourseLibrary(attempt = 1) {
  clearTimeout(cloudSync.retryTimer);
  cloudSync.retryTimer = null;

  try {
    const client = await getSupabaseClientAsync();
    const cloudCourses = await fetchCloudCourses(client, isTeacherUnlocked() ? getTeacherWriteToken() : "");
    cloudSync.status = "ready";
    cloudSync.message = "";
    saveCourseLibrary(cloudCourses);
    if (!cloudCourses.length) {
      render();
      return;
    }

    const course = chooseCloudCourse(cloudCourses);
    let loadedCourseName = "";
    if (course && canReplaceActiveLesson()) {
      setActiveLesson(course.lesson);
      setCourseEditorCourse(course);
      loadedCourseName = course.lesson.name;
    }

    if (loadedCourseName) {
      showToast(`已從雲端載入課程：${loadedCourseName}`);
    }
    render();
  } catch (error) {
    console.warn("Unable to load Supabase courses.", error);
    if (attempt < CLOUD_SYNC_MAX_ATTEMPTS) {
      cloudSync.status = "retrying";
      cloudSync.message = `雲端資料庫啟動中，正在重試 (${attempt}/${CLOUD_SYNC_MAX_ATTEMPTS})`;
      cloudSync.retryTimer = setTimeout(() => {
        syncCloudCourseLibrary(attempt + 1);
      }, CLOUD_SYNC_RETRY_DELAY);
      render();
      return;
    }

    cloudSync.status = "error";
    cloudSync.message = "雲端資料庫暫時無法連線，請稍後重新整理。";
    saveCourseLibrary([]);
    render();
  }
}

async function fetchCloudCourses(client, teacherToken = "") {
  if (teacherToken) {
    try {
      return await fetchTeacherCloudCourses(teacherToken);
    } catch (error) {
      console.warn("Unable to fetch teacher courses; falling back to published courses.", error);
    }
  }

  let { data: courses, error: coursesError } = await client
    .from("courses")
    .select("id, slug, name, tags, enabled_tasks, sort_order, created_at, updated_at")
    .eq("is_published", true)
    .order("sort_order", { ascending: true })
    .order("updated_at", { ascending: false });

  if (isMissingSortOrderError(coursesError)) {
    const fallback = await client
      .from("courses")
      .select("id, slug, name, tags, enabled_tasks, created_at, updated_at")
      .eq("is_published", true)
      .order("updated_at", { ascending: false });
    courses = fallback.data;
    coursesError = fallback.error;
  }

  if (coursesError) throw coursesError;
  if (!Array.isArray(courses) || !courses.length) return [];

  const courseIds = courses.map((course) => course.id).filter(Boolean);
  const wordsByCourseId = new Map(courseIds.map((courseId) => [courseId, []]));

  if (courseIds.length) {
    const { data: words, error: wordsError } = await client
      .from("words")
      .select("course_id, position, en, zh, sentence, phonetic, image, created_at")
      .in("course_id", courseIds)
      .order("course_id", { ascending: true })
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });

    if (wordsError) throw wordsError;
    (words || []).forEach((item) => {
      if (!wordsByCourseId.has(item.course_id)) {
        wordsByCourseId.set(item.course_id, []);
      }
      wordsByCourseId.get(item.course_id).push(normalizeWord(item));
    });
  }

  return courses
    .map((course) => mapCloudCourse(course, wordsByCourseId.get(course.id) || []))
    .filter(Boolean);
}

async function fetchTeacherCloudCourses(token) {
  let courses;
  try {
    const coursesResponse = await fetchSupabaseRest(
      "courses?select=id,slug,name,tags,enabled_tasks,sort_order,created_at,updated_at,is_published&order=sort_order.asc,updated_at.desc",
      token
    );
    courses = await parseSupabaseResponse(coursesResponse);
  } catch (error) {
    if (!isMissingSortOrderError(error)) throw error;
    const fallbackResponse = await fetchSupabaseRest(
      "courses?select=id,slug,name,tags,enabled_tasks,created_at,updated_at,is_published&order=updated_at.desc",
      token
    );
    courses = await parseSupabaseResponse(fallbackResponse);
  }

  if (!Array.isArray(courses) || !courses.length) return [];

  const courseIds = courses.map((course) => course.id).filter(Boolean);
  const wordsByCourseId = new Map(courseIds.map((courseId) => [courseId, []]));

  if (courseIds.length) {
    const idFilter = courseIds.map((courseId) => encodeURIComponent(courseId)).join(",");
    const wordsResponse = await fetchSupabaseRest(
      `words?select=course_id,position,en,zh,sentence,phonetic,image,created_at&course_id=in.(${idFilter})&order=course_id.asc,position.asc,created_at.asc`,
      token
    );
    const words = await parseSupabaseResponse(wordsResponse);
    (words || []).forEach((item) => {
      if (!wordsByCourseId.has(item.course_id)) {
        wordsByCourseId.set(item.course_id, []);
      }
      wordsByCourseId.get(item.course_id).push(normalizeWord(item));
    });
  }

  return courses
    .map((course) => mapCloudCourse(course, wordsByCourseId.get(course.id) || []))
    .filter(Boolean);
}

function mapCloudCourse(course, words) {
  return normalizeSavedCourse({
    id: course.id,
    lesson: {
      name: course.name,
      slug: course.slug,
      tags: course.tags || [],
      enabledTasks: course.enabled_tasks || [],
      words,
    },
    createdAt: Date.parse(course.created_at),
    updatedAt: Date.parse(course.updated_at),
    sortOrder: Number(course.sort_order),
  });
}

function chooseCloudCourse(cloudCourses) {
  const requestedSlug = getRequestedCourseSlug();
  const currentSlug = createCourseSlug(state.lesson?.slug || state.lesson?.name);
  const defaultSlug = createCourseSlug(defaultLesson.slug);

  if (requestedSlug) {
    const requestedCourse = cloudCourses.find((course) => (
      createCourseSlug(course.lesson.slug || course.lesson.name) === requestedSlug
    ));
    if (requestedCourse) return requestedCourse;
  }

  const matchingCourse = cloudCourses.find((course) => (
    createCourseSlug(course.lesson.slug || course.lesson.name) === currentSlug
  ));
  if (matchingCourse) return matchingCourse;

  return currentSlug === defaultSlug ? cloudCourses[0] : null;
}

function getRequestedCourseSlug() {
  const params = new URLSearchParams(window.location.search);
  const value = params.get("course") || params.get("lesson") || params.get("slug");
  return value ? createCourseSlug(value) : "";
}

function canReplaceActiveLesson() {
  return !isBusy() && !state.game?.started && !state.memory?.started;
}

function setActiveLesson(lesson) {
  state.lesson = normalizeLesson(lesson);
  state.game = freshGameState({
    teams: state.game?.teams?.length ? state.game.teams : defaultTeams,
    wordCount: getLessonWords().length,
    enabledTasks: state.lesson.enabledTasks,
  });
  state.memory = freshMemoryState({ teams: state.game.teams });
  state.activeGame = "hub";
}

function freshCourseEditorState(mode = "new", course = null) {
  const lesson = course?.lesson ? normalizeLesson(course.lesson) : null;
  return {
    mode: mode === "existing" ? "existing" : "new",
    selectedCourseId: course?.id || "",
    lockedSlug: lesson ? createCourseSlug(lesson.slug || lesson.name) : "",
  };
}

function ensureCourseEditorShape() {
  const editor = state.courseEditor && typeof state.courseEditor === "object"
    ? state.courseEditor
    : freshCourseEditorState("new");

  // 課程身份只認 selectedCourseId（真正的課程 UUID），而且只由明確操作設定：
  // 點課程清單「編輯」(loadCourseById)、雲端載入、以及存檔成功後。
  // 這裡「絕不」從 slug/name 文字反推「這份草稿其實是某門既有課程」，
  // 所以全新草稿永遠不會在打字/render 時被自動綁到別門課的 id 上、再被 autosave 覆蓋。
  if (editor.mode === "existing" && editor.selectedCourseId) {
    const courses = loadCourseLibrary();
    const selectedCourse = courses.find((course) => course.id === editor.selectedCourseId);
    if (selectedCourse) {
      state.courseEditor = freshCourseEditorState("existing", selectedCourse);
      return;
    }
    // 綁定的課程已不在課程庫。只有在課程庫「確實載入且不含此 id」時才降級為新草稿；
    // 若課程庫還是空的（初次雲端同步尚未完成），保留原綁定，等同步後再依 id 解析，
    // 避免重整編輯中課程時暫時掉成新草稿而弄丟 id。
    if (courses.length) {
      state.courseEditor = freshCourseEditorState("new");
      return;
    }
    state.courseEditor = {
      mode: "existing",
      selectedCourseId: editor.selectedCourseId,
      lockedSlug: editor.lockedSlug || "",
    };
    return;
  }

  state.courseEditor = freshCourseEditorState("new");
}

function setCourseEditorCourse(course) {
  state.courseEditor = freshCourseEditorState("existing", course);
}

function setCourseEditorForLesson(lesson, preferredCourse = null) {
  const course = preferredCourse || findCourseBySlug(lesson?.slug || lesson?.name);
  state.courseEditor = course ? freshCourseEditorState("existing", course) : freshCourseEditorState("new");
}

function getSelectedCourse() {
  const editor = state.courseEditor || {};
  if (editor.mode !== "existing" || !editor.selectedCourseId) return null;
  return loadCourseLibrary().find((course) => course.id === editor.selectedCourseId) || null;
}

function findCourseBySlug(slug, courses = loadCourseLibrary()) {
  if (!String(slug || "").trim()) return null;
  const normalizedSlug = createCourseSlug(slug);
  return courses.find((course) => (
    createCourseSlug(course.lesson?.slug || course.lesson?.name) === normalizedSlug
  )) || null;
}

function isEditingExistingCourse() {
  return state.courseEditor?.mode === "existing" && Boolean(getSelectedCourse());
}

function createBlankLesson() {
  return {
    name: createUniqueCourseName("新課程"),
    slug: createUniqueCourseSlug("new-course"),
    tags: [],
    enabledTasks: [...defaultLesson.enabledTasks],
    words: [],
  };
}

function createUniqueCourseSlug(baseSlug, ignoreCourseId = "") {
  const courses = loadCourseLibrary();
  const base = createCourseSlug(baseSlug || "new-course");
  let slug = base;
  let suffix = 2;

  while (courses.some((course) => (
    course.id !== ignoreCourseId
    && createCourseSlug(course.lesson?.slug || course.lesson?.name) === slug
  ))) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }

  return slug;
}

// 產生一個尚未被使用的課程名稱（忽略大小寫與前後空白），與 courses_name_lower_key 唯一約束對齊。
// 新草稿的預設名稱（「新課程」「X 副本」等）若不去重，之後自動建立時會直接撞名而失敗。
function createUniqueCourseName(baseName, ignoreCourseId = "") {
  const courses = loadCourseLibrary();
  const base = String(baseName || "新課程").trim() || "新課程";
  const isTaken = (candidate) => {
    const key = candidate.trim().toLowerCase();
    return courses.some((course) => (
      course.id !== ignoreCourseId
      && String(course.lesson?.name || "").trim().toLowerCase() === key
    ));
  };
  let name = base;
  let suffix = 2;
  while (isTaken(name)) {
    name = `${base} ${suffix}`;
    suffix += 1;
  }
  return name;
}

function normalizeSavedCourse(course) {
  if (!course) return null;
  const id = String(course.id || "").trim();
  if (!id) return null;
  const lesson = normalizeLesson(course.lesson || course);
  if (!lesson.name && !lesson.words.length) return null;
  const rawSortOrder = course.sortOrder ?? course.sort_order;
  const sortOrder = Number(rawSortOrder);

  return {
    id,
    lesson,
    createdAt: Number(course.createdAt) || Date.now(),
    updatedAt: Number(course.updatedAt) || Date.now(),
    sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
  };
}

function normalizeTaskList(tasks, fallback = ["say"]) {
  const normalized = Array.isArray(tasks)
    ? tasks.filter((task) => taskLabels[task])
    : [];
  const fallbackTasks = Array.isArray(fallback)
    ? fallback.filter((task) => taskLabels[task])
    : ["say"];
  const uniqueTasks = [...new Set(normalized)];
  return uniqueTasks.length ? uniqueTasks : [...new Set(fallbackTasks.length ? fallbackTasks : ["say"])];
}

function updateEnabledTaskList(tasks, task, enabled) {
  if (!taskLabels[task]) return normalizeTaskList(tasks, ["say"]);
  const current = normalizeTaskList(tasks, ["say"]);
  const next = enabled
    ? [...current, task]
    : current.filter((item) => item !== task);
  return normalizeTaskList(next, ["say"]);
}

function normalizeLesson(lesson) {
  const enabledTasks = normalizeTaskList(lesson?.enabledTasks, ["say", "sentence", "spell"]);
  const name = String(lesson?.name || "Untitled lesson").trim() || "Untitled lesson";
  const tags = Array.isArray(lesson?.tags)
    ? lesson.tags.map((item) => String(item || "").trim()).filter(Boolean)
    : String(lesson?.tags || "").split(",").map((item) => item.trim()).filter(Boolean);
  const slug = createCourseSlug(lesson?.slug || name);

  return {
    name,
    slug,
    tags,
    enabledTasks: enabledTasks.length ? enabledTasks : ["say"],
    words: Array.isArray(lesson?.words)
      ? lesson.words.map(normalizeWord).filter((item) => item.en || item.zh)
      : [],
  };
}

function createCourseSlug(value) {
  const slug = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "my-course";
}

function getRouteView() {
  const path = window.location.pathname.toLowerCase();
  const params = new URLSearchParams(window.location.search);
  if (
    path.endsWith("/teacher")
    || path.endsWith("/teacher/")
    || path.endsWith("/teacher.html")
    || path.endsWith("/teacher/index.html")
    || params.get("admin") === "1"
    || params.get("view") === "teacher"
  ) {
    return "teacher";
  }
  return "game";
}

function applyRouteView() {
  state.view = getRouteView();
  if (state.view === "teacher") {
    state.chromeCollapsed = false;
  }
}

function getGamePageUrl() {
  const slug = createCourseSlug(state.lesson?.slug || state.lesson?.name);
  const url = state.view === "teacher" && window.location.pathname.toLowerCase().includes("/teacher")
    ? new URL("../index.html", window.location.href)
    : new URL("index.html", window.location.href);
  if (slug) {
    url.searchParams.set("course", slug);
  }
  return url.href;
}

function getCourseGamePageUrl(slug) {
  const url = window.location.pathname.toLowerCase().includes("/teacher")
    ? new URL("../index.html", window.location.href)
    : new URL("index.html", window.location.href);
  url.searchParams.set("course", createCourseSlug(slug));
  return url.href;
}

function getTeacherPageUrl() {
  const path = window.location.pathname.toLowerCase();
  if (path.endsWith("/teacher") || path.endsWith("/teacher/") || path.endsWith("/teacher/index.html")) {
    return new URL("./", window.location.href).href;
  }
  return new URL("teacher.html", window.location.href).href;
}

function render() {
  ensureGameShape();
  saveState();
  const teamListScroll = document.querySelector(".team-list")?.scrollTop ?? 0;
  const app = document.querySelector("#app");
  app.innerHTML = `
    ${renderTopbar()}
    ${renderCloudStatusBanner()}
    <main class="screen ${state.view === "teacher" ? "screen-teacher" : "screen-game"}">
      ${state.view === "teacher" ? renderTeacher() : renderGame()}
    </main>
    ${animation.celebrate ? renderCelebration() : ""}
    ${state.toast ? `<div class="toast">${escapeHtml(state.toast)}</div>` : ""}
  `;
  syncGameViewport();
  requestAnimationFrame(() => {
    syncGameViewport();
    const tl = document.querySelector(".team-list");
    if (tl) tl.scrollTop = teamListScroll;
  });
}

function renderCloudStatusBanner() {
  if (!cloudSync.message || cloudSync.status === "ready") return "";

  const isError = cloudSync.status === "error";
  const title = isError ? "雲端連線異常" : "雲端資料庫啟動中";
  return `
    <div class="cloud-status-banner ${isError ? "is-error" : "is-retrying"}" role="status" aria-live="polite">
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(cloudSync.message)}</span>
    </div>
  `;
}

function syncGameViewport() {
  const app = document.querySelector("#app");
  const topbar = document.querySelector(".topbar");
  const screen = document.querySelector(".screen-game");
  if (!app || !topbar || !screen) return;

  const appStyle = getComputedStyle(app);
  const screenStyle = getComputedStyle(screen);
  const verticalPadding = parseFloat(appStyle.paddingTop) + parseFloat(appStyle.paddingBottom);
  const screenTopMargin = parseFloat(screenStyle.marginTop);
  const availableHeight = Math.max(
    360,
    window.innerHeight - topbar.offsetHeight - verticalPadding - screenTopMargin,
  );

  document.documentElement.style.setProperty("--game-area-height", `${availableHeight}px`);
}

function renderTopbar() {
  const busy = isBusy() || (state.activeGame === "memory" && state.memory?.locked);
  const actions = state.view === "teacher" ? renderTeacherTopbarActions(busy) : renderGameTopbarActions(busy);
  const gameCompact = state.view === "game" && isActiveGameStarted();
  const teacherLocked = state.view === "teacher" && !isTeacherUnlocked();
  const teacherTokenRemembered = teacherLocked && Boolean(getTeacherWriteToken());
  const title = teacherLocked ? "老師後台" : state.lesson.name || "兒童美語大富翁";
  const meta = teacherLocked
    ? (teacherTokenRemembered ? "已記住密碼，可直接進入" : "請輸入老師密碼")
    : `${getLessonWords().length} words · ${state.game.teams.length} teams · Round ${state.game.round}`;

  return `
    <header class="topbar ${gameCompact ? "topbar-game-compact" : ""}">
      <div class="brand ${gameCompact ? "brand-game-compact" : ""}">
        <div class="brand-mark"><span>ABC</span></div>
        <div>
          <h1>${escapeHtml(title)}</h1>
          <p>${escapeHtml(meta)}</p>
        </div>
      </div>
      ${actions ? `<div class="quick-actions">${actions}</div>` : ""}
    </header>
  `;
}

function renderGameTopbarActions(busy) {
  if (state.activeGame === "hub" || !isActiveGameStarted()) return "";

  return `
    <button class="ghost-button" data-action="show-game-hub" ${busy ? "disabled" : ""}>選遊戲</button>
    <button class="ghost-button" data-action="open-current-setup" title="本局設定" ${busy ? "disabled" : ""}>設定</button>
    <button class="ghost-button" data-action="reset-game" title="重開本局" ${busy ? "disabled" : ""}>重開</button>
  `;
}

function renderTeacherTopbarActions(busy) {
  if (!isTeacherUnlocked()) {
    return "";
  }
  return `<button class="ghost-button" data-action="load-demo" ${busy ? "disabled" : ""}>載入範例</button>`;
}

function renderGame() {
  if (state.activeGame === "memory") {
    return renderMemoryGame();
  }

  if (state.activeGame === "monopoly") {
    return renderMonopolyGame();
  }

  return renderGameHub();
}

function renderGameHub() {
  const words = getLessonWords();
  const tags = state.lesson.tags?.length ? state.lesson.tags : [];
  const hasWords = words.length > 0;

  return `
    <section class="game-hub">
      <div class="hub-hero">
        <div>
          <div class="section-kicker">課程遊戲入口</div>
          <h2>${escapeHtml(state.lesson.name || "兒童美語課程")}</h2>
          <p>${words.length} 個單字 · ${tags.length ? tags.map((tag) => `#${escapeHtml(tag)}`).join(" ") : "尚未設定標籤"}</p>
          <p class="course-link-preview">課程網址代碼：${escapeHtml(state.lesson.slug || "my-course")}</p>
        </div>
        <div class="hub-hero-deco" aria-hidden="true">🌟</div>
      </div>
      <div class="game-choice-grid">
        ${Object.entries(gameCatalog).map(([key, game], i) => `
          <article class="game-choice-card animate__animated animate__fadeInUp" data-game="${key}" style="--animate-delay:${i * 0.12}s">
            <div class="game-choice-top">
              <span class="game-choice-icon">${game.icon || ""}</span>
              <div class="game-choice-badge">${escapeHtml(game.badge)}</div>
            </div>
            <h3>${escapeHtml(game.title)}</h3>
            <p>${escapeHtml(game.summary)}</p>
            <button class="game-choice-btn" data-action="select-game" data-game="${key}" ${hasWords ? "" : "disabled"}>${hasWords ? escapeHtml(game.action) : "請先新增單字"}</button>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function renderMonopolyGame() {
  const currentTeam = getCurrentTeam();
  const busy = isBusy();
  const started = state.game.started;
  const rollLabel = animation.rolling ? "骰子轉動中" : animation.movingTeamId ? "棋子移動中" : "擲骰";
  return `
    <section class="game-layout ${started ? "is-started" : "is-setup"}">
      ${started ? "" : renderGameSetupPanel(busy)}
      ${started && state.game.phase === "task" ? renderTaskOverlay(currentTeam, busy) : ""}
      <div class="board-wrap">
        <div class="board-grid">
          ${renderTiles()}
          <div class="board-center">
            ${renderMissionCard()}
          </div>
        </div>
      </div>
      <aside class="side-panel">
        <section class="current-turn-panel">
          <div class="panel-title">
            <h2>Current Team</h2>
            <span class="turn-badge">
              <span class="team-dot" style="--team-color:${currentTeam.color}">${currentTeam.avatar || ""}</span>
              ${escapeHtml(currentTeam.name)}
            </span>
          </div>
        </section>
        ${started ? `
        <section class="action-pad desktop-action-panel">
          <button class="primary-button roll-button" data-action="roll" ${busy || state.game.phase === "task" ? "disabled" : ""}>${rollLabel}</button>
          <button class="ghost-button" data-action="toggle-log">課堂紀錄</button>
        </section>` : ""}
        <section class="team-status-panel">
          <div class="panel-title">
            <h2>隊伍分數</h2>
          </div>
          <div class="team-list">
            ${state.game.teams.map((team, index) => renderTeamRow(team, index)).join("")}
          </div>
        </section>
      </aside>
      ${started ? renderMobileDock(currentTeam, busy, rollLabel) : ""}
      ${state.game.logOpen ? `
      <div class="log-modal" data-action="close-log">
        <div class="log-modal-card">
          <div class="log-modal-header">
            <h2>課堂紀錄</h2>
            <button class="ghost-button" data-action="toggle-log">✕ 關閉</button>
          </div>
          <div class="log-modal-list">
            ${state.game.log.slice().reverse().map((item) => `<div class="log-item">${escapeHtml(item)}</div>`).join("") || '<div class="log-item">尚無紀錄</div>'}
          </div>
        </div>
      </div>` : ""}
    </section>
  `;
}

function renderGameSetupPanel(busy) {
  const hasWords = getLessonWords().length > 0;
  return `
    <section class="game-setup-panel">
      <div class="panel-title">
        <div>
          <div class="section-kicker">本局設定</div>
          <h2>開始前調整</h2>
        </div>
        <button class="primary-button" data-action="start-game" ${busy || !hasWords ? "disabled" : ""}>${hasWords ? "開始遊戲" : "請先新增單字"}</button>
      </div>
      <div class="setup-grid">
        <div class="setup-block">
          <span class="check-label">本局任務</span>
          <div class="checks setup-checks">
            ${Object.entries(taskLabels).map(([key, label]) => `
              <label class="check-tile">
                <input type="checkbox" data-action="toggle-task" data-task="${key}" ${state.game.enabledTasks.includes(key) ? "checked" : ""} ${busy ? "disabled" : ""} />
                ${label}
              </label>
            `).join("")}
          </div>
        </div>
        <div class="setup-block">
          <div class="setup-block-head">
            <span class="check-label">Team Settings</span>
            <button class="ghost-button" type="button" data-action="add-team" ${busy ? "disabled" : ""}>Add Team</button>
          </div>
          <div class="team-edit-list">
            ${state.game.teams.map((team, index) => `
              <div class="team-edit-row">
                <div class="avatar-picker">
                  ${TEAM_AVATARS.map((emoji) => `<button class="avatar-option ${team.avatar === emoji ? "is-selected" : ""}" type="button" data-action="select-team-avatar" data-index="${index}" data-avatar="${emoji}" ${busy ? "disabled" : ""}>${emoji}</button>`).join("")}
                </div>
                <div class="team-edit-controls">
                  <input type="color" value="${escapeAttr(team.color)}" data-action="edit-team" data-index="${index}" data-field="color" aria-label="${escapeAttr(team.name)} color" ${busy ? "disabled" : ""} />
                  <input value="${escapeAttr(team.name)}" data-action="edit-team" data-index="${index}" data-field="name" aria-label="Team name ${index + 1}" ${busy ? "disabled" : ""} />
                  <button class="mini-button" type="button" data-action="delete-team" data-index="${index}" ${state.game.teams.length <= 1 || busy ? "disabled" : ""}>刪除</button>
                </div>
              </div>
            `).join("")}
          </div>
        </div>
      </div>
      <div class="setup-actions">
        <button class="ghost-button" data-action="reset-game" ${busy ? "disabled" : ""}>重開本局</button>
        <button class="ghost-button" data-action="show-game-hub" ${busy ? "disabled" : ""}>回遊戲選擇</button>
      </div>
    </section>
  `;
}

function renderMemoryGame() {
  const busy = isBusy() || state.memory.locked;
  const currentTeam = getMemoryTeam();

  return `
    <section class="memory-layout ${state.memory.started ? "is-started" : "is-setup"}">
      ${state.memory.started ? "" : renderMemorySetupPanel(busy)}
      ${state.memory.started ? `
        <section class="memory-board-panel">
          <div class="panel-title">
            <div>
              <div class="section-kicker">記憶翻牌</div>
              <h2>英文配中文</h2>
            </div>
            <span class="turn-badge">
              <span class="team-dot" style="--team-color:${currentTeam.color}">${currentTeam.avatar || ""}</span>
              ${escapeHtml(currentTeam.name)}
            </span>
          </div>
          ${renderMemoryFeedback()}
          <div class="memory-board" style="--memory-columns:${getMemoryColumns()}">
            ${state.memory.cards.map((card) => renderMemoryCard(card)).join("")}
          </div>
        </section>
        <aside class="memory-side-panel">
          <section class="team-status-panel">
            <div class="panel-title">
              <h2>Team Scores</h2>
            </div>
            <div class="team-list">
              ${state.game.teams.map((team, index) => renderMemoryTeamRow(team, index)).join("")}
            </div>
          </section>
          <section class="log-panel">
            <div class="panel-title">
              <h2>翻牌紀錄</h2>
            </div>
            <div class="log-list">
              ${state.memory.log.slice(-7).reverse().map((item) => `<div class="log-item">${escapeHtml(item)}</div>`).join("")}
            </div>
          </section>
        </aside>
      ` : ""}
    </section>
  `;
}

function renderMemorySetupPanel(busy) {
  const words = getLessonWords();
  const wordCount = words.length;
  const maxPairs = Math.min(12, wordCount);
  const setupDisabled = busy || !wordCount;
  const hasImages = words.some((w) => w.image);

  return `
    <section class="game-setup-panel memory-setup-panel">
      <div class="panel-title">
        <div>
          <div class="section-kicker">記憶翻牌設定</div>
          <h2>開始前調整</h2>
        </div>
        <button class="primary-button" data-action="start-game" ${setupDisabled ? "disabled" : ""}>開始翻牌</button>
      </div>
      <div class="setup-grid">
        <div class="setup-block">
          <label class="check-label" for="memoryPairCount">卡片組數</label>
          <input id="memoryPairCount" type="number" min="${maxPairs ? 1 : 0}" max="${maxPairs}" value="${state.memory.pairCount}" data-action="edit-memory-pairs" ${setupDisabled ? "disabled" : ""} />
          ${hasImages ? `
          <label class="check-label image-mode-label">
            <input type="checkbox" data-action="toggle-image-mode" ${state.memory.imageMode ? "checked" : ""} ${busy ? "disabled" : ""} />
            🖼️ 圖片配英文模式（需要單字有圖片）
          </label>` : ""}
          <p class="setup-note">${wordCount ? (state.memory.imageMode ? "翻開圖片牌找到對應的英文牌！" : "每組會自動產生 1 張英文牌和 1 張中文牌。") : "請先到老師後台新增單字。"}</p>
        </div>
        <div class="setup-block">
          <div class="setup-block-head">
            <span class="check-label">Team Settings</span>
            <button class="ghost-button" type="button" data-action="add-team" ${busy ? "disabled" : ""}>Add Team</button>
          </div>
          <div class="team-edit-list">
            ${state.game.teams.map((team, index) => `
              <div class="team-edit-row">
                <div class="avatar-picker">
                  ${TEAM_AVATARS.map((emoji) => `<button class="avatar-option ${team.avatar === emoji ? "is-selected" : ""}" type="button" data-action="select-team-avatar" data-index="${index}" data-avatar="${emoji}" ${busy ? "disabled" : ""}>${emoji}</button>`).join("")}
                </div>
                <div class="team-edit-controls">
                  <input type="color" value="${escapeAttr(team.color)}" data-action="edit-team" data-index="${index}" data-field="color" aria-label="${escapeAttr(team.name)} color" ${busy ? "disabled" : ""} />
                  <input value="${escapeAttr(team.name)}" data-action="edit-team" data-index="${index}" data-field="name" aria-label="Team name ${index + 1}" ${busy ? "disabled" : ""} />
                  <button class="mini-button" type="button" data-action="delete-team" data-index="${index}" ${state.game.teams.length <= 1 || busy ? "disabled" : ""}>刪除</button>
                </div>
              </div>
            `).join("")}
          </div>
        </div>
      </div>
      <div class="setup-actions">
        <button class="ghost-button" data-action="show-game-hub" ${busy ? "disabled" : ""}>回遊戲選擇</button>
      </div>
    </section>
  `;
}

function renderMemoryCard(card) {
  const visible = state.memory.flippedIds.includes(card.id) || state.memory.matchedIds.includes(card.id);
  const matched = state.memory.matchedIds.includes(card.id);
  const classes = [
    "memory-card",
    visible ? "is-visible" : "",
    matched ? "is-matched" : "",
    matched ? "animate__animated animate__tada" : "",
  ].filter(Boolean).join(" ");

  return `
    <button class="${classes}" data-action="flip-memory-card" data-card-id="${escapeAttr(card.id)}" ${state.memory.locked || state.memory.matchedIds.includes(card.id) ? "disabled" : ""}>
      <span class="memory-card-back">?</span>
      <span class="memory-card-face">
        <small>${escapeHtml(card.kind)}</small>
        ${card.image
          ? `<img class="memory-card-image" src="${escapeAttr(card.image)}" alt="${escapeAttr(card.text)}" />`
          : `<strong>${escapeHtml(card.text)}</strong>`
        }
      </span>
    </button>
  `;
}

function renderMemoryTeamRow(team, index) {
  const feedback = animation.memoryFeedback;
  const classes = [
    "team-row",
    index === state.memory.currentTeamIndex ? "is-active" : "",
    feedback?.teamId === team.id && feedback.type === "success" ? "is-score-flash" : "",
    feedback?.teamId === team.id && feedback.type === "miss" ? "is-miss-flash" : "",
  ].filter(Boolean).join(" ");

  return `
    <div class="${classes}" style="--team-color:${team.color}">
      <div class="team-avatar">${team.avatar || escapeHtml(team.name.charAt(0))}</div>
      <div>
        <div class="team-name">${escapeHtml(team.name)}</div>
        <div class="team-stats">配對 ${state.memory.scores[team.id] || 0} 組</div>
      </div>
      <div class="score-pill">⭐ ${state.memory.scores[team.id] || 0}</div>
    </div>
  `;
}

function renderMemoryFeedback() {
  const feedback = animation.memoryFeedback;
  if (state.activeGame !== "memory" || !state.memory.started) return "";
  const neutralTeam = getMemoryTeam();
  const type = feedback?.type || "neutral";
  const mark = feedback ? (feedback.type === "success" ? "+1" : "換") : "輪";
  const message = feedback?.message || `${neutralTeam.name} flips two cards`;
  const team = feedback
    ? state.game.teams.find((item) => item.id === feedback.teamId)
    : neutralTeam;

  return `
    <div class="memory-feedback-slot">
      <div class="memory-feedback is-${type}" role="status" aria-live="polite" style="--team-color:${team?.color || "var(--teal)"}">
        <span class="memory-feedback-mark">${mark}</span>
        <strong>${escapeHtml(message)}</strong>
      </div>
    </div>
  `;
}

function renderMobileDock(currentTeam, busy, rollLabel) {
  return `
    <section class="mobile-dock" aria-label="手機操作列">
      <div class="mobile-dock-header">
        <span class="turn-badge">
          <span class="team-dot" style="--team-color:${currentTeam.color}"></span>
          ${escapeHtml(currentTeam.name)}
        </span>
        <span class="mobile-round">Round ${state.game.round}</span>
      </div>
      <div class="mobile-action-grid">
        <button class="primary-button roll-button" data-action="roll" ${busy || state.game.phase === "task" ? "disabled" : ""}>${rollLabel}</button>
        <button class="ghost-button" data-action="toggle-log">課堂紀錄</button>
      </div>
    </section>
  `;
}

function renderTiles() {
  return tilePath.map(([column, row], index) => {
    const tile = getTile(index);
    const hasPawns = state.game.teams.some((team) => team.position === index);
    const current = state.game.currentTile === index && (state.game.phase === "task" || animation.movingTeamId);
    const classes = [
      "tile",
      `is-${tile.type}`,
      hasPawns ? "has-pawns" : "",
      current ? "is-current" : "",
    ].filter(Boolean).join(" ");

    return `
      <div class="${classes}" data-tile-index="${index}" style="grid-column:${column};grid-row:${row}">
        <div class="tile-label">${escapeHtml(tile.label)}</div>
        <div class="tile-word tile-word-full" title="${escapeAttr(tile.tooltip)}">${renderTileBoardTitle(tile)}</div>
        <div class="tile-word-short" title="${escapeAttr(tile.tooltip)}">${renderTileShortWord(tile)}</div>
        <div class="tile-meta">${escapeHtml(tile.meta)}</div>
        <div class="pawns">
          ${renderPawnsForTile(index)}
        </div>
      </div>
    `;
  }).join("");
}

function renderTileBoardTitle(tile) {
  if (tile.type === "chance") {
    return `
      <span class="chance-tile-face">
        <span class="chance-card-icon chance-card-icon-large" aria-label="機會卡">?</span>
      </span>
    `;
  }

  return escapeHtml(tile.boardTitle);
}

function renderTileShortWord(tile) {
  if (tile.type === "chance") {
    return `<span class="chance-card-icon" aria-label="機會卡">?</span>`;
  }

  return escapeHtml(tile.shortWord);
}

function renderPawnsForTile(tileIndex) {
  return state.game.teams
    .filter((team) => team.position === tileIndex)
    .map((team) => `<span class="pawn ${animation.movingTeamId === team.id ? "is-moving" : ""}" title="${escapeAttr(team.name)}" style="--team-color:${team.color}">${team.avatar || team.name.charAt(0)}</span>`)
    .join("");
}

function renderMissionCard() {
  const task = state.game.currentTask;
  if (!task) {
    return `
      <section class="mission-card">
        ${renderDiceFace()}
        <div class="mission-kicker">兒童美語大富翁</div>
        <h2 class="mission-title">${animation.rolling ? "骰子轉動中" : animation.movingTeamId ? "棋子前進中" : "Ready?"}</h2>
      </section>
    `;
  }

  return `
    <section class="mission-card has-task animate__animated animate__bounceIn">
      <div class="mission-kicker">${escapeHtml(task.kicker)}</div>
      <h2 class="mission-title">${escapeHtml(task.title)}</h2>
      <p class="mission-prompt">${escapeHtml(task.prompt)}</p>
      <p class="mission-support">${escapeHtml(task.support)}</p>
      ${renderDiceFace()}
    </section>
  `;
}

function renderTaskOverlay(currentTeam, busy) {
  const task = state.game.currentTask;
  if (!task) return "";

  return `
    <div class="task-overlay animate__animated animate__fadeIn">
      <div class="task-overlay-card animate__animated animate__zoomIn">
        <div class="task-overlay-team" style="--team-color:${currentTeam.color}">
          <span class="task-overlay-avatar">${currentTeam.avatar || currentTeam.name.charAt(0)}</span>
          <span>${escapeHtml(currentTeam.name)} 的回合</span>
        </div>
        <div class="task-overlay-kicker">${escapeHtml(task.kicker)}</div>
        <h2 class="task-overlay-title">${escapeHtml(task.title)}</h2>
        <p class="task-overlay-prompt">${escapeHtml(task.prompt)}</p>
        <p class="task-overlay-support">${escapeHtml(task.support)}</p>
        <div class="task-overlay-actions">
          <button class="success-button" data-action="mark-correct" ${busy ? "disabled" : ""}>✓ 答對！</button>
          <button class="danger-button" data-action="skip-task" ${busy ? "disabled" : ""}>✗ 答錯</button>
        </div>
      </div>
    </div>
  `;
}

function renderDiceFace() {
  const value = animation.diceValue || state.game.dice || 1;

  if (animation.movingTeamId) {
    return `
      <div class="dice-stage dice-stage-locked" aria-label="骰子 ${value}">
        <div class="dice-lock" data-value="${value}">
          ${renderCubePips(value)}
        </div>
      </div>
    `;
  }

  return `
    <div class="dice-stage" aria-label="骰子 ${value}">
      <div class="dice-cube ${animation.rolling ? "is-rolling" : ""}" data-value="${value}">
        ${renderDiceCubeFace("front", 1)}
        ${renderDiceCubeFace("back", 6)}
        ${renderDiceCubeFace("right", 3)}
        ${renderDiceCubeFace("left", 4)}
        ${renderDiceCubeFace("top", 5)}
        ${renderDiceCubeFace("bottom", 2)}
      </div>
    </div>
  `;
}

function renderDiceCubeFace(face, value) {
  return `
    <div class="cube-face cube-face-${face}">
      ${renderCubePips(value)}
    </div>
  `;
}

function renderCubePips(value) {
  const positions = {
    1: ["center"],
    2: ["top-left", "bottom-right"],
    3: ["top-left", "center", "bottom-right"],
    4: ["top-left", "top-right", "bottom-left", "bottom-right"],
    5: ["top-left", "top-right", "center", "bottom-left", "bottom-right"],
    6: ["top-left", "top-right", "middle-left", "middle-right", "bottom-left", "bottom-right"],
  }[value] || ["center"];

  return positions.map((position) => `<span class="cube-pip cube-pip-${position}"></span>`).join("");
}

function renderCelebration() {
  const pieces = Array.from({ length: 18 }, (_, index) => {
    const delay = (index % 6) * 0.08;
    const shift = ((index % 9) - 4) * 16;
    return `<span class="confetti-piece" style="--delay:${delay}s;--shift:${shift}px;--tone:${index % 6}"></span>`;
  }).join("");

  return `
    <div class="celebration" aria-live="polite">
      <div class="celebration-burst">${pieces}</div>
      <div class="celebration-card animate__animated animate__jackInTheBox">
        <span class="celebration-mark">A+</span>
        <strong>${escapeHtml(animation.celebrationMessage || "答對了！")}</strong>
      </div>
    </div>
  `;
}

function renderTeamRow(team, index) {
  return `
    <div class="team-row ${index === state.game.currentTeamIndex ? "is-active" : ""}" style="--team-color:${team.color}" data-team-id="${team.id}">
      <div class="team-avatar">${team.avatar || escapeHtml(team.name.charAt(0))}</div>
      <div class="team-name">${escapeHtml(team.name)}</div>
      <div class="score-pill">⭐ ${team.score} 分</div>
    </div>
  `;
}

function renderTeacher() {
  if (!isTeacherUnlocked()) {
    return renderTeacherAuthGate();
  }

  const busy = isBusy();
  return `
    <section class="teacher-layout">
      <aside class="teacher-panel teacher-course-panel">
        <div class="panel-title">
          <div>
            <div class="section-kicker">雲端管理</div>
            <h2>課程資料庫</h2>
          </div>
          ${renderTeacherHeaderActions(busy)}
        </div>
        ${renderCourseLibrary()}
      </aside>
      <section class="teacher-panel teacher-lesson-panel">
        <div class="panel-title">
          <div>
            <div class="section-kicker">課程內容</div>
            <h2>設定與單字</h2>
          </div>
        </div>
        ${renderTeacherSyncStatusBar()}
        <div class="teacher-subhead">
          <div>
            <div class="section-kicker">基本資料</div>
            <h3>課程設定</h3>
          </div>
        </div>
        <div class="form-grid">
          <div class="field">
            <label for="lessonName">課程名稱</label>
            <input id="lessonName" value="${escapeAttr(state.lesson.name)}" data-action="edit-lesson" data-field="name" />
          </div>
          <div class="field">
            <label for="lessonSlug">課程網址代碼</label>
            <input id="lessonSlug" value="${escapeAttr(state.lesson.slug || "")}" data-action="edit-lesson" data-field="slug" placeholder="unit-1-animals-food" />
          </div>
          <div class="field is-wide">
            <label for="lessonTags">課程標籤，用逗號分隔</label>
            <input id="lessonTags" value="${escapeAttr((state.lesson.tags || []).join(", "))}" data-action="edit-tags" placeholder="animals, food, phonics" />
          </div>
        </div>
        ${renderLessonTaskSettings()}
        ${renderCourseReadinessNotice()}
        <div class="teacher-subhead word-bank-head">
          <div>
            <div class="section-kicker">單字內容</div>
            <h3>單字題庫</h3>
          </div>
        </div>
        ${renderWordEditor()}
        ${renderCsvPanel()}
      </section>
    </section>
  `;
}

function renderTeacherHeaderActions(busy) {
  return `
    <div class="teacher-header-actions">
      <button class="primary-button" data-action="go-game-url" ${busy ? "disabled" : ""}>前往遊戲入口</button>
      <button class="plain-button teacher-logout-button" type="button" data-action="clear-teacher-token" ${busy ? "disabled" : ""}>登出後台</button>
    </div>
  `;
}

function renderLessonTaskSettings() {
  const enabledTasks = normalizeTaskList(state.lesson.enabledTasks, defaultLesson.enabledTasks);
  return `
    <div class="setup-block lesson-task-settings">
      <span class="check-label">課程任務</span>
      <div class="checks setup-checks">
        ${Object.entries(taskLabels).map(([key, label]) => `
          <label class="check-tile">
            <input type="checkbox" data-action="toggle-lesson-task" data-task="${key}" ${enabledTasks.includes(key) ? "checked" : ""} />
            ${label}
          </label>
        `).join("")}
      </div>
    </div>
  `;
}

function isTeacherUnlocked() {
  return teacherAccessUnlocked && Boolean(getTeacherWriteToken());
}

function renderTeacherAuthGate() {
  const token = getTeacherWriteToken();
  const verifying = cloudSave.verifying;
  const status = getTeacherWriteTokenStatus();
  const authMode = token ? "is-remembered" : "is-password";
  const showStatus = !token
    || verifying
    || cloudSave.tokenStatus === "pending"
    || cloudSave.tokenStatus === "invalid"
    || cloudSave.tokenStatus === "error";
  const authControl = token
    ? `
        <div class="teacher-auth-state">
          <div class="teacher-auth-remembered" role="status">
            <span class="teacher-auth-status-dot" aria-hidden="true"></span>
            <div>
              <strong>本分頁已記住密碼</strong>
              <span>進入前會重新確認權限。</span>
            </div>
          </div>
          <div class="teacher-auth-actions">
            <button class="primary-button" type="button" data-action="verify-teacher-token" ${verifying ? "disabled" : ""}>${verifying ? "進入中" : "直接進入後台"}</button>
            <button class="plain-button" type="button" data-action="clear-teacher-token" ${verifying ? "disabled" : ""}>重新輸入密碼</button>
          </div>
        </div>
      `
    : `
        <div class="cloud-token-row teacher-auth-row">
          <input id="teacherWriteToken" type="password" data-action="teacher-token-input" placeholder="輸入老師寫入密碼" autocomplete="current-password" ${verifying ? "disabled" : ""} />
          <button class="primary-button" type="button" data-action="verify-teacher-token" ${verifying ? "disabled" : "disabled"}>${verifying ? "驗證中" : "進入後台"}</button>
        </div>
      `;

  return `
    <section class="teacher-auth-layout ${authMode}">
      <div class="teacher-auth-panel ${authMode}">
        <div class="teacher-auth-copy">
          <div class="section-kicker">${token ? "登入狀態" : "老師後台"}</div>
          <h2>${token ? "可以直接進入後台" : "輸入密碼進入"}</h2>
          <p>${token ? "這個分頁已保存老師密碼，不需要重新輸入。按下進入時，系統會先確認密碼仍然有效。" : "後台課程只會讀寫 Supabase 雲端資料。密碼通過後才能編輯、刪除或同步課程。"}</p>
        </div>
        ${authControl}
        <div class="teacher-auth-footer ${showStatus ? "" : "is-action-only"}">
          ${showStatus ? `<span class="cloud-token-status ${status.className}" role="status" aria-live="polite">${escapeHtml(status.message)}</span>` : ""}
          <button class="plain-button" type="button" data-action="go-game-url">回遊戲入口</button>
        </div>
      </div>
    </section>
  `;
}

function renderCourseReadinessNotice() {
  const playableWords = getLessonWords();
  const incompleteWords = getIncompleteWords();
  const messages = [];

  if (!playableWords.length) {
    messages.push({ tone: "warning", text: "至少需要一筆 en + zh 完整的單字，課程才可以玩。" });
  }

  if (incompleteWords.length) {
    messages.push({ tone: "warning", text: `${incompleteWords.length} 筆單字缺少 en 或 zh，存檔前請補齊。` });
  }

  if (!messages.length) return "";

  return `
    <div class="course-notice-list">
      ${messages.map((item) => `<p class="course-notice is-${item.tone}">${escapeHtml(item.text)}</p>`).join("")}
    </div>
  `;
}

function renderWordEditor() {
  const words = Array.isArray(state.lesson.words) ? state.lesson.words : [];

  return `
    <form class="word-tools" data-action="add-word-form">
      <input name="en" placeholder="en" autocomplete="off" />
      <input name="zh" placeholder="中文提示" autocomplete="off" />
      <button class="success-button" type="submit" data-action="add-word">新增</button>
    </form>
    ${words.length ? `
      <div class="word-editor-list">
        <div class="word-editor-head">
          <span></span>
          <span>en</span>
          <span>zh</span>
          <span></span>
        </div>
        ${words.map((item, index) => renderWordEditorRow(item, index)).join("")}
      </div>
    ` : `<div class="empty-state">目前沒有單字。先新增 en + zh，或從 CSV 匯入。</div>`}
  `;
}

function renderWordEditorRow(item, index) {
  const word = normalizeWord(item);
  const expanded = teacherUi.expandedWordIndexes.has(index);

  return `
    <div class="word-editor-row ${expanded ? "is-expanded" : ""}">
      <div class="word-main-grid">
        <button class="word-expand-button" type="button" data-action="toggle-word-extra" data-index="${index}" aria-expanded="${expanded}">${expanded ? "▾" : "▸"}</button>
        <input value="${escapeAttr(word.en)}" data-action="edit-word" data-index="${index}" data-field="en" placeholder="season" />
        <input value="${escapeAttr(word.zh)}" data-action="edit-word" data-index="${index}" data-field="zh" placeholder="季節" />
        <button class="mini-button" type="button" data-action="delete-word" data-index="${index}">刪除</button>
      </div>
      ${expanded ? `
        <div class="word-extra-grid">
          <div class="field">
            <label>phonetic</label>
            <input value="${escapeAttr(word.phonetic)}" data-action="edit-word" data-index="${index}" data-field="phonetic" placeholder="/ˈsiːzən/" />
          </div>
          <div class="field">
            <label>image</label>
            <input value="${escapeAttr(word.image)}" data-action="edit-word" data-index="${index}" data-field="image" placeholder="https://..." />
          </div>
        </div>
      ` : ""}
    </div>
  `;
}

function renderCsvPanel() {
  return `
    <div class="teacher-subhead lesson-section-head">
      <div>
        <div class="section-kicker">匯入匯出</div>
        <h3>CSV</h3>
      </div>
      <button class="primary-button" type="button" data-action="export-csv">匯出 CSV</button>
    </div>
    <div class="import-box">
      <label class="small-label" for="csvInput">貼上 CSV：英文單字, 中文提示</label>
      <textarea id="csvInput" placeholder="season,季節"></textarea>
      <div class="button-row">
        <button class="ghost-button" data-action="import-csv">匯入 CSV</button>
        <button class="ghost-button" data-action="clear-words">清空單字</button>
      </div>
    </div>
  `;
}

function renderCourseLibrary() {
  const courses = loadCourseLibrary();

  return `
    <section class="course-library">
      <div class="course-library-head">
        <div class="course-library-title">
          <div>
            <div class="section-kicker">雲端課程</div>
            <h3>Supabase 課程清單</h3>
          </div>
          <span class="course-count-pill">${courses.length} 門</span>
        </div>
        <div class="course-library-actions">
          <button class="ghost-button" type="button" data-action="start-new-course">＋ 新增課程</button>
        </div>
      </div>
      ${courses.length ? `
        <div class="course-list">
          ${courses.map((course, index) => renderSavedCourse(course, index, courses.length)).join("")}
        </div>
      ` : `<div class="empty-state course-empty">目前沒有 Supabase 課程。補齊第一筆完整單字後會自動建立並顯示在這裡。</div>`}
    </section>
  `;
}

function renderTeacherSyncStatusBar() {
  const status = getCloudSyncSummary();
  const completeCount = getLessonWords().length;
  const totalCount = Array.isArray(state.lesson.words) ? state.lesson.words.length : 0;
  const countLabel = totalCount === completeCount
    ? `${completeCount} 筆完整`
    : `${completeCount}/${totalCount} 筆完整`;

  return `
    <div class="teacher-sync-bar ${status.className}">
      <div class="teacher-sync-main">
        ${renderCloudSyncBadge()}
        <span class="teacher-sync-count">${countLabel}</span>
      </div>
      ${cloudSave.tokenStatus === "error" && cloudSave.tokenMessage
        ? `<p class="teacher-sync-error" role="alert">${escapeHtml(cloudSave.tokenMessage)}</p>`
        : ""}
    </div>
  `;
}

function refreshTeacherSyncBar() {
  const bar = document.querySelector(".teacher-sync-bar");
  if (bar) bar.outerHTML = renderTeacherSyncStatusBar();
}

function renderTeacherMobileSyncToast() {
  return "";
  const toast = teacherUi.syncToast || {};
  if (!toast.visible || !toast.message) return "";

  return `
    <div class="teacher-sync-toast ${toast.className}" role="status" aria-live="polite">
      <span class="teacher-sync-toast-message">${escapeHtml(toast.message)}</span>
      ${toast.detail ? `<span class="teacher-sync-toast-detail">${escapeHtml(toast.detail)}</span>` : ""}
    </div>
  `;
}

function refreshTeacherSyncToast() {
  return;
  const nextMarkup = renderTeacherMobileSyncToast();
  document.querySelectorAll(".teacher-sync-toast").forEach((toast) => toast.remove());

  if (!nextMarkup) return;
  const bar = document.querySelector(".teacher-sync-bar");
  if (bar) {
    bar.insertAdjacentHTML("afterend", nextMarkup);
    return;
  }

  document.querySelector(".teacher-lesson-panel")?.insertAdjacentHTML("afterbegin", nextMarkup);
}

function getTeacherSyncToastState() {
  return null;
  const shouldShow = cloudSave.verifying
    || cloudSave.saving
    || cloudSave.tokenStatus === "saved"
    || cloudSave.tokenStatus === "error"
    || cloudSave.tokenStatus === "invalid"
    || courseAutosaveQueued
    || Boolean(courseAutosaveTimer);

  if (!shouldShow) return null;

  const status = getCloudSyncSummary();
  const compactStatus = getCompactCloudSyncSummary(status);
  const completeCount = getLessonWords().length;
  const persistent = cloudSave.verifying
    || cloudSave.saving
    || cloudSave.tokenStatus === "error"
    || cloudSave.tokenStatus === "invalid";

  return {
    visible: true,
    persistent,
    className: status.className,
    message: compactStatus.message,
    detail: completeCount ? `${completeCount} 筆完整` : "",
    key: `${status.className}|${compactStatus.message}|${cloudSave.tokenMessage}|${completeCount}`,
  };
}

function updateTeacherSyncToast() {
  return;
  if (state.view !== "teacher") return;

  const nextToast = getTeacherSyncToastState();
  clearTimeout(syncToastTimer);
  syncToastTimer = null;

  if (!nextToast) {
    if (teacherUi.syncToast?.visible) {
      teacherUi.syncToast = { ...teacherUi.syncToast, visible: false };
      refreshTeacherSyncToast();
    }
    return;
  }

  teacherUi.syncToast = nextToast;
  refreshTeacherSyncToast();

  if (!nextToast.persistent) {
    syncToastTimer = setTimeout(() => {
      teacherUi.syncToast = { ...teacherUi.syncToast, visible: false };
      refreshTeacherSyncToast();
    }, MOBILE_SYNC_TOAST_DELAY);
  }
}

// 只刷新課程清單與右側同步狀態，不動右側輸入欄位，
// 讓存檔回饋與左欄課程資訊更新時，不打斷正在輸入的欄位（含注音選字）。
function refreshCourseLibraryPanel() {
  const panel = document.querySelector(".course-library");
  if (panel) panel.outerHTML = renderCourseLibrary();
  refreshTeacherSyncBar();
}

function renderCloudSyncBadge(options = {}) {
  const status = getCloudSyncSummary();
  const compactStatus = getCompactCloudSyncSummary(status);
  const liveAttrs = options.live === false ? "" : ' role="status" aria-live="polite"';

  return `
    <span class="cloud-sync-pill ${status.className}"${liveAttrs}>
      <span class="sync-message-full">${escapeHtml(status.message)}</span>
      <span class="sync-message-compact">${escapeHtml(compactStatus.message)}</span>
    </span>
  `;
}

function getCompactCloudSyncSummary(status) {
  if (cloudSave.verifying) return { ...status, message: "驗證中" };
  if (cloudSave.saving) {
    return { ...status, message: cloudSave.operation === "course-order" ? "排序同步中" : "同步中" };
  }
  if (!getTeacherWriteToken()) return { ...status, message: "未登入" };
  if (cloudSave.tokenStatus === "invalid") return { ...status, message: "需重登" };
  if (cloudSave.tokenStatus === "error") return { ...status, message: "同步失敗" };
  if (courseAutosaveQueued || courseAutosaveTimer) return { ...status, message: "已排程" };
  if (cloudSave.tokenStatus === "saved") {
    return {
      ...status,
      message: String(cloudSave.tokenMessage || "").includes("排序") ? "排序已同步" : "已同步",
    };
  }
  if (!isEditingExistingCourse()) return { ...status, message: getLessonWords().length ? "待建立" : "補單字" };
  return { ...status, message: "同步啟用" };
}

function getCloudSyncSummary() {
  const isExisting = isEditingExistingCourse();

  if (cloudSave.verifying) {
    return { className: "is-muted", message: "雲端驗證中" };
  }

  if (cloudSave.saving) {
    if (cloudSave.operation === "course-order") {
      return { className: "is-muted", message: "排序同步中" };
    }
    return { className: "is-muted", message: isExisting ? "自動同步中" : "建立中" };
  }

  if (!getTeacherWriteToken()) {
    return { className: "is-muted", message: "雲端未登入" };
  }

  if (cloudSave.tokenStatus === "invalid") {
    return { className: "is-error", message: "密碼需重登" };
  }

  if (cloudSave.tokenStatus === "error") {
    return { className: "is-error", message: "同步失敗" };
  }

  if (!isExisting) {
    if (courseAutosaveQueued || courseAutosaveTimer) {
      return { className: "is-muted", message: "已排程建立課程" };
    }
    return getLessonWords().length
      ? { className: "is-muted", message: "整理中，將自動建立課程" }
      : { className: "is-muted", message: "補一筆完整單字後自動建立課程" };
  }

  if (courseAutosaveQueued || courseAutosaveTimer) {
    return { className: "is-muted", message: "已排程同步" };
  }

  if (cloudSave.tokenStatus === "saved") {
    return { className: "is-ok", message: cloudSave.tokenMessage || "已同步" };
  }

  return { className: "is-ok", message: "自動同步已啟用" };
}

function getTeacherWriteTokenStatus() {
  if (cloudSave.verifying) {
    return { className: "is-muted", message: "正在驗證寫入密碼。" };
  }

  if (cloudSave.saving) {
    return { className: "is-muted", message: "正在寫入 Supabase。" };
  }

  const token = getTeacherWriteToken();
  if (!token) {
    return { className: "is-muted", message: "尚未輸入寫入密碼；課程只會寫入 Supabase，不再建立本機課程。" };
  }

  if (cloudSave.tokenStatus === "verified") {
    return { className: "is-ok", message: cloudSave.tokenMessage || "已登入後台，可以同步 Supabase。" };
  }

  if (cloudSave.tokenStatus === "saved") {
    return { className: "is-ok", message: cloudSave.tokenMessage || "已同步到 Supabase。" };
  }

  if (cloudSave.tokenStatus === "invalid") {
    return { className: "is-error", message: cloudSave.tokenMessage || "寫入密碼錯誤，請重新輸入。" };
  }

  if (cloudSave.tokenStatus === "error") {
    return { className: "is-error", message: cloudSave.tokenMessage || "驗證失敗，請稍後再試。" };
  }

  if (cloudSave.tokenStatus === "pending") {
    return { className: "is-muted", message: cloudSave.tokenMessage || "尚未完成登入，請重新進入後台。" };
  }

  return { className: "is-muted", message: "本分頁已記住密碼，可以直接進入後台。" };
}

function renderSavedCourse(course, index = 0, courseCount = 1) {
  const lesson = course.lesson;
  const selected = getSelectedCourse()?.id === course.id;
  const pendingDelete = courseDelete.pendingCourseId === course.id;
  const deleting = courseDelete.deletingCourseId === course.id;
  const orderDisabled = cloudSave.saving || cloudSave.verifying || Boolean(courseAutosaveTimer) || courseAutosaveQueued;
  const tags = Array.isArray(lesson.tags) ? lesson.tags.filter(Boolean) : [];
  const metaItems = [
    `${lesson.words.filter(isCompleteWord).length} 個單字`,
    formatSavedAt(course.updatedAt),
  ];

  return `
    <article class="course-item ${selected ? "is-selected" : ""} ${pendingDelete ? "is-delete-pending" : ""}">
      <div class="course-order-controls" aria-label="課程排序">
        <button class="course-order-button" type="button" data-action="move-course" data-course-id="${escapeAttr(course.id)}" data-direction="up" title="上移" aria-label="上移 ${escapeAttr(lesson.name)}" ${index <= 0 || orderDisabled ? "disabled" : ""}>↑</button>
        <button class="course-order-button" type="button" data-action="move-course" data-course-id="${escapeAttr(course.id)}" data-direction="down" title="下移" aria-label="下移 ${escapeAttr(lesson.name)}" ${index >= courseCount - 1 || orderDisabled ? "disabled" : ""}>↓</button>
      </div>
      <div class="course-info">
        <div class="course-title-row">
          <strong>${escapeHtml(lesson.name)}</strong>
          ${selected ? `<span class="course-selected-badge">編輯中</span>` : ""}
        </div>
        <div class="course-meta-row">
          ${metaItems.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
        </div>
        <div class="course-slug-row">
          <span class="course-slug">${escapeHtml(lesson.slug || "my-course")}</span>
          ${tags.map((tag) => `<span class="course-tag">#${escapeHtml(tag)}</span>`).join("")}
        </div>
        ${pendingDelete ? `<span class="course-delete-warning">將從 Supabase 刪除此課程與全部單字</span>` : ""}
      </div>
      <div class="course-actions">
        ${selected ? "" : `<button class="ghost-button" type="button" data-action="load-course" data-course-id="${escapeAttr(course.id)}">編輯</button>`}
        <button class="ghost-button" type="button" data-action="copy-course-link" data-course-slug="${escapeAttr(lesson.slug || lesson.name)}">複製網址</button>
        ${pendingDelete ? `
          <button class="ghost-button" type="button" data-action="cancel-delete-course" data-course-id="${escapeAttr(course.id)}" ${deleting ? "disabled" : ""}>取消</button>
          <button class="mini-button is-danger" type="button" data-action="confirm-delete-course" data-course-id="${escapeAttr(course.id)}" ${deleting ? "disabled" : ""}>${deleting ? "刪除中" : "確認刪除"}</button>
        ` : `
          <button class="mini-button" type="button" data-action="request-delete-course" data-course-id="${escapeAttr(course.id)}">刪除</button>
        `}
      </div>
    </article>
  `;
}

function getTile(index) {
  const originalType = boardTypes[index];
  const type = getDisplayTileType(originalType, index);
  const boardText = boardTileText[type] || {
    label: tileTypeText[type] || "任務",
    title: tileTypeText[type] || "任務",
    short: tileTypeText[type] || "任務",
    meta: "完成任務",
    tooltip: "任務格",
  };
  if (type === "start") {
    return {
      type,
      label: boardText.label,
      word: "出發",
      boardTitle: boardText.title,
      shortWord: boardText.short,
      meta: boardText.meta,
      tooltip: boardText.tooltip,
    };
  }

  return {
    type,
    label: boardText.label,
    word: type === "chance" ? "幸運卡" : boardText.title,
    boardTitle: boardText.title,
    shortWord: boardText.short,
    meta: boardText.meta,
    tooltip: boardText.tooltip,
  };
}

async function rollDice() {
  if (state.game.phase === "task" || isBusy()) return;
  if (!getLessonWords().length) {
    showToast("請先在老師後台新增單字");
    render();
    return;
  }

  state.game.started = true;
  state.chromeCollapsed = true;
  const team = getCurrentTeam();
  state.game.preRollPosition = team.position;
  const dice = Math.floor(Math.random() * 6) + 1;

  state.game.currentTask = null;
  state.game.phase = "ready";
  animation.rolling = true;
  animation.diceValue = dice;
  render();
  await wait(920);
  animation.rolling = false;
  state.game.dice = dice;
  render();
  await wait(140);

  animation.movingTeamId = team.id;
  updateMovementChrome(true);
  let passedStart = !!(state.game.landedOnStart?.[team.id]);
  if (state.game.landedOnStart) delete state.game.landedOnStart[team.id];

  for (let step = 0; step < dice; step += 1) {
    const previousStep = team.position;
    const nextStep = (team.position + 1) % tilePath.length;
    if (nextStep === 0 && previousStep !== 0) {
      passedStart = true;
    }
    team.position = nextStep;
    state.game.currentTile = nextStep;
    updateBoardMovement(previousStep, nextStep);
    await wait(220);
  }

  animation.movingTeamId = null;
  animation.diceValue = null;
  updateMovementChrome(false);
  const nextPosition = team.position;

  state.game.passedStart = passedStart;

  if (nextPosition === 0) {
    if (!state.game.landedOnStart) state.game.landedOnStart = {};
    state.game.landedOnStart[team.id] = true;
    advanceTeam();
    state.game.currentTask = null;
    state.game.phase = "ready";
    showToast("踩到起點，換下一隊。");
    render();
    return;
  }

  const tile = getTile(nextPosition);
  state.game.currentTask = createTask(tile, nextPosition);
  state.game.phase = "task";
  addLog(`${team.name} rolled ${dice} and moved to ${tile.label}.`);
  render();
}

function updateBoardMovement(previousTile, nextTile) {
  document.querySelectorAll(".tile.is-current").forEach((tile) => {
    tile.classList.remove("is-current");
  });

  updateTilePawns(previousTile);
  updateTilePawns(nextTile);

  const nextTileElement = document.querySelector(`[data-tile-index="${nextTile}"]`);
  if (nextTileElement) {
    nextTileElement.classList.add("is-current");
  }

  saveState();
}

function updateTilePawns(tileIndex) {
  const tileElement = document.querySelector(`[data-tile-index="${tileIndex}"]`);
  const pawnsElement = tileElement?.querySelector(".pawns");
  if (pawnsElement) {
    pawnsElement.innerHTML = renderPawnsForTile(tileIndex);
  }
}

function updateMovementChrome(isMoving) {
  const rollButton = document.querySelector('[data-action="roll"]');
  if (rollButton) {
    rollButton.disabled = isMoving;
    rollButton.textContent = isMoving ? "棋子移動中" : "擲骰";
  }

  const missionTitle = document.querySelector(".mission-title");
  const missionPrompt = document.querySelector(".mission-prompt");
  if (isMoving && missionTitle && missionPrompt && !state.game.currentTask) {
    missionTitle.textContent = "棋子前進中";
    missionPrompt.textContent = "跟著棋子一起數格子。";
  }
}

function createTask(tile, tileIndex) {
  const word = pickWord(tileIndex);
  if (!word) {
    return {
      type: "say",
      kicker: "尚未設定單字",
      title: "請先新增單字",
      prompt: "請到老師後台新增本課單字後再開始遊戲。",
      support: "前台只會使用老師設定的單字，不會自動套用範例。",
      answer: "",
    };
  }

  const taskType = resolveTaskType(tile.type, tileIndex);
  const baseSupport = `${word.zh || "沒有中文提示"} · 課堂單字`;

  if (tile.type === "chance") {
    return createChanceTask(word);
  }

  if (taskType === "sentence") {
    return createSentenceTask(word, "Make a sentence");
  }

  if (taskType === "spell") {
    return {
      type: taskType,
      kicker: "Spell the word",
      title: getSpellingTitle(word),
      prompt: getSpellingPrompt(word),
      support: getSpellingSupport(word),
      answer: word.en,
    };
  }

  if (taskType === "ask") {
    return createAskTask(word);
  }

  if (taskType === "act") {
    return {
      type: taskType,
      kicker: "Performance",
      title: word.en,
      prompt: `做一個動作，並說出：${word.en}`,
      support: baseSupport,
    };
  }

  if (taskType === "choose") {
    return createChooseTask(word);
  }

  return {
    type: "say",
    kicker: "Read the word",
    title: word.en,
    prompt: `大聲唸出：${word.en}`,
    support: baseSupport,
  };
}

function createAskTask(word) {
  const askContent = buildAskContent(word);
  const support = "Answer in a complete sentence.";

  return {
    type: "ask",
    kicker: "Answer a question",
    title: "Question",
    prompt: askContent.question,
    support,
    answerGuide: askContent.answerGuide,
  };
}

function buildAskContent(word) {
  return {
    question: `What can you say about "${word.en}"?`,
    answerGuide: "Open answer. The teacher decides whether it is correct.",
  };
}

function createSentenceTask(word, kicker = "Make a sentence", bonus = 0) {
  const support = getSentenceSupport(word, bonus);

  return {
    type: "sentence",
    kicker,
    title: word.en,
    prompt: `Make a sentence using ${word.en}.`,
    support,
    bonus,
  };
}

function getSentenceSupport(word, bonus = 0) {
  const hints = [];

  if (word.zh) hints.push(word.zh);

  if (bonus) hints.push(`加分 +$${bonus}`);
  return hints.join(" · ") || "老師帶著學生說出一個英文句子。";
}

function getSpellingTitle(word) {
  return word.zh || "Spell the word";
}

function getSpellingPrompt(word) {
  return `看中文提示，拼出英文單字。`;
}

function getSpellingSupport(word) {
  const hints = [];
  if (word.zh) hints.push(`中文提示：${word.zh}`);
  return hints.join(" · ") || "老師念提示，學生拼出英文。";
}

function createChooseTask(word) {
  const options = buildMeaningOptions(word);
  return {
    type: "choose",
    kicker: "Choose the Answer",
    title: word.en,
    prompt: `選出中文意思：${options.join(" / ")}`,
    support: "請學生選一個中文意思，老師再公布結果。",
    answer: word.zh,
  };
}

function createChanceTask(word) {
  const pool = [
    createSentenceTask(word, "Lucky: Make a sentence", 30),
    {
      type: "ask",
      kicker: "Team Challenge",
      title: word.en,
      prompt: `Ask a teammate: What is the Chinese meaning of ${word.en}?`,
      support: "If the teammate answers correctly, they also get $30.",
      bonus: 30,
    },
    {
      type: "spell",
      kicker: "Timed Spell the word",
      title: getSpellingTitle(word),
      prompt: "聽老師提示，5 秒內拼出英文。",
      answer: word.en,
      support: "老師可以放寬秒數，讓低年級也能玩。",
    },
  ];
  const task = randomItem(pool);
  if (task.type === "spell") {
    task.support = getSpellingSupport(word);
  }
  return task;
}

async function flipMemoryCard(target) {
  if (state.activeGame !== "memory" || !state.memory.started || state.memory.locked) return;
  const cardId = target.dataset.cardId;
  const card = state.memory.cards.find((item) => item.id === cardId);
  if (!card || state.memory.matchedIds.includes(card.id) || state.memory.flippedIds.includes(card.id)) return;
  target.blur?.();

  state.memory.flippedIds.push(card.id);
  if (state.memory.flippedIds.length < 2) {
    render();
    return;
  }

  const [firstId, secondId] = state.memory.flippedIds;
  const first = state.memory.cards.find((item) => item.id === firstId);
  const second = state.memory.cards.find((item) => item.id === secondId);
  state.memory.moves += 1;

  if (first && second && first.pairId === second.pairId && first.kind !== second.kind) {
    state.memory.matchedIds.push(first.id, second.id);
    const team = getMemoryTeam();
    state.memory.scores[team.id] = (state.memory.scores[team.id] || 0) + 1;
    const completed = state.memory.matchedIds.length === state.memory.cards.length;
    addMemoryLog(`${team.name} matched: ${first.kind === "英文" ? first.text : second.text}${completed ? "" : ". Next team."}`);
    triggerMemoryFeedback("success", completed ? `${team.name} completed the last pair!` : `${team.name} matched. Next team.`, team.id);
    state.memory.flippedIds = [];

    if (completed) {
      addMemoryLog("全部配對完成！");
      triggerCelebration("完成配對！");
      showToast("全部配對完成");
      render();
      requestAnimationFrame(() => {
        if (window.party) {
          party.confetti(document.body, {
            count: party.variation.range(80, 120),
            spread: party.variation.range(50, 80),
            size: party.variation.range(0.8, 1.4),
          });
        }
      });
    } else {
      advanceMemoryTeam();
      render();
      requestAnimationFrame(() => {
        if (window.party) {
          const board = document.querySelector(".memory-board");
          if (board) party.sparkles(board, { count: party.variation.range(12, 22) });
        }
      });
    }

    return;
  }

  state.memory.locked = true;
  const missedTeam = getMemoryTeam();
  addMemoryLog(`${missedTeam.name} missed. Next team.`);
  triggerMemoryFeedback("miss", `${missedTeam.name} missed. Next team.`, missedTeam.id);
  render();
  await wait(850);
  state.memory.flippedIds = [];
  state.memory.locked = false;
  advanceMemoryTeam();
  render();
}

function markCorrect() {
  if (state.game.phase !== "task" || isBusy()) return;
  const team = getCurrentTeam();
  const task = state.game.currentTask;
  const reward = 10 + (task.bonus || 0);
  const startBonus = state.game.passedStart ? 20 : 0;
  const delta = reward + startBonus;
  const teamId = team.id;

  team.score += delta;
  const logParts = [`答對了，加 ${reward} 分`];
  if (startBonus) logParts.push(`經過起點加 ${startBonus} 分`);
  addLog(`${team.name} ${logParts.join("、")}。`);

  triggerCelebration("答對了！");
  completeTurn("Correct. Points added.");
  showScoreFloat(teamId, delta);

  requestAnimationFrame(() => {
    if (window.party) {
      const btn = document.querySelector('[data-action="mark-correct"]') || document.querySelector(".celebration-card");
      const source = btn || document.body;
      party.confetti(source, {
        count: party.variation.range(40, 60),
        spread: party.variation.range(35, 55),
        size: party.variation.range(0.7, 1.2),
      });
    }
  });
}

function skipTask() {
  if (state.game.phase !== "task" || isBusy()) return;
  const team = getCurrentTeam();
  const teamId = team.id;
  team.score -= 5;
  const returnPos = state.game.preRollPosition ?? team.position;
  team.position = returnPos;
  addLog(`${team.name} 答錯，扣 5 分，退回格子 ${returnPos}。`);
  completeTurn("答錯！扣 5 分，退回原位。");
  showScoreFloat(teamId, -5);
}

function completeTurn(message) {
  state.game.phase = "ready";
  state.game.currentTask = null;
  state.game.passedStart = false;
  advanceTeam();
  showToast(message);
  render();
  requestAnimationFrame(() => {
    const activeRow = document.querySelector(".team-row.is-active");
    const teamList = document.querySelector(".team-list");
    if (activeRow && teamList) {
      const rowTop = activeRow.offsetTop - teamList.offsetTop;
      const rowBottom = rowTop + activeRow.offsetHeight;
      if (rowBottom > teamList.scrollTop + teamList.clientHeight || rowTop < teamList.scrollTop) {
        teamList.scrollTo({ top: rowTop, behavior: "smooth" });
      }
    }
  });
}

function showScoreFloat(teamId, delta) {
  requestAnimationFrame(() => {
    const row = document.querySelector(`[data-team-id="${teamId}"]`);
    if (!row) return;
    const el = document.createElement("div");
    el.className = `score-float ${delta >= 0 ? "score-float-pos" : "score-float-neg"}`;
    el.textContent = delta >= 0 ? `+${delta}` : `${delta}`;
    row.appendChild(el);
    el.addEventListener("animationend", () => el.remove());
  });
}

function advanceTeam() {
  state.game.currentTeamIndex = (state.game.currentTeamIndex + 1) % state.game.teams.length;
  if (state.game.currentTeamIndex === 0) {
    state.game.round += 1;
  }
}

function getCurrentTeam() {
  return state.game.teams[state.game.currentTeamIndex] || state.game.teams[0];
}

function getMemoryTeam() {
  return state.game.teams[state.memory.currentTeamIndex] || state.game.teams[0];
}

function getMemoryColumns() {
  const cardCount = state.memory.cards.length;
  if (cardCount <= 8) return 4;
  if (cardCount <= 12) return 4;
  return 5;
}

function isBusy() {
  return animation.rolling || Boolean(animation.movingTeamId);
}

function isActiveGameStarted() {
  if (state.view !== "game") return false;
  if (state.activeGame === "monopoly") return Boolean(state.game.started);
  if (state.activeGame === "memory") return Boolean(state.memory?.started);
  return false;
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function triggerCelebration(message) {
  animation.celebrate = true;
  animation.celebrationMessage = message;
  clearTimeout(celebrationTimer);
  celebrationTimer = setTimeout(() => {
    animation.celebrate = false;
    animation.celebrationMessage = "";
    document.querySelector(".celebration")?.remove();
  }, 1150);
}

function triggerMemoryFeedback(type, message, teamId) {
  animation.memoryFeedback = { type, message, teamId };
  clearTimeout(memoryFeedbackTimer);
  memoryFeedbackTimer = setTimeout(() => {
    animation.memoryFeedback = null;
    memoryFeedbackTimer = null;
    render();
  }, 2400);
}

function clearMemoryFeedback() {
  clearTimeout(memoryFeedbackTimer);
  memoryFeedbackTimer = null;
  animation.memoryFeedback = null;
}

function pickWord(tileIndex) {
  return drawWord();
}

function getLessonWords() {
  return Array.isArray(state.lesson?.words)
    ? state.lesson.words.map(normalizeWord).filter(isCompleteWord)
    : [];
}

function isCompleteWord(word) {
  return Boolean(String(word?.en || "").trim() && String(word?.zh || "").trim());
}

function getIncompleteWords(words = state.lesson?.words || []) {
  return Array.isArray(words)
    ? words.map(normalizeWord).filter((word) => (word.en || word.zh || word.phonetic || word.image) && !isCompleteWord(word))
    : [];
}

function getDisplayTileType(tileType, tileIndex) {
  if (tileType === "start" || tileType === "chance") return tileType;

  const taskType = resolveTaskType(tileType, tileIndex);
  return {
    say: "word",
    sentence: "sentence",
    spell: "spell",
    ask: "ask",
    act: "action",
    choose: "choose",
  }[taskType] || "word";
}

function resolveTaskType(tileType, tileIndex = 0) {
  const enabled = normalizeTaskList(state.game.enabledTasks, defaultLesson.enabledTasks);
  const mapped = {
    word: "say",
    sentence: "sentence",
    spell: "spell",
    ask: "ask",
    action: "act",
    choose: "choose",
  }[tileType];
  return enabled.includes(mapped) ? mapped : enabled[Math.abs(tileIndex) % enabled.length];
}

function drawWord() {
  const words = getLessonWords();
  if (!words.length) {
    state.game.wordDrawPile = [];
    state.game.lastWordIndex = null;
    return null;
  }

  if (!state.game.wordDrawPile?.length) {
    state.game.wordDrawPile = buildWordDrawPile(words.length);
  }

  if (words.length > 1 && state.game.wordDrawPile.length === 1 && state.game.wordDrawPile[0] === state.game.lastWordIndex) {
    state.game.wordDrawPile = buildWordDrawPile(words.length)
      .filter((wordIndex) => wordIndex !== state.game.lastWordIndex);
  }

  let wordIndex = state.game.wordDrawPile.pop();
  if (!Number.isInteger(wordIndex)) {
    wordIndex = 0;
  }

  state.game.lastWordIndex = wordIndex;
  return words[wordIndex % words.length] || null;
}

function resetWordDrawPile() {
  state.game.wordDrawPile = buildWordDrawPile(getLessonWords().length);
  state.game.lastWordIndex = null;
}

function buildMeaningOptions(word) {
  const meanings = state.lesson.words
    .map((item) => normalizeWord(item).zh)
    .filter(Boolean)
    .filter((meaning) => meaning !== word.zh);
  const shuffled = shuffle(meanings).slice(0, 2);
  return shuffle([word.zh, ...shuffled]);
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function addLog(message) {
  state.game.log.push(message);
  if (state.game.log.length > 80) {
    state.game.log = state.game.log.slice(-80);
  }
}

function addMemoryLog(message) {
  state.memory.log.push(message);
  if (state.memory.log.length > 80) {
    state.memory.log = state.memory.log.slice(-80);
  }
}

function advanceMemoryTeam() {
  state.memory.currentTeamIndex = (state.memory.currentTeamIndex + 1) % state.game.teams.length;
}

function showToast(message) {
  state.toast = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    state.toast = "";
    document.querySelector(".toast")?.remove();
    saveState();
  }, 2200);
}

function cancelCourseAutosave() {
  clearTimeout(courseAutosaveTimer);
  courseAutosaveTimer = null;
  courseAutosaveQueued = false;
}

function canQueueCourseAutosave() {
  // 既有課程走更新；全新草稿在補齊第一筆完整單字後也會自動建立（不再需要「建立課程」按鈕）。
  const isExisting = isEditingExistingCourse();
  const hasCompleteWords = Boolean(getLessonWords().length);
  return state.view === "teacher"
    && isTeacherUnlocked()
    && Boolean(getTeacherWriteToken())
    && !getIncompleteWords().length
    && (isExisting || (state.courseEditor?.mode === "new" && hasCompleteWords));
}

function canAutosaveCourse() {
  return canQueueCourseAutosave()
    && !cloudSave.saving
    && !cloudSave.verifying;
}

function scheduleCourseAutosave() {
  clearTimeout(courseAutosaveTimer);
  courseAutosaveTimer = null;
  if (!canQueueCourseAutosave()) {
    courseAutosaveQueued = false;
    return;
  }

  if (cloudSave.saving || cloudSave.verifying) {
    courseAutosaveQueued = true;
    cloudSave.tokenMessage = "目前同步完成後會再自動同步一次。";
    updateTeacherTokenFeedback();
    return;
  }

  courseAutosaveQueued = false;

  cloudSave.tokenStatus = cloudSave.tokenStatus === "saved" ? "saved" : "verified";
  cloudSave.tokenMessage = "已排程自動同步 Supabase。";
  updateTeacherTokenFeedback();

  courseAutosaveTimer = setTimeout(() => {
    autosaveCurrentCourse();
  }, COURSE_AUTOSAVE_DELAY);
}

async function autosaveCurrentCourse() {
  courseAutosaveTimer = null;
  if (!canAutosaveCourse()) return;

  const prepared = prepareCourseForSave();
  if (!prepared.ok) {
    // 名稱／網址代碼衝突等問題：已無「建立課程」按鈕代為提示，改在左欄狀態列顯示完整原因，避免靜默不同步。
    cloudSave.tokenStatus = "error";
    cloudSave.tokenMessage = prepared.message || "課程尚未同步。";
    refreshCourseLibraryPanel();
    return;
  }

  // 全新草稿第一次通過（有完整單字、名稱/代碼不衝突）就在此自動建立並發布課程。
  const isFirstPublish = prepared.mode === "new";
  const token = getTeacherWriteToken();
  const lesson = normalizeLesson(prepared.lesson);
  state.lesson = lesson;
  cloudSave.saving = true;
  cloudSave.tokenStatus = cloudSave.tokenStatus === "saved" ? "saved" : "verified";
  cloudSave.tokenMessage = isFirstPublish ? "正在建立課程並同步 Supabase。" : "正在自動同步 Supabase。";
  updateTeacherTokenFeedback();

  try {
    const result = await saveCourseToCloud(lesson, token, prepared);
    upsertCloudCourseAfterSave(result, lesson);
    cloudSave.tokenStatus = "saved";
    cloudSave.tokenMessage = `已自動同步：${new Intl.DateTimeFormat("zh-TW", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date())}`;
    saveState();
    if (isFirstPublish) {
      // 剛從草稿轉為正式課程：需要 render 讓課程清單顯示新課程、並切換成既有課程的 UI。
      showToast(`已自動建立並發布課程：${result.name || lesson.name}`);
      render();
    } else {
      // 既有課程更新成功：只刷新左側清單顯示新的名稱／網址代碼，不重繪右側以免打斷輸入。
      refreshCourseLibraryPanel();
    }
  } catch (error) {
    console.warn("Unable to autosave course to Supabase", error);
    if (isTeacherTokenError(error)) {
      clearTeacherWriteToken();
      cloudSave.tokenStatus = "invalid";
      cloudSave.tokenMessage = "寫入密碼錯誤，請重新登入後台。";
      showToast("寫入密碼錯誤，請重新登入後台");
      render();
      return;
    }

    cloudSave.tokenStatus = "error";
    cloudSave.tokenMessage = error.message || "自動同步失敗，請稍後手動寫入 Supabase。";
    showToast(error.message || "自動同步失敗，請稍後手動寫入 Supabase");
    render();
  } finally {
    cloudSave.saving = false;
    if (courseAutosaveQueued) {
      courseAutosaveQueued = false;
      scheduleCourseAutosave();
    } else {
      updateTeacherTokenFeedback();
    }
  }
}

function prepareCourseForSave() {
  const lesson = normalizeLesson(state.lesson);
  const courses = loadCourseLibrary();
  const selectedCourse = getSelectedCourse();
  const incompleteWords = getIncompleteWords(lesson.words);
  const completeWords = lesson.words.filter(isCompleteWord);

  if (incompleteWords.length) {
    return {
      ok: false,
      message: `${incompleteWords.length} 筆單字缺少 en 或 zh，請補齊後再同步。`,
    };
  }

  if (isEditingExistingCourse()) {
    lesson.slug = createCourseSlug(lesson.slug || lesson.name);
    const collision = courses.find((course) => (
      course.id !== selectedCourse?.id
      && createCourseSlug(course.lesson?.slug || course.lesson?.name) === lesson.slug
    ));

    if (collision) {
      return {
        ok: false,
        message: `課程網址代碼已被「${collision.lesson.name}」使用，請換一個代碼。`,
      };
    }

    const nameKey = String(lesson.name || "").trim().toLowerCase();
    const nameCollision = courses.find((course) => (
      course.id !== selectedCourse?.id
      && String(course.lesson?.name || "").trim().toLowerCase() === nameKey
    ));

    if (nameCollision) {
      return {
        ok: false,
        message: `課程名稱已被「${nameCollision.lesson.name}」使用，請換一個名稱。`,
      };
    }

    state.lesson = lesson;
    return {
      ok: true,
      mode: "existing",
      lesson,
      selectedCourse,
      lockedSlug: lesson.slug,
      isPublished: Boolean(completeWords.length),
      sortOrder: getSavedCourseSortOrder(selectedCourse),
    };
  }

  if (!completeWords.length) {
    return {
      ok: false,
      message: "請至少新增一筆 en + zh 完整的單字。",
    };
  }

  lesson.slug = createCourseSlug(lesson.slug || lesson.name);
  const collision = courses.find((course) => (
    createCourseSlug(course.lesson?.slug || course.lesson?.name) === lesson.slug
  ));

  if (collision) {
    return {
      ok: false,
      message: `網址代碼已屬於「${collision.lesson.name}」，請先載入該課程或改用其他代碼。`,
    };
  }

  const nameKey = String(lesson.name || "").trim().toLowerCase();
  const nameCollision = courses.find((course) => (
    String(course.lesson?.name || "").trim().toLowerCase() === nameKey
  ));

  if (nameCollision) {
    return {
      ok: false,
      message: `課程名稱已屬於「${nameCollision.lesson.name}」，請先載入該課程或改用其他名稱。`,
    };
  }

  state.lesson = lesson;
  return {
    ok: true,
    mode: "new",
    lesson,
    selectedCourse: null,
    lockedSlug: lesson.slug,
    isPublished: true,
    sortOrder: getNewCourseSortOrder(),
  };
}

async function saveCourseToCloud(lesson, token, saveContext = {}) {
  const words = lesson.words.filter(isCompleteWord);
  if (!words.length && saveContext.mode !== "existing") {
    throw new Error("請至少新增一筆 en + zh 完整的單字再寫入 Supabase");
  }

  const course = await saveSupabaseCourseWithWords(lesson, words, token, saveContext);

  return {
    id: course.id,
    slug: course.slug || lesson.slug,
    name: course.name || lesson.name,
    wordCount: course.word_count != null ? Number(course.word_count) : words.length,
    sortOrder: Number.isFinite(Number(course.sort_order)) ? Number(course.sort_order) : Number(saveContext.sortOrder),
  };
}

async function saveSupabaseCourseWithWords(lesson, words, token, saveContext = {}) {
  const selectedId = saveContext.selectedCourse?.id || "";
  const courseId = saveContext.mode === "existing" && isUuid(selectedId) ? selectedId : null;

  const payload = {
    p_course_id: courseId,
    p_slug: lesson.slug,
    p_name: lesson.name,
    p_tags: lesson.tags || [],
    p_enabled_tasks: lesson.enabledTasks || [],
    p_is_published: Boolean(saveContext.isPublished),
    p_sort_order: Number.isFinite(Number(saveContext.sortOrder)) ? Number(saveContext.sortOrder) : null,
    p_words: getSupabaseWordPayload(words),
  };

  let response = await fetchSupabaseRest("rpc/save_course_with_words", token, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  let responsePayload;
  try {
    responsePayload = await parseSupabaseCourseResponse(response);
  } catch (error) {
    if (!isMissingSortOrderError(error)) throw error;
    const { p_sort_order: _sortOrder, ...legacyPayload } = payload;
    response = await fetchSupabaseRest("rpc/save_course_with_words", token, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(legacyPayload),
    });
    responsePayload = await parseSupabaseCourseResponse(response);
  }

  const course = Array.isArray(responsePayload) ? responsePayload[0] : responsePayload;
  if (!course?.id) {
    throw new Error("Supabase 沒有回傳課程 ID");
  }

  return course;
}

function getSupabaseWordPayload(words) {
  return words.map((item, index) => ({
    position: index,
    en: item.en,
    zh: item.zh,
    sentence: "",
    phonetic: item.phonetic || "",
    image: item.image || "",
  }));
}

function upsertCloudCourseAfterSave(result, lesson) {
  if (!result?.id) return;

  const courses = loadCourseLibrary();
  const lessonSlug = createCourseSlug(result.slug || lesson.slug);
  const index = courses.findIndex((course) => (
    course.id === result.id
    || createCourseSlug(course.lesson?.slug || course.lesson?.name) === lessonSlug
  ));
  const now = Date.now();
  const savedCourse = normalizeSavedCourse({
    ...(index >= 0 ? courses[index] : {}),
    id: result.id,
    lesson: {
      ...(index >= 0 ? courses[index].lesson : lesson),
      slug: result.slug || lesson.slug,
      name: result.name || lesson.name,
      tags: lesson.tags || [],
      enabledTasks: lesson.enabledTasks || [],
      words: lesson.words || [],
    },
    createdAt: index >= 0 ? courses[index].createdAt : now,
    updatedAt: now,
    sortOrder: Number.isFinite(Number(result.sortOrder))
      ? Number(result.sortOrder)
      : index >= 0
        ? getSavedCourseSortOrder(courses[index])
        : getNewCourseSortOrder(),
  });

  if (index >= 0) {
    courses[index] = savedCourse;
  } else {
    courses.unshift(savedCourse);
  }

  saveCourseLibrary(courses);
  setCourseEditorCourse(savedCourse);
}

async function parseSupabaseCourseResponse(response) {
  try {
    return await parseSupabaseResponse(response);
  } catch (error) {
    if (error.code === "23505") {
      const lowerMessage = String(error.message || "").toLowerCase();
      const conflictTarget = lowerMessage.includes("courses_name_lower_key")
        ? "課程名稱"
        : lowerMessage.includes("courses_slug_key")
          ? "課程網址代碼"
          : "課程資料";
      const conflictError = new Error(`雲端已有相同${conflictTarget}，請換一個值或載入既有課程。`);
      conflictError.status = 409;
      conflictError.code = error.code;
      throw conflictError;
    }
    throw error;
  }
}

function isMissingSortOrderError(error) {
  if (!error) return false;
  const text = [
    error.code,
    error.message,
    error.details,
    error.hint,
  ].filter(Boolean).join(" ").toLowerCase();

  return text.includes("sort_order")
    || text.includes("p_sort_order")
    || text.includes("reorder_courses");
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

async function fetchSupabaseRest(path, token, options = {}) {
  const { url, anonKey } = getSupabaseConfig();
  if (!url || !anonKey) {
    throw new Error("Supabase 前端設定不完整");
  }

  const headers = {
    "apikey": anonKey,
    "Authorization": `Bearer ${anonKey}`,
    "x-teacher-token": token,
    ...(options.headers || {}),
  };

  return fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers,
  });
}

async function parseSupabaseResponse(response) {
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = payload?.message || payload?.error || `Supabase 同步失敗 (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    error.code = payload?.code || "";
    throw error;
  }

  return payload;
}

function updateTeacherTokenInput(target) {
  const normalized = String(target.value || "").trim();
  teacherAccessUnlocked = false;
  if (normalized) {
    storeTeacherWriteToken(normalized);
    cloudSave.tokenStatus = "pending";
    cloudSave.tokenMessage = "請按「進入後台」完成登入。";
  } else {
    clearTeacherWriteToken();
    cloudSave.tokenStatus = "empty";
    cloudSave.tokenMessage = "";
  }
  updateTeacherTokenFeedback();
}

function updateTeacherTokenFeedback() {
  const status = getTeacherWriteTokenStatus();
  const statusElement = document.querySelector(".cloud-token-status");
  if (statusElement) {
    statusElement.className = `cloud-token-status ${status.className}`;
    statusElement.textContent = status.message;
  }

  refreshTeacherSyncBar();

  const hasToken = Boolean(getTeacherWriteToken());
  const disabled = cloudSave.saving || cloudSave.verifying;
  const verifyButton = document.querySelector('[data-action="verify-teacher-token"]');
  const clearButton = document.querySelector('[data-action="clear-teacher-token"]');
  if (verifyButton) verifyButton.disabled = disabled || !hasToken;
  if (clearButton) clearButton.disabled = disabled || !hasToken;
}

async function verifyTeacherWriteToken() {
  if (cloudSave.saving || cloudSave.verifying) return false;

  const token = getTeacherWriteToken();
  if (!token) {
    cloudSave.tokenStatus = "empty";
    cloudSave.tokenMessage = "";
    showToast("請先輸入寫入密碼");
    render();
    return false;
  }

  cloudSave.verifying = true;
  cloudSave.tokenStatus = "pending";
  cloudSave.tokenMessage = "";
  showToast("正在驗證寫入密碼");
  render();

  try {
    const allowed = await verifyTeacherWriteTokenValue(token);
    if (!allowed) {
      throw createTeacherTokenError();
    }

    teacherAccessUnlocked = true;
    cloudSave.tokenStatus = "verified";
    cloudSave.tokenMessage = "密碼正確，可以寫入 Supabase。";
    showToast("寫入密碼已驗證");
    await syncCloudCourseLibrary();
    return true;
  } catch (error) {
    console.warn("Unable to verify teacher write token", error);
    if (isTeacherTokenError(error)) {
      clearTeacherWriteToken();
      teacherAccessUnlocked = false;
      cloudSave.tokenStatus = "invalid";
      cloudSave.tokenMessage = "寫入密碼錯誤，請重新輸入。";
      showToast("寫入密碼錯誤");
    } else {
      cloudSave.tokenStatus = "error";
      cloudSave.tokenMessage = error.message || "驗證失敗，請稍後再試。";
      showToast(error.message || "驗證失敗，請稍後再試");
    }
    return false;
  } finally {
    cloudSave.verifying = false;
    render();
  }
}

async function verifyTeacherWriteTokenValue(token) {
  const response = await fetchSupabaseRest("rpc/teacher_write_allowed", token, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  const payload = await parseSupabaseResponse(response);
  return payload === true;
}

function createTeacherTokenError() {
  const error = new Error("寫入密碼錯誤");
  error.status = 401;
  return error;
}

function isTeacherTokenError(error) {
  return error?.status === 401
    || error?.status === 403
    || error?.code === "42501";
}

function getTeacherWriteToken() {
  try {
    return sessionStorage.getItem(TEACHER_WRITE_TOKEN_KEY) || "";
  } catch (error) {
    return "";
  }
}

function storeTeacherWriteToken(token) {
  try {
    sessionStorage.setItem(TEACHER_WRITE_TOKEN_KEY, token);
  } catch (error) {
    console.warn("Unable to store teacher write token", error);
  }
}

function clearTeacherWriteToken() {
  try {
    sessionStorage.removeItem(TEACHER_WRITE_TOKEN_KEY);
  } catch (error) {
    console.warn("Unable to clear teacher write token", error);
  }
  teacherAccessUnlocked = false;
}

function clearTeacherTokenInput() {
  cancelCourseAutosave();
  clearTeacherWriteToken();
  cloudSave.tokenStatus = "empty";
  cloudSave.tokenMessage = "";
  showToast("已清除寫入密碼");
  render();
}

function loadSavedCourse(target) {
  loadCourseById(target.dataset.courseId);
}

function loadCourseById(courseId) {
  cancelCourseAutosave();
  const course = loadCourseLibrary().find((item) => item.id === courseId);
  if (!course) {
    showToast("找不到這份課程");
    render();
    return;
  }

  setActiveLesson(course.lesson);
  setCourseEditorCourse(course);
  state.view = "teacher";
  showToast(`已載入課程：${state.lesson.name}`);
  render();
}

function startNewCourse() {
  cancelCourseAutosave();
  setActiveLesson(createBlankLesson());
  state.courseEditor = freshCourseEditorState("new");
  state.view = "teacher";
  state.chromeCollapsed = false;
  showToast("已建立新的課程表單");
  render();
}

function duplicateCurrentCourse() {
  cancelCourseAutosave();
  const lesson = normalizeLesson(state.lesson);
  const baseSlug = createCourseSlug(`${lesson.slug || lesson.name}-copy`);
  lesson.name = createUniqueCourseName(`${lesson.name} 副本`);
  lesson.slug = createUniqueCourseSlug(baseSlug);
  setActiveLesson(lesson);
  state.courseEditor = freshCourseEditorState("new");
  state.view = "teacher";
  state.chromeCollapsed = false;
  showToast("已複製成新課程草稿");
  // 複製出來的草稿已帶完整單字，直接排程自動建立（不再需要「建立課程」按鈕）。
  scheduleCourseAutosave();
  render();
}

async function copyCurrentCourseLink() {
  await copyCourseLinkBySlug(state.lesson.slug || state.lesson.name);
}

async function copySavedCourseLink(target) {
  await copyCourseLinkBySlug(target.dataset.courseSlug);
}

async function copyCourseLinkBySlug(slug) {
  const url = getCourseGamePageUrl(slug);
  try {
    await navigator.clipboard.writeText(url);
    showToast("已複製遊戲連結");
  } catch (error) {
    console.warn("Unable to copy course link", error);
    showToast("遊戲連結已產生，可從網址列複製");
  }
  render();
}

async function moveSavedCourse(target) {
  const courseId = target.dataset.courseId || "";
  const direction = target.dataset.direction === "down" ? "down" : "up";
  const token = getTeacherWriteToken();

  if (!token) {
    cloudSave.tokenStatus = "empty";
    cloudSave.tokenMessage = "";
    showToast("請先登入老師後台");
    render();
    return;
  }

  if (cloudSave.saving || cloudSave.verifying || courseAutosaveTimer || courseAutosaveQueued) {
    showToast("同步完成後再調整排序");
    render();
    return;
  }

  const courses = loadCourseLibrary();
  const currentIndex = courses.findIndex((course) => course.id === courseId);
  const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= courses.length) return;

  const previousOrder = courses;
  const reordered = [...courses];
  [reordered[currentIndex], reordered[nextIndex]] = [reordered[nextIndex], reordered[currentIndex]];
  const normalizedOrder = assignCourseSortOrders(reordered);
  saveCourseLibrary(normalizedOrder);

  cloudSave.saving = true;
  cloudSave.operation = "course-order";
  cloudSave.tokenStatus = cloudSave.tokenStatus === "saved" ? "saved" : "verified";
  cloudSave.tokenMessage = "正在同步課程排序。";
  refreshCourseLibraryPanel();

  try {
    await saveCourseOrderToCloud(normalizedOrder, token);
    cloudSave.tokenStatus = "saved";
    cloudSave.tokenMessage = `課程排序已同步：${new Intl.DateTimeFormat("zh-TW", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date())}`;
    showToast("課程排序已同步");
  } catch (error) {
    console.warn("Unable to reorder courses", error);
    saveCourseLibrary(previousOrder);
    if (isTeacherTokenError(error)) {
      clearTeacherWriteToken();
      cloudSave.tokenStatus = "invalid";
      cloudSave.tokenMessage = "寫入密碼錯誤，請重新登入後台。";
      showToast("寫入密碼錯誤，排序未同步");
      render();
      return;
    }

    cloudSave.tokenStatus = "error";
    cloudSave.tokenMessage = isMissingSortOrderError(error)
      ? "資料庫尚未套用課程排序 schema，請先更新 Supabase。"
      : error.message || "課程排序同步失敗。";
    showToast(cloudSave.tokenMessage);
  } finally {
    cloudSave.saving = false;
    cloudSave.operation = "";
    refreshCourseLibraryPanel();
  }
}

async function saveCourseOrderToCloud(courses, token) {
  const response = await fetchSupabaseRest("rpc/reorder_courses", token, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_course_ids: courses.map((course) => course.id),
    }),
  });

  await parseSupabaseResponse(response);
}

function requestDeleteSavedCourse(target) {
  courseDelete.pendingCourseId = target.dataset.courseId || "";
  showToast("請再按一次確認刪除");
  render();
}

function cancelDeleteSavedCourse() {
  courseDelete.pendingCourseId = "";
  courseDelete.deletingCourseId = "";
  render();
}

async function deleteSavedCourse(target) {
  cancelCourseAutosave();
  const courseId = target.dataset.courseId;
  if (!courseId || courseDelete.deletingCourseId) return;

  const courses = loadCourseLibrary();
  const course = courses.find((item) => item.id === courseId);
  if (!course) {
    courseDelete.pendingCourseId = "";
    showToast("找不到這份課程");
    render();
    return;
  }

  if (courseDelete.pendingCourseId !== courseId) {
    requestDeleteSavedCourse(target);
    return;
  }

  const token = getTeacherWriteToken();
  if (!token) {
    cloudSave.tokenStatus = "empty";
    cloudSave.tokenMessage = "";
    showToast("請先登入老師後台");
    render();
    return;
  }

  courseDelete.deletingCourseId = courseId;
  showToast("正在刪除雲端課程");
  render();

  try {
    if (cloudSave.tokenStatus !== "verified" && !(await verifyTeacherWriteTokenValue(token))) {
      throw createTeacherTokenError();
    }
    await deleteCourseFromCloud(course.id, token);

    removeCourseFromCloudLibrary(courseId);
    if (state.courseEditor?.selectedCourseId === courseId) {
      setActiveLesson(createBlankLesson());
      state.courseEditor = freshCourseEditorState("new");
      state.view = "teacher";
    }
    showToast(`已刪除雲端課程：${course.lesson.name}`);
  } catch (error) {
    console.warn("Unable to delete course", error);
    if (isTeacherTokenError(error)) {
      clearTeacherWriteToken();
      cloudSave.tokenStatus = "invalid";
      cloudSave.tokenMessage = "寫入密碼錯誤，請重新輸入。";
      showToast("寫入密碼錯誤，未刪除課程");
    } else {
      showToast(error.message || "課程刪除失敗");
    }
  } finally {
    courseDelete.pendingCourseId = "";
    courseDelete.deletingCourseId = "";
    render();
  }
}

async function deleteCourseFromCloud(courseId, token) {
  const response = await fetchSupabaseRest(`courses?id=eq.${encodeURIComponent(courseId)}&select=id`, token, {
    method: "DELETE",
    headers: {
      "Prefer": "return=representation",
    },
  });
  await parseSupabaseResponse(response);
}

function removeCourseFromCloudLibrary(courseId) {
  const courses = loadCourseLibrary();
  saveCourseLibrary(courses.filter((item) => item.id !== courseId));
}

function formatSavedAt(timestamp) {
  if (!timestamp) return "未記錄時間";
  return new Intl.DateTimeFormat("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function showGameHub() {
  state.view = "game";
  state.activeGame = "hub";
  state.chromeCollapsed = false;
  clearMemoryFeedback();
  render();
}

function selectGame(target) {
  const game = target.dataset.game;
  if (!gameCatalog[game]) return;
  if (!getLessonWords().length) {
    showToast("請先在老師後台新增單字");
    render();
    return;
  }

  state.view = "game";
  state.activeGame = game;
  state.chromeCollapsed = false;
  if (game === "monopoly") {
    state.game.started = false;
  }
  if (game === "memory") {
    state.memory.started = false;
    state.memory.locked = false;
  }
  clearMemoryFeedback();
  render();
}

function openGameSetup() {
  state.view = "game";
  state.activeGame = "monopoly";
  state.chromeCollapsed = false;
  state.game.started = false;
  if (state.game.phase === "task") {
    state.game.phase = "ready";
    state.game.currentTask = null;
  }
  render();
}

function openCurrentGameSetup() {
  if (state.activeGame === "memory") {
    clearMemoryFeedback();
    state.memory.started = false;
    state.memory.locked = false;
    state.chromeCollapsed = false;
    render();
    return;
  }

  openGameSetup();
}

function startGame() {
  if (state.activeGame === "memory") {
    startMemoryGame();
    return;
  }

  if (!getLessonWords().length) {
    showToast("請先在老師後台新增單字");
    render();
    return;
  }

  state.activeGame = "monopoly";
  state.view = "game";
  state.chromeCollapsed = false;
  state.game = freshGameState({
    teams: state.game.teams,
    wordCount: getLessonWords().length,
    enabledTasks: state.game.enabledTasks,
    started: true,
  });
  showToast("本局遊戲開始");
  render();
}

function resetGame() {
  if (state.activeGame === "memory") {
    resetMemoryGame();
    return;
  }

  state.game = freshGameState({
    teams: state.game.teams,
    wordCount: getLessonWords().length,
    enabledTasks: state.game.enabledTasks,
  });
  state.chromeCollapsed = false;
  showToast("遊戲已重開");
  render();
}

function startMemoryGame() {
  if (!getLessonWords().length) {
    showToast("請先在老師後台新增單字");
    render();
    return;
  }

  state.view = "game";
  state.activeGame = "memory";
  state.chromeCollapsed = false;
  clearMemoryFeedback();
  state.memory = freshMemoryState({
    teams: state.game.teams,
    pairCount: state.memory?.pairCount || 6,
    imageMode: state.memory?.imageMode,
    started: true,
  });
  showToast("記憶翻牌開始");
  render();
}

function resetMemoryGame() {
  clearMemoryFeedback();
  state.memory = freshMemoryState({
    teams: state.game.teams,
    pairCount: state.memory?.pairCount || 6,
    imageMode: state.memory?.imageMode,
    started: false,
  });
  state.chromeCollapsed = false;
  showToast("記憶翻牌已重開");
  render();
}

function loadDemo() {
  cancelCourseAutosave();
  const lesson = structuredClone(defaultLesson);
  lesson.slug = createUniqueCourseSlug(`${lesson.slug}-demo`);
  lesson.name = createUniqueCourseName(lesson.name);
  setActiveLesson(lesson);
  state.courseEditor = freshCourseEditorState("new");
  state.chromeCollapsed = false;
  showToast("已載入範例課程");
  render();
}

function updateLessonField(target) {
  const field = target.dataset.field;
  if (!field) return;
  state.lesson[field] = field === "slug" ? createCourseSlug(target.value) : target.value;
  scheduleCourseAutosave();
  saveState();
}

function updateTags(target) {
  state.lesson.tags = target.value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  scheduleCourseAutosave();
  saveState();
}

function updateMemoryPairCount(target) {
  const maxPairs = Math.min(12, getLessonWords().length);
  state.memory.pairCount = maxPairs ? clamp(Number(target.value) || 1, 1, maxPairs) : 0;
  state.memory.cards = buildMemoryCards(state.memory.pairCount, state.memory.imageMode);
  state.memory.flippedIds = [];
  state.memory.matchedIds = [];
  state.memory.started = false;
  saveState();
}

function toggleTask(target) {
  const task = target.dataset.task;
  if (!task) return;

  state.game.enabledTasks = updateEnabledTaskList(state.game.enabledTasks, task, target.checked);
  render();
}

function toggleLessonTask(target) {
  const task = target.dataset.task;
  if (!task) return;

  state.lesson.enabledTasks = updateEnabledTaskList(state.lesson.enabledTasks, task, target.checked);
  if (!state.game.started) {
    state.game.enabledTasks = [...state.lesson.enabledTasks];
  }
  saveState();
  scheduleCourseAutosave();
  render();
}

function addWord(form) {
  const formData = new FormData(form);
  const word = normalizeWord({
    en: formData.get("en"),
    zh: formData.get("zh"),
  });

  if (!word.en || !word.zh) {
    showToast("請先輸入 en 和 zh");
    render();
    return;
  }

  state.lesson.words.push(word);
  resetWordDrawPile();
  if (!state.memory.started) {
    state.memory = freshMemoryState({
      teams: state.game.teams,
      pairCount: state.memory?.pairCount || 6,
      imageMode: state.memory?.imageMode,
    });
  }
  form.reset();
  showToast(`已新增 ${word.en}`);
  scheduleCourseAutosave();
  render();
}

function updateWord(target) {
  const index = Number(target.dataset.index);
  const field = target.dataset.field;
  if (!Number.isInteger(index) || !field || !state.lesson.words[index]) return;
  state.lesson.words[index][field] = target.value;
  if (field === "en" || field === "zh") {
    resetWordDrawPile();
    if (!state.memory.started) {
      state.memory = freshMemoryState({
        teams: state.game.teams,
        pairCount: state.memory?.pairCount || 6,
        imageMode: state.memory?.imageMode,
      });
    }
  }
  scheduleCourseAutosave();
  saveState();
}

function toggleWordExtra(target) {
  const index = Number(target.dataset.index);
  if (!Number.isInteger(index)) return;
  if (teacherUi.expandedWordIndexes.has(index)) {
    teacherUi.expandedWordIndexes.delete(index);
  } else {
    teacherUi.expandedWordIndexes.add(index);
  }
  render();
}

function updateTeam(target) {
  const index = Number(target.dataset.index);
  const field = target.dataset.field;
  const team = state.game.teams[index];
  if (!team || !field) return;
  team[field] = target.value;
  saveState();
}

function addTeam() {
  const usedColors = new Set(state.game.teams.map(t => t.color));
  const usedAvatars = new Set(state.game.teams.map(t => t.avatar));
  const usedNames = new Set(state.game.teams.map(t => t.name));

  const color = teamColors.find(c => !usedColors.has(c)) ?? teamColors[state.game.teams.length % teamColors.length];
  const avatar = TEAM_AVATARS.find(a => !usedAvatars.has(a)) ?? TEAM_AVATARS[state.game.teams.length % TEAM_AVATARS.length];

  let name, i = 0;
  do { name = getDefaultTeamName(i++); } while (usedNames.has(name) && i < 100);

  state.game.teams.push({ id: `team-${Date.now()}`, name, color, avatar, position: 0, score: 0 });
  showToast("已新增隊伍");
  render();
}

function deleteTeam(target) {
  if (state.game.teams.length <= 1) return;
  const index = Number(target.dataset.index);
  if (!Number.isInteger(index) || !state.game.teams[index]) return;
  const removed = state.game.teams.splice(index, 1)[0];

  if (state.game.currentTeamIndex > index) {
    state.game.currentTeamIndex -= 1;
  } else if (state.game.currentTeamIndex >= state.game.teams.length) {
    state.game.currentTeamIndex = 0;
  }

  if (state.memory.currentTeamIndex > index) {
    state.memory.currentTeamIndex -= 1;
  } else if (state.memory.currentTeamIndex >= state.game.teams.length) {
    state.memory.currentTeamIndex = 0;
  }
  delete state.memory.scores[removed.id];

  state.game.phase = "ready";
  state.game.currentTask = null;
  state.game.currentTile = getCurrentTeam().position;

  addLog(`${removed.name} was removed from the game.`);
  showToast("Team deleted");
  render();
}

function deleteWord(target) {
  const index = Number(target.dataset.index);
  if (!Number.isInteger(index)) return;
  const removed = state.lesson.words.splice(index, 1)[0];
  teacherUi.expandedWordIndexes.clear();
  resetWordDrawPile();
  if (!state.memory.started) {
    state.memory = freshMemoryState({
      teams: state.game.teams,
      pairCount: state.memory?.pairCount || 6,
      imageMode: state.memory?.imageMode,
    });
  }
  showToast(removed ? `已刪除 ${normalizeWord(removed).en || "單字"}` : "已刪除");
  scheduleCourseAutosave();
  render();
}

function clearWords() {
  state.lesson.words = [];
  state.game = freshGameState({
    teams: state.game.teams,
    wordCount: getLessonWords().length,
    enabledTasks: state.game.enabledTasks,
  });
  state.memory = freshMemoryState({
    teams: state.game.teams,
    imageMode: state.memory?.imageMode,
  });
  showToast("單字已清空");
  scheduleCourseAutosave();
  render();
}

function importCsv() {
  const textarea = document.querySelector("#csvInput");
  const rows = parseCsv(textarea.value);
  if (!rows.length) {
    showToast("沒有可匯入的資料");
    render();
    return;
  }

  const normalized = rows
    .map((row) => row.map((cell) => cell.trim()))
    .filter((row) => row.some(Boolean));

  const hasHeader = normalized[0] && normalized[0].some((cell) => /word|meaning|英文|中文|en|zh/i.test(cell));
  const dataRows = hasHeader ? normalized.slice(1) : normalized;
  const hasExtraColumns = dataRows.some((row) => row.length > 2);
  const words = dataRows
    .map(([en, zh]) => normalizeWord({ en, zh }))
    .filter((item) => item.en && item.zh);

  if (!words.length) {
    showToast("CSV 需要包含 en 和 zh 兩個欄位");
    render();
    return;
  }

  if (hasExtraColumns) {
    showToast("CSV 格式已更新，只取前兩欄（英文、中文），分類與例句已略過");
  }

  state.lesson.words = words;
  state.game = freshGameState({
    teams: state.game.teams,
    wordCount: getLessonWords().length,
    enabledTasks: state.game.enabledTasks,
  });
  state.memory = freshMemoryState({
    teams: state.game.teams,
    pairCount: state.memory?.pairCount || 6,
    imageMode: state.memory?.imageMode,
  });
  textarea.value = "";
  showToast(`已匯入 ${words.length} 個單字`);
  scheduleCourseAutosave();
  render();
}

function exportCsv() {
  const rows = [
    ["英文單字", "中文提示"],
    ...state.lesson.words.map((item) => {
      const word = normalizeWord(item);
      return [word.en, word.zh];
    }),
  ];
  const csv = rows.map((row) => row.map(quoteCsv).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${sanitizeFileName(state.lesson.name || "lesson")}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("CSV 已匯出");
  render();
}

function normalizeWord(item) {
  const en = String(item.en ?? item.word ?? "").trim();
  const zh = String(item.zh ?? item.meaning ?? "").trim();
  return {
    en,
    zh,
    sentence: "",
    phonetic: String(item.phonetic || "").trim(),
    image: String(item.image || "").trim(),
  };
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  rows.push(row);
  return rows;
}

function quoteCsv(value) {
  const text = String(value || "");
  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function sanitizeFileName(value) {
  return value.replace(/[\\/:*?"<>|]+/g, "-").slice(0, 80) || "lesson";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) return;

  const action = target.dataset.action;
  if (action === "set-view") {
    window.location.href = target.dataset.view === "teacher" ? getTeacherPageUrl() : getGamePageUrl();
    return;
  }
  if (action === "go-game-url") {
    window.location.href = getGamePageUrl();
    return;
  }
  if (action === "go-teacher-url") {
    window.location.href = getTeacherPageUrl();
    return;
  }
  if (action === "show-game-hub") showGameHub();
  if (action === "select-game") selectGame(target);
  if (action === "open-game-setup") openGameSetup();
  if (action === "open-current-setup") openCurrentGameSetup();
  if (action === "start-game") {
    startGame();
  }
  if (action === "toggle-chrome") {
    state.chromeCollapsed = !state.chromeCollapsed;
    render();
  }
  if (action === "reset-game") resetGame();
  if (action === "load-demo") loadDemo();
  if (action === "start-new-course") startNewCourse();
  if (action === "duplicate-course") duplicateCurrentCourse();
  if (action === "copy-current-course-link") copyCurrentCourseLink();
  if (action === "copy-course-link") copySavedCourseLink(target);
  if (action === "verify-teacher-token") verifyTeacherWriteToken();
  if (action === "clear-teacher-token") clearTeacherTokenInput();
  if (action === "load-course") loadSavedCourse(target);
  if (action === "move-course") moveSavedCourse(target);
  if (action === "request-delete-course") requestDeleteSavedCourse(target);
  if (action === "cancel-delete-course") cancelDeleteSavedCourse();
  if (action === "confirm-delete-course") deleteSavedCourse(target);
  if (action === "roll") rollDice();
  if (action === "toggle-log") { state.game.logOpen = !state.game.logOpen; render(); }
  if (action === "close-log" && event.target.classList.contains("log-modal")) { state.game.logOpen = false; render(); }
  if (action === "mark-correct") markCorrect();
  if (action === "skip-task") skipTask();

  if (action === "flip-memory-card") flipMemoryCard(target);
  if (action === "add-team") addTeam();
  if (action === "select-team-avatar") {
    const index = Number(target.dataset.index);
    const avatar = target.dataset.avatar;
    if (state.game.teams[index] && avatar) {
      state.game.teams[index].avatar = avatar;
      saveState();
      render();
    }
  }
  if (action === "toggle-word-extra") toggleWordExtra(target);
  if (action === "delete-team") deleteTeam(target);
  if (action === "delete-word") deleteWord(target);
  if (action === "clear-words") clearWords();
  if (action === "import-csv") importCsv();
  if (action === "export-csv") exportCsv();
});

document.addEventListener("input", (event) => {
  const target = event.target;
  const action = target.dataset.action;
  if (action === "edit-lesson") updateLessonField(target);
  if (action === "edit-tags") updateTags(target);
  if (action === "teacher-token-input") updateTeacherTokenInput(target);
  if (action === "edit-memory-pairs") updateMemoryPairCount(target);
  if (action === "edit-word") updateWord(target);
  if (action === "edit-team") updateTeam(target);
});

document.addEventListener("change", (event) => {
  const target = event.target;
  if (target.dataset.action === "toggle-lesson-task") {
    toggleLessonTask(target);
  }
  if (target.dataset.action === "toggle-task") {
    toggleTask(target);
  }
  if (target.dataset.action === "toggle-image-mode") {
    state.memory.imageMode = target.checked;
    saveState();
    render();
  }
});

document.addEventListener("submit", (event) => {
  const form = event.target;
  if (form.dataset.action === "add-word-form") {
    event.preventDefault();
    addWord(form);
  }
});

document.addEventListener("keydown", (event) => {
  const target = event.target;
  if (target?.dataset?.action === "teacher-token-input" && event.key === "Enter") {
    event.preventDefault();
    verifyTeacherWriteToken();
  }
});

// 觸控裝置上，虛擬鍵盤彈出會遮住輸入欄位。用 visualViewport 事件驅動（而非固定延遲），
// 而且只在欄位「確實被鍵盤蓋住」時才捲動，避免與 iOS Safari 內建的捲動互相打架而時好時壞。
const coarsePointer = window.matchMedia("(pointer: coarse)");
const viewport = window.visualViewport;

function revealFocusedField() {
  if (!coarsePointer.matches) return;
  const el = document.activeElement;
  if (!(el instanceof HTMLElement) || !el.matches("input, textarea, select")) return;
  const rect = el.getBoundingClientRect();
  const margin = 16;
  const visibleTop = (viewport ? viewport.offsetTop : 0) + margin;
  const visibleBottom = (viewport ? viewport.offsetTop + viewport.height : window.innerHeight) - margin;
  // 欄位已完整落在鍵盤上方的可見區內就別動它，交給瀏覽器自己處理。
  if (rect.top >= visibleTop && rect.bottom <= visibleBottom) return;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
}

if (viewport) {
  // 鍵盤開合會讓 visualViewport 的高度改變並觸發 resize，此時視窗已穩定，捲動位置才會準。
  viewport.addEventListener("resize", revealFocusedField);
}
document.addEventListener("focusin", (event) => {
  const el = event.target;
  if (!(el instanceof HTMLElement) || !el.matches("input, textarea, select")) return;
  // 鍵盤已經開著時切換欄位不會觸發 resize，仍需檢查一次；延遲讓 iOS 先跑完自己的捲動。
  setTimeout(revealFocusedField, 350);
});

window.addEventListener("resize", () => {
  requestAnimationFrame(syncGameViewport);
});

render();
syncCloudCourseLibrary();
