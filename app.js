const STORAGE_KEY = "english-monopoly-mvp-v1";
const COURSE_LIBRARY_KEY = "english-monopoly-course-library-v1";

const taskLabels = {
  say: "唸單字",
  sentence: "造句",
  spell: "拼字",
  ask: "問答",
  act: "動作表演",
  choose: "選意思",
};

const askModeLabels = {
  auto: "自動依例句",
  template: "固定課程句型",
  student: "學生造問句",
};

const defaultLesson = {
  name: "Unit 1 Animals and Food",
  slug: "unit-1-animals-food",
  tags: ["animals", "food"],
  patterns: ["I see a ___ .", "I like ___ .", "This is a ___ ."],
  askMode: "auto",
  askPatterns: ["Do you like ___?", "Can you see ___?"],
  enabledTasks: ["say", "sentence", "spell", "ask", "act", "choose"],
  words: [
    { word: "cat", meaning: "貓", category: "animals", sentence: "This is a cat." },
    { word: "dog", meaning: "狗", category: "animals", sentence: "I see a dog." },
    { word: "rabbit", meaning: "兔子", category: "animals", sentence: "The rabbit can jump." },
    { word: "apple", meaning: "蘋果", category: "food", sentence: "I like apples." },
    { word: "banana", meaning: "香蕉", category: "food", sentence: "I want a banana." },
    { word: "milk", meaning: "牛奶", category: "food", sentence: "I drink milk." },
    { word: "red", meaning: "紅色", category: "colors", sentence: "It is red." },
    { word: "blue", meaning: "藍色", category: "colors", sentence: "I see blue." },
  ],
};

const teamColors = ["#e85648", "#138b84", "#3b82f6", "#7c3aed"];

const defaultTeams = [
  { id: "red", name: "紅隊", color: teamColors[0], position: 0, coins: 300, ownedTiles: [] },
  { id: "green", name: "綠隊", color: teamColors[1], position: 0, coins: 300, ownedTiles: [] },
  { id: "blue", name: "藍隊", color: teamColors[2], position: 0, coins: 300, ownedTiles: [] },
];

const legacyTeamNames = {
  "Red Team": "紅隊",
  "Green Team": "綠隊",
  "Blue Team": "藍隊",
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
  word: "唸單字",
  sentence: "造句",
  spell: "拼字",
  ask: "問答",
  action: "動作",
  choose: "選意思",
  chance: "機會卡",
};

const boardTileText = {
  start: { label: "起點", title: "出發", short: "起點", meta: "+100", tooltip: "經過起點有獎勵" },
  word: { label: "唸單字", title: "唸", short: "唸", meta: "大聲唸", tooltip: "大聲唸出英文單字" },
  sentence: { label: "造句", title: "句", short: "句", meta: "說句子", tooltip: "用英文造句" },
  spell: { label: "拼字", title: "拼", short: "拼", meta: "拼英文", tooltip: "拼出英文單字" },
  ask: { label: "問答", title: "問", short: "問", meta: "問同學", tooltip: "用英文問答" },
  action: { label: "動作", title: "演", short: "演", meta: "做動作", tooltip: "邊做動作邊說英文" },
  choose: { label: "選意思", title: "選", short: "選", meta: "選中文", tooltip: "選出英文單字的中文意思" },
  chance: { label: "機會卡", title: "幸運卡", short: "?", meta: "驚喜任務", tooltip: "抽一張驚喜任務卡" },
};

let state = loadState();
let toastTimer = null;
let celebrationTimer = null;
let memoryFeedbackTimer = null;
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
    summary: "擲骰前進，走到格子後完成唸單字、造句、拼字或機會卡任務。",
    action: "玩大富翁",
  },
  memory: {
    title: "記憶翻牌",
    badge: "英文配中文",
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

  return {
    started: Boolean(options.started),
    pairCount,
    cards: buildMemoryCards(pairCount),
    flippedIds: [],
    matchedIds: [],
    scores: Object.fromEntries(teams.map((team) => [team.id, 0])),
    currentTeamIndex: 0,
    locked: false,
    moves: 0,
    log: ["選兩張牌，把英文和中文配成一組。"],
  };
}

function resetTeams(teams) {
  return structuredClone(teams).map((team, index) => ({
    id: team.id || `team-${index + 1}`,
    name: team.name || `第 ${index + 1} 隊`,
    color: team.color || teamColors[index % teamColors.length],
    position: 0,
    coins: 300,
    ownedTiles: [],
  }));
}

function buildWordDrawPile(wordCount) {
  const safeWordCount = Math.max(0, wordCount);
  return shuffle(Array.from({ length: safeWordCount }, (_, wordIndex) => wordIndex));
}

function buildMemoryCards(pairCount) {
  const words = shuffle(getLessonWords()).slice(0, pairCount);
  const cards = words.flatMap((item, index) => {
    const pairId = `pair-${index}`;
    return [
      {
        id: `${pairId}-word`,
        pairId,
        kind: "英文",
        text: item.word,
        answer: item.meaning || item.word,
      },
      {
        id: `${pairId}-meaning`,
        pairId,
        kind: "中文",
        text: item.meaning || item.word,
        answer: item.word,
      },
    ];
  });

  return shuffle(cards);
}

function ensureMemoryShape() {
  const maxPairs = Math.min(12, getLessonWords().length);
  const pairCount = maxPairs ? clamp(Number(state.memory?.pairCount) || 6, 1, maxPairs) : 0;
  const validCards = Array.isArray(state.memory?.cards)
    && state.memory.cards.length === pairCount * 2
    && state.memory.cards.every((card) => card?.id && card?.pairId && card?.text);

  if (!state.memory || !validCards) {
    state.memory = freshMemoryState({
      teams: state.game.teams,
      pairCount,
      started: false,
    });
  }

  state.memory.pairCount = pairCount;
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

  state.game.teams.forEach((team) => {
    if (legacyTeamNames[team.name]) {
      team.name = legacyTeamNames[team.name];
    }
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
    game: state.game,
    memory: state.memory,
  }));
}

function loadCourseLibrary() {
  try {
    const stored = JSON.parse(localStorage.getItem(COURSE_LIBRARY_KEY));
    if (Array.isArray(stored)) {
      return stored
        .map(normalizeSavedCourse)
        .filter(Boolean)
        .sort((a, b) => b.updatedAt - a.updatedAt);
    }
  } catch (error) {
    console.warn("Unable to load course library", error);
  }

  return [];
}

function saveCourseLibrary(courses) {
  localStorage.setItem(COURSE_LIBRARY_KEY, JSON.stringify(courses));
}

function normalizeSavedCourse(course) {
  if (!course) return null;
  const lesson = normalizeLesson(course.lesson || course);
  if (!lesson.name && !lesson.words.length) return null;

  return {
    id: course.id || createCourseId(),
    lesson,
    createdAt: Number(course.createdAt) || Date.now(),
    updatedAt: Number(course.updatedAt) || Date.now(),
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

function normalizeAskMode(mode) {
  return askModeLabels[mode] ? mode : "auto";
}

function normalizeTextList(value, fallback = []) {
  const items = Array.isArray(value)
    ? value
    : String(value || "").split(/\r?\n/);
  const normalized = items
    .map((item) => String(item || "").trim())
    .filter(Boolean);
  return normalized.length ? normalized : fallback;
}

function normalizeLesson(lesson) {
  const patterns = normalizeTextList(lesson?.patterns, ["I see a ___ ."]);
  const askPatterns = normalizeTextList(lesson?.askPatterns, defaultLesson.askPatterns);
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
    patterns: patterns.length ? patterns : ["I see a ___ ."],
    askMode: normalizeAskMode(lesson?.askMode),
    askPatterns,
    enabledTasks: enabledTasks.length ? enabledTasks : ["say"],
    words: Array.isArray(lesson?.words)
      ? lesson.words.map(normalizeWord).filter((item) => item.word)
      : [],
  };
}

function createCourseId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `course-${Date.now()}-${Math.random().toString(16).slice(2)}`;
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
  if (path.endsWith("/teacher") || path.endsWith("/teacher.html") || params.get("admin") === "1" || params.get("view") === "teacher") {
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
  return new URL("index.html", window.location.href).href;
}

function getTeacherPageUrl() {
  return new URL("teacher.html", window.location.href).href;
}

function render() {
  ensureGameShape();
  saveState();
  const app = document.querySelector("#app");
  app.innerHTML = `
    ${renderTopbar()}
    <main class="screen ${state.view === "teacher" ? "screen-teacher" : "screen-game"}">
      ${state.view === "teacher" ? renderTeacher() : renderGame()}
    </main>
    ${animation.celebrate ? renderCelebration() : ""}
    ${state.toast ? `<div class="toast">${escapeHtml(state.toast)}</div>` : ""}
  `;
  syncGameViewport();
  requestAnimationFrame(syncGameViewport);
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

  return `
    <header class="topbar ${gameCompact ? "topbar-game-compact" : ""}">
      <div class="brand ${gameCompact ? "brand-game-compact" : ""}">
        <div class="brand-mark"><span>ABC</span></div>
        <div>
          <h1>${escapeHtml(state.lesson.name || "兒童美語大富翁")}</h1>
          <p>${state.lesson.words.length} 個單字 · ${state.game.teams.length} 隊 · 第 ${state.game.round} 回合</p>
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
      </div>
      <div class="game-choice-grid">
        ${Object.entries(gameCatalog).map(([key, game]) => `
          <article class="game-choice-card">
            <div class="game-choice-badge">${escapeHtml(game.badge)}</div>
            <h3>${escapeHtml(game.title)}</h3>
            <p>${escapeHtml(game.summary)}</p>
            <button class="primary-button" data-action="select-game" data-game="${key}" ${hasWords ? "" : "disabled"}>${hasWords ? escapeHtml(game.action) : "請先新增單字"}</button>
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
            <h2>目前隊伍</h2>
            <span class="turn-badge">
              <span class="team-dot" style="--team-color:${currentTeam.color}"></span>
              ${escapeHtml(currentTeam.name)}
            </span>
          </div>
        </section>
        ${started ? `
        <section class="action-pad desktop-action-panel">
          <button class="primary-button wide roll-button" data-action="roll" ${busy || state.game.phase === "task" ? "disabled" : ""}>${rollLabel}</button>
          <button class="success-button" data-action="mark-correct" ${busy || state.game.phase !== "task" ? "disabled" : ""}>答對</button>
          <button class="danger-button" data-action="skip-task" ${busy || state.game.phase !== "task" ? "disabled" : ""}>跳過</button>
        </section>` : ""}
        <section class="compact-grid metrics-panel">
          <div class="metric">
            <strong>${state.game.dice}</strong>
            <span>骰子</span>
          </div>
          <div class="metric">
            <strong>${totalOwnedTiles()}</strong>
            <span>已獲得地點</span>
          </div>
        </section>
        <section class="team-status-panel">
          <div class="panel-title">
            <h2>隊伍狀態</h2>
          </div>
          <div class="team-list">
            ${state.game.teams.map((team, index) => renderTeamRow(team, index)).join("")}
          </div>
        </section>
        <section class="log-panel">
          <div class="panel-title">
            <h2>課堂紀錄</h2>
          </div>
          <div class="log-list">
            ${state.game.log.slice(-7).reverse().map((item) => `<div class="log-item">${escapeHtml(item)}</div>`).join("")}
          </div>
        </section>
      </aside>
      ${started ? renderMobileDock(currentTeam, busy, rollLabel) : ""}
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
            <span class="check-label">隊伍設定</span>
            <button class="ghost-button" type="button" data-action="add-team" ${busy ? "disabled" : ""}>新增隊伍</button>
          </div>
          <div class="team-edit-list">
            ${state.game.teams.map((team, index) => `
              <div class="team-edit-row">
                <input type="color" value="${escapeAttr(team.color)}" data-action="edit-team" data-index="${index}" data-field="color" aria-label="${escapeAttr(team.name)} color" ${busy ? "disabled" : ""} />
                <input value="${escapeAttr(team.name)}" data-action="edit-team" data-index="${index}" data-field="name" aria-label="隊伍名稱 ${index + 1}" ${busy ? "disabled" : ""} />
                <button class="mini-button" type="button" data-action="delete-team" data-index="${index}" ${state.game.teams.length <= 1 || busy ? "disabled" : ""}>刪除</button>
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
              <span class="team-dot" style="--team-color:${currentTeam.color}"></span>
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
              <h2>隊伍分數</h2>
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
  const wordCount = getLessonWords().length;
  const maxPairs = Math.min(12, wordCount);
  const setupDisabled = busy || !wordCount;

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
          <p class="setup-note">${wordCount ? "每組會自動產生 1 張英文牌和 1 張中文牌。" : "請先到老師後台新增單字。"}</p>
        </div>
        <div class="setup-block">
          <div class="setup-block-head">
            <span class="check-label">隊伍設定</span>
            <button class="ghost-button" type="button" data-action="add-team" ${busy ? "disabled" : ""}>新增隊伍</button>
          </div>
          <div class="team-edit-list">
            ${state.game.teams.map((team, index) => `
              <div class="team-edit-row">
                <input type="color" value="${escapeAttr(team.color)}" data-action="edit-team" data-index="${index}" data-field="color" aria-label="${escapeAttr(team.name)} color" ${busy ? "disabled" : ""} />
                <input value="${escapeAttr(team.name)}" data-action="edit-team" data-index="${index}" data-field="name" aria-label="隊伍名稱 ${index + 1}" ${busy ? "disabled" : ""} />
                <button class="mini-button" type="button" data-action="delete-team" data-index="${index}" ${state.game.teams.length <= 1 || busy ? "disabled" : ""}>刪除</button>
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
  const classes = [
    "memory-card",
    visible ? "is-visible" : "",
    state.memory.matchedIds.includes(card.id) ? "is-matched" : "",
  ].filter(Boolean).join(" ");

  return `
    <button class="${classes}" data-action="flip-memory-card" data-card-id="${escapeAttr(card.id)}" ${state.memory.locked || state.memory.matchedIds.includes(card.id) ? "disabled" : ""}>
      <span class="memory-card-back">?</span>
      <span class="memory-card-face">
        <small>${escapeHtml(card.kind)}</small>
        <strong>${escapeHtml(card.text)}</strong>
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
      <div class="team-avatar">${escapeHtml(team.name.charAt(0))}</div>
      <div>
        <div class="team-name">${escapeHtml(team.name)}</div>
        <div class="team-stats">配對 ${state.memory.scores[team.id] || 0} 組</div>
      </div>
      <div class="score-pill">${state.memory.scores[team.id] || 0}</div>
    </div>
  `;
}

function renderMemoryFeedback() {
  const feedback = animation.memoryFeedback;
  if (state.activeGame !== "memory" || !state.memory.started) return "";
  const neutralTeam = getMemoryTeam();
  const type = feedback?.type || "neutral";
  const mark = feedback ? (feedback.type === "success" ? "+1" : "換") : "輪";
  const message = feedback?.message || `${neutralTeam.name} 翻兩張牌`;
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
        <span class="mobile-round">第 ${state.game.round} 回合</span>
      </div>
      <div class="mobile-action-grid">
        <button class="primary-button roll-button" data-action="roll" ${busy || state.game.phase === "task" ? "disabled" : ""}>${rollLabel}</button>
        <button class="success-button" data-action="mark-correct" ${busy || state.game.phase !== "task" ? "disabled" : ""}>答對</button>
        <button class="danger-button" data-action="skip-task" ${busy || state.game.phase !== "task" ? "disabled" : ""}>跳過</button>
      </div>
    </section>
  `;
}

function renderTiles() {
  return tilePath.map(([column, row], index) => {
    const tile = getTile(index);
    const owner = getTileOwner(index);
    const hasPawns = state.game.teams.some((team) => team.position === index);
    const current = state.game.currentTile === index && (state.game.phase === "task" || animation.movingTeamId);
    const classes = [
      "tile",
      `is-${tile.type}`,
      owner ? "is-owned" : "",
      hasPawns ? "has-pawns" : "",
      current ? "is-current" : "",
    ].filter(Boolean).join(" ");

    return `
      <div class="${classes}" data-tile-index="${index}" style="grid-column:${column};grid-row:${row};--owner-color:${owner ? owner.color : "transparent"}">
        <div class="tile-label">${escapeHtml(tile.label)}</div>
        <div class="tile-word tile-word-full" title="${escapeAttr(tile.tooltip)}">${renderTileBoardTitle(tile)}</div>
        <div class="tile-word-short" title="${escapeAttr(tile.tooltip)}">${renderTileShortWord(tile)}</div>
        <div class="tile-meta">${owner ? escapeHtml(owner.name) : escapeHtml(tile.meta)}</div>
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
    .map((team) => `<span class="pawn ${animation.movingTeamId === team.id ? "is-moving" : ""}" title="${escapeAttr(team.name)}" style="--team-color:${team.color}">${team.name.charAt(0)}</span>`)
    .join("");
}

function renderMissionCard() {
  const task = state.game.currentTask;
  if (!task) {
    return `
      <section class="mission-card">
        ${renderDiceFace()}
        <div class="mission-kicker">兒童美語大富翁</div>
        <h2 class="mission-title">${animation.rolling ? "骰子轉動中" : animation.movingTeamId ? "棋子前進中" : "準備好了嗎？"}</h2>
        <p class="mission-prompt">${animation.movingTeamId ? "大家一起數格子。" : "輪到的隊伍擲骰，走到格子後完成英文任務。"}</p>
        <p class="mission-support">答對可以拿獎勵，下一隊接著挑戰。</p>
      </section>
    `;
  }

  return `
    <section class="mission-card has-task">
      <div class="mission-kicker">${escapeHtml(task.kicker)}</div>
      <h2 class="mission-title">${escapeHtml(task.title)}</h2>
      <p class="mission-prompt">${escapeHtml(task.prompt)}</p>
      <p class="mission-support">${escapeHtml(task.support)}</p>
      ${renderDiceFace()}
    </section>
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
      <div class="celebration-card">
        <span class="celebration-mark">A+</span>
        <strong>${escapeHtml(animation.celebrationMessage || "答對了！")}</strong>
      </div>
    </div>
  `;
}

function renderTeamRow(team, index) {
  return `
    <div class="team-row ${index === state.game.currentTeamIndex ? "is-active" : ""}" style="--team-color:${team.color}">
      <div class="team-avatar">${escapeHtml(team.name.charAt(0))}</div>
      <div>
        <div class="team-name">${escapeHtml(team.name)}</div>
        <div class="team-stats">拿到 ${team.ownedTiles.length} 格 · 位置 ${team.position}</div>
      </div>
      <div class="score-pill">$${team.coins}</div>
    </div>
  `;
}

function renderTeacher() {
  const busy = isBusy();
  return `
    <section class="teacher-layout">
      <aside class="teacher-panel">
        <div class="panel-title">
          <div>
            <div class="section-kicker">教材準備</div>
            <h2>課程設定</h2>
          </div>
          <button class="primary-button" data-action="go-game-url" ${busy ? "disabled" : ""}>前往遊戲入口</button>
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
          <div class="field">
            <label for="lessonTags">課程標籤，用逗號分隔</label>
            <input id="lessonTags" value="${escapeAttr((state.lesson.tags || []).join(", "))}" data-action="edit-tags" placeholder="animals, food, phonics" />
          </div>
          <div class="field">
            <label for="patterns">參考句型，每行一個，用 ___ 代表單字</label>
            <textarea id="patterns" data-action="edit-patterns">${escapeHtml(state.lesson.patterns.join("\n"))}</textarea>
          </div>
          ${renderAskSettings()}
        </div>
        ${renderCourseLibrary()}
      </aside>
      <section class="teacher-panel">
        <div class="panel-title">
          <div>
            <div class="section-kicker">題庫管理</div>
            <h2>單字題庫</h2>
          </div>
          <button class="primary-button" data-action="export-csv">匯出 CSV</button>
        </div>
        <form class="word-tools" data-action="add-word-form">
          <input name="word" placeholder="word" autocomplete="off" />
          <input name="meaning" placeholder="中文提示" autocomplete="off" />
          <input name="category" placeholder="分類" autocomplete="off" />
          <input name="sentence" placeholder="例句" autocomplete="off" />
          <button class="success-button" type="submit" data-action="add-word">新增</button>
        </form>
        ${renderWordTable()}
        <div class="import-box">
          <label class="small-label" for="csvInput">貼上 CSV：word, meaning, category, sentence</label>
          <textarea id="csvInput" placeholder="cat,貓,animals,This is a cat."></textarea>
          <div class="button-row">
            <button class="ghost-button" data-action="import-csv">匯入 CSV</button>
            <button class="ghost-button" data-action="clear-words">清空單字</button>
          </div>
        </div>
      </section>
    </section>
  `;
}

function renderAskSettings() {
  const mode = normalizeAskMode(state.lesson.askMode);
  const preview = getAskPreview();

  return `
    <div class="field">
      <label for="askMode">問答任務模式</label>
      <select id="askMode" data-action="edit-ask-mode">
        ${Object.entries(askModeLabels).map(([key, label]) => `
          <option value="${key}" ${mode === key ? "selected" : ""}>${label}</option>
        `).join("")}
      </select>
    </div>
    ${mode === "template" ? `
      <div class="field">
        <label for="askPatterns">問答句型，每行一個，用 ___ 代表單字</label>
        <textarea id="askPatterns" class="compact-textarea" data-action="edit-ask-patterns">${escapeHtml(getAskPatterns().join("\n"))}</textarea>
      </div>
    ` : ""}
    ${preview ? `
      <div class="ask-preview">
        <span>問答預覽</span>
        <strong>${escapeHtml(preview.title)}</strong>
        <p>${escapeHtml(preview.prompt)}</p>
        <small>${escapeHtml(preview.basis)}</small>
      </div>
    ` : ""}
  `;
}

function getAskPreview() {
  const word = getLessonWords()[0];
  if (!word) return null;
  const askContent = buildAskContent(word, { preferFirstPattern: true });
  return {
    title: word.word,
    prompt: askContent.question,
    basis: askContent.basis,
  };
}

function renderCourseLibrary() {
  const courses = loadCourseLibrary();

  return `
    <section class="course-library">
      <div class="course-library-head">
        <div>
          <div class="section-kicker">課程庫</div>
          <h3>已儲存課程</h3>
        </div>
        <button class="success-button" type="button" data-action="save-course">儲存目前課程</button>
      </div>
      ${courses.length ? `
        <div class="course-list">
          ${courses.map((course) => renderSavedCourse(course)).join("")}
        </div>
      ` : `<div class="empty-state course-empty">還沒有儲存課程，先設定單字後按「儲存目前課程」。</div>`}
    </section>
  `;
}

function renderSavedCourse(course) {
  const lesson = course.lesson;
  return `
    <article class="course-item">
      <div class="course-info">
        <strong>${escapeHtml(lesson.name)}</strong>
        <span>${lesson.words.length} 個單字 · ${lesson.patterns.length} 參考句型 · ${formatSavedAt(course.updatedAt)}</span>
        <span>${escapeHtml(lesson.slug || "my-course")} ${lesson.tags?.length ? `· ${lesson.tags.map((tag) => `#${escapeHtml(tag)}`).join(" ")}` : ""}</span>
      </div>
      <div class="course-actions">
        <button class="ghost-button" type="button" data-action="load-course" data-course-id="${escapeAttr(course.id)}">載入</button>
        <button class="mini-button" type="button" data-action="delete-course" data-course-id="${escapeAttr(course.id)}">刪除</button>
      </div>
    </article>
  `;
}

function renderWordTable() {
  if (!state.lesson.words.length) {
    return `<div class="empty-state">目前沒有單字。先新增或匯入 CSV，再回到遊戲前台。</div>`;
  }

  return `
    <div class="word-table-wrap">
      <table class="word-table">
        <thead>
          <tr>
            <th>英文單字</th>
            <th>中文提示</th>
            <th>分類</th>
            <th>例句</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${state.lesson.words.map((item, index) => `
            <tr>
              <td><input value="${escapeAttr(item.word)}" data-action="edit-word" data-index="${index}" data-field="word" /></td>
              <td><input value="${escapeAttr(item.meaning)}" data-action="edit-word" data-index="${index}" data-field="meaning" /></td>
              <td><input value="${escapeAttr(item.category)}" data-action="edit-word" data-index="${index}" data-field="category" /></td>
              <td><input value="${escapeAttr(item.sentence)}" data-action="edit-word" data-index="${index}" data-field="sentence" /></td>
              <td><button class="mini-button" data-action="delete-word" data-index="${index}">刪除</button></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
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
  let passedStart = false;

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

  if (passedStart) {
    team.coins += 100;
    addLog(`${team.name} 經過起點，獲得 $100。`);
  }

  if (nextPosition === 0) {
    team.coins += 100;
    addLog(`${team.name} 停在起點，獲得 $100。`);
    advanceTeam();
    state.game.currentTask = null;
    state.game.phase = "ready";
    showToast("起點獎勵");
    render();
    return;
  }

  const tile = getTile(nextPosition);
  state.game.currentTask = createTask(tile, nextPosition);
  state.game.phase = "task";
  addLog(`${team.name} 擲出 ${dice}，走到 ${tile.label} 格。`);
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
  const owner = getTileOwner(tileIndex);
  const baseSupport = `${word.meaning || "沒有中文提示"} · ${word.category || "課堂單字"}`;

  if (tile.type === "chance") {
    return createChanceTask(word, owner);
  }

  if (taskType === "sentence") {
    return createSentenceTask(word, owner, "造句任務");
  }

  if (taskType === "spell") {
    return {
      type: taskType,
      kicker: "拼字任務",
      title: getSpellingTitle(word),
      prompt: getSpellingPrompt(word),
      support: getSpellingSupport(word, owner),
      answer: word.word,
    };
  }

  if (taskType === "ask") {
    return createAskTask(word, owner);
  }

  if (taskType === "act") {
    return {
      type: taskType,
      kicker: "動作表演",
      title: word.word,
      prompt: `做一個動作，並說出：${word.word}`,
      support: baseSupport,
    };
  }

  if (taskType === "choose") {
    const options = buildMeaningOptions(word);
    const answer = word.meaning || word.word;
    return {
      type: taskType,
      kicker: "選意思",
      title: word.word,
      prompt: `選出中文意思：${options.join(" / ")}`,
      support: "請學生選一個中文意思，老師再公布結果。",
      answer,
    };
  }

  return {
    type: "say",
    kicker: "唸單字",
    title: word.word,
    prompt: `大聲唸出：${word.word}`,
    support: baseSupport,
  };
}

function createAskTask(word, owner) {
  const askContent = buildAskContent(word);
  const support = [
    "同學用完整句回答，老師判斷是否通過。",
    owner ? `地點主人：${owner.name}` : "",
  ].filter(Boolean).join(" · ");

  return {
    type: "ask",
    kicker: "問答任務",
    title: "問同學",
    prompt: `問同學：${askContent.question}`,
    support,
    answerGuide: askContent.answerGuide,
  };
}

function buildAskContent(word, options = {}) {
  const askMode = normalizeAskMode(state.lesson.askMode);

  if (askMode === "student") {
    return createStudentAskContent(word);
  }

  if (askMode === "template") {
    const pattern = pickAskPattern(options);
    const templateQuestion = createQuestionFromTemplate(pattern, word);
    if (templateQuestion) {
      return {
        ...templateQuestion,
        basis: `依據：課程問答句型「${pattern}」。`,
      };
    }
  }

  const sentenceQuestion = createQuestionFromStatement(word.sentence);
  if (sentenceQuestion) {
    return {
      ...sentenceQuestion,
      basis: `依據：例句「${formatSourceSentence(word.sentence)}」。`,
    };
  }

  for (const pattern of getReferencePatterns()) {
    const patternQuestion = createQuestionFromStatement(fillAskPattern(pattern, word));
    if (patternQuestion) {
      return {
        ...patternQuestion,
        basis: `依據：老師設定的參考句型「${pattern}」。`,
      };
    }
  }

  return {
    question: `請用 "${word.word}" 問一個英文問題。`,
    basis: "依據：老師設定的單字，不自動套用固定問答。",
    answerGuide: "老師依學生回答判定。",
  };
}

function createStudentAskContent(word) {
  return {
    question: `請用 "${word.word}" 問同學一個英文問題。`,
    basis: "依據：問答模式「學生造問句」。",
    answerGuide: "老師依學生回答判定。",
  };
}

function pickAskPattern(options = {}) {
  const patterns = getAskPatterns();
  if (!patterns.length) return "";
  return options.preferFirstPattern ? patterns[0] : randomItem(patterns);
}

function createQuestionFromTemplate(pattern, word) {
  const question = ensureQuestionMark(fillAskTemplate(pattern, word));
  if (!question) return null;
  return {
    question,
    answerGuide: createAnswerGuideFromQuestion(question),
  };
}

function createQuestionFromStatement(source) {
  const sentence = normalizeQuestionSource(source);
  if (!sentence) return null;

  let match = sentence.match(/^there\s+is\s+(.+)$/i);
  if (match) {
    return {
      question: `Is there ${match[1]}?`,
      answerGuide: "Yes, there is. / No, there isn't.",
    };
  }

  match = sentence.match(/^there\s+are\s+(.+)$/i);
  if (match) {
    return {
      question: `Are there ${match[1]}?`,
      answerGuide: "Yes, there are. / No, there aren't.",
    };
  }

  match = sentence.match(/^(this|that|it)\s+is\s+(.+)$/i);
  if (match) {
    const subject = match[1].toLowerCase();
    return {
      question: `Is ${subject} ${match[2]}?`,
      answerGuide: "Yes, it is. / No, it isn't.",
    };
  }

  match = sentence.match(/^(he|she)\s+is\s+(.+)$/i);
  if (match) {
    const subject = match[1].toLowerCase();
    return {
      question: `Is ${subject} ${match[2]}?`,
      answerGuide: `Yes, ${subject} is. / No, ${subject} isn't.`,
    };
  }

  match = sentence.match(/^i\s+am\s+(.+)$/i);
  if (match) {
    return {
      question: `Are you ${match[1]}?`,
      answerGuide: "Yes, I am. / No, I'm not.",
    };
  }

  match = sentence.match(/^(you|we|they)\s+are\s+(.+)$/i);
  if (match) {
    const subject = getQuestionSubject(match[1]);
    const answerSubject = getAnswerSubject(match[1]);
    const answerGuide = answerSubject === "I"
      ? "Yes, I am. / No, I'm not."
      : `Yes, ${answerSubject} are. / No, ${answerSubject} aren't.`;
    return {
      question: `Are ${subject} ${match[2]}?`,
      answerGuide,
    };
  }

  match = sentence.match(/^(.+?)\s+can\s+(.+)$/i);
  if (match) {
    const subject = getQuestionSubject(match[1]);
    const answerSubject = getAnswerSubject(match[1]);
    return {
      question: `Can ${subject} ${match[2]}?`,
      answerGuide: `Yes, ${answerSubject} can. / No, ${answerSubject} can't.`,
    };
  }

  match = sentence.match(/^(he|she|it)\s+has\s+(.+)$/i);
  if (match) {
    const subject = match[1].toLowerCase();
    return {
      question: `Does ${subject} have ${match[2]}?`,
      answerGuide: `Yes, ${subject} does. / No, ${subject} doesn't.`,
    };
  }

  match = sentence.match(/^(he|she|it)\s+([a-z]+(?:ies|es|s))\s*(.*)$/i);
  if (match && !["is", "has", "does"].includes(match[2].toLowerCase())) {
    const subject = match[1].toLowerCase();
    const verb = toBaseVerb(match[2]);
    const object = match[3].trim();
    return {
      question: `Does ${subject} ${verb}${object ? ` ${object}` : ""}?`,
      answerGuide: `Yes, ${subject} does. / No, ${subject} doesn't.`,
    };
  }

  match = sentence.match(/^(i|you|we|they)\s+([a-z]+)\s*(.*)$/i);
  if (match) {
    const subject = getQuestionSubject(match[1]);
    const answerSubject = getAnswerSubject(match[1]);
    const verb = match[2].toLowerCase();
    const object = match[3].trim();
    return {
      question: `Do ${subject} ${verb}${object ? ` ${object}` : ""}?`,
      answerGuide: `Yes, ${answerSubject} do. / No, ${answerSubject} don't.`,
    };
  }

  return null;
}

function normalizeQuestionSource(source) {
  return String(source || "")
    .replace(/[“”"]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.!?]+$/, "");
}

function getQuestionSubject(subject) {
  const cleanSubject = normalizeQuestionSource(subject);
  if (/^i$/i.test(cleanSubject)) return "you";
  if (/^we$/i.test(cleanSubject)) return "you";
  return cleanSubject.toLowerCase();
}

function getAnswerSubject(subject) {
  const cleanSubject = normalizeQuestionSource(subject);
  if (/^i$/i.test(cleanSubject)) return "I";
  if (/^you$/i.test(cleanSubject)) return "I";
  if (/^we$/i.test(cleanSubject)) return "we";
  if (/^(he|she|we|they)$/i.test(cleanSubject)) return cleanSubject.toLowerCase();
  return "it";
}

function formatSourceSentence(source) {
  const sentence = String(source || "").trim();
  return sentence || "未填例句";
}

function ensureQuestionMark(value) {
  const question = String(value || "").trim().replace(/[.!?]+$/, "");
  return question ? `${question}?` : "";
}

function createAnswerGuideFromQuestion(question) {
  const cleanQuestion = normalizeQuestionSource(question);

  if (/^do\s+you\b/i.test(cleanQuestion)) return "Yes, I do. / No, I don't.";
  if (/^do\s+they\b/i.test(cleanQuestion)) return "Yes, they do. / No, they don't.";
  if (/^do\s+we\b/i.test(cleanQuestion)) return "Yes, we do. / No, we don't.";

  let match = cleanQuestion.match(/^does\s+(he|she|it)\b/i);
  if (match) {
    const subject = match[1].toLowerCase();
    return `Yes, ${subject} does. / No, ${subject} doesn't.`;
  }

  if (/^can\s+you\b/i.test(cleanQuestion)) return "Yes, I can. / No, I can't.";
  match = cleanQuestion.match(/^can\s+(.+?)\s+/i);
  if (match) {
    const subject = getAnswerSubject(match[1]);
    return `Yes, ${subject} can. / No, ${subject} can't.`;
  }

  if (/^is\s+(this|that)\b/i.test(cleanQuestion)) return "Yes, it is. / No, it isn't.";
  match = cleanQuestion.match(/^is\s+(he|she|it)\b/i);
  if (match) {
    const subject = match[1].toLowerCase();
    return `Yes, ${subject} is. / No, ${subject} isn't.`;
  }

  if (/^are\s+you\b/i.test(cleanQuestion)) return "Yes, I am. / No, I'm not.";
  if (/^are\s+they\b/i.test(cleanQuestion)) return "Yes, they are. / No, they aren't.";
  if (/^are\s+we\b/i.test(cleanQuestion)) return "Yes, we are. / No, we aren't.";
  if (/^(what|where|when|who|how|which|why)\b/i.test(cleanQuestion)) return "用單字或完整句回答。";

  return "老師依學生回答判定。";
}

function toBaseVerb(verb) {
  const text = String(verb || "").toLowerCase();
  if (text.endsWith("ies")) return `${text.slice(0, -3)}y`;
  if (text.endsWith("ches") || text.endsWith("shes") || text.endsWith("xes") || text.endsWith("ses") || text.endsWith("zes")) {
    return text.slice(0, -2);
  }
  if (text.endsWith("oes")) return text.slice(0, -2);
  if (text.endsWith("s")) return text.slice(0, -1);
  return text;
}

function fillAskTemplate(pattern, word) {
  const template = String(pattern || "").trim();
  if (!template) return "";
  if (!template.includes("___")) return template;
  const normalizedTemplate = isModifierWord(word)
    ? template.replace(/\b(?:a|an)\s+___/i, "___")
    : template;
  return normalizedTemplate.replaceAll("___", getWordForPattern(normalizedTemplate, word));
}

function fillAskPattern(pattern, word) {
  const template = isModifierWord(word)
    ? String(pattern || "").replace(/\b(?:a|an)\s+___/i, "___")
    : pattern;
  return fillPattern(template, getWordForPattern(template, word));
}

function getWordForPattern(pattern, word) {
  const text = String(word.word || "").trim();
  if (!text) return "";
  return /\blike\s+___/i.test(pattern) ? getLikeObjectWord(word) : text;
}

function getLikeObjectWord(word) {
  const text = String(word.word || "").trim();
  if (!text || isModifierWord(word) || isUncountableWord(text)) return text;
  return pluralizeEnglishWord(text);
}

function isModifierWord(word) {
  return /colors?|colours?|shapes?/i.test(String(word.category || ""));
}

function isUncountableWord(word) {
  return ["bread", "cheese", "chicken", "fish", "juice", "meat", "milk", "rice", "tea", "water"].includes(
    word.toLowerCase(),
  );
}

function pluralizeEnglishWord(word) {
  if (/[^aeiou]y$/i.test(word)) return `${word.slice(0, -1)}ies`;
  if (/(s|x|z|ch|sh)$/i.test(word)) return `${word}es`;
  if (/fe$/i.test(word)) return `${word.slice(0, -2)}ves`;
  if (/f$/i.test(word)) return `${word.slice(0, -1)}ves`;
  return `${word}s`;
}

function createSentenceTask(word, owner, kicker = "造句任務", bonus = 0) {
  const hasOwnSentence = Boolean(word.sentence);
  const support = getSentenceSupport(word, owner, hasOwnSentence, bonus);

  return {
    type: "sentence",
    kicker,
    title: word.word,
    prompt: hasOwnSentence ? word.sentence : `用 "${word.word}" 造一個英文句子。`,
    support,
    bonus,
  };
}

function getSentenceSupport(word, owner, hasOwnSentence, bonus = 0) {
  const hints = [];

  if (hasOwnSentence) {
    if (word.meaning || word.category) {
      hints.push([word.meaning, word.category].filter(Boolean).join(" · "));
    }
  } else {
    hints.push("沒有專屬例句，老師可選適合句型或讓學生自由造句。");
    const patterns = getReferencePatterns();
    if (patterns.length) {
      hints.push(`參考句型：${patterns.join(" / ")}`);
    }
  }

  if (bonus) hints.push(`加分 +$${bonus}`);
  if (owner) hints.push(`地點主人：${owner.name}`);
  return hints.join(" · ") || "老師帶著學生完成造句。";
}

function getReferencePatterns() {
  return state.lesson.patterns
    .map((pattern) => String(pattern || "").trim())
    .filter(Boolean)
    .slice(0, 2);
}

function getAskPatterns() {
  return normalizeTextList(state.lesson.askPatterns, defaultLesson.askPatterns);
}

function getSpellingTitle(word) {
  return word.meaning || word.category || "聽提示拼字";
}

function getSpellingPrompt(word) {
  const category = word.category ? `（${word.category}）` : "";
  return `看提示${category}，拼出英文單字。`;
}

function getSpellingSupport(word, owner) {
  const hints = [];
  if (word.category) hints.push(`分類：${word.category}`);
  if (word.sentence) hints.push("老師可以念例句，但不要顯示答案。");
  if (owner) hints.push(`地點主人：${owner.name}`);
  return hints.join(" · ") || "老師念提示，學生拼出英文。";
}

function createChanceTask(word, owner) {
  const pool = [
    createSentenceTask(word, owner, "幸運造句", 30),
    {
      type: "ask",
      kicker: "隊友挑戰",
      title: word.word,
      prompt: `問隊友：${word.word} 的中文是什麼？`,
      support: "隊友答對也多拿 $30。",
      bonus: 30,
    },
    {
      type: "spell",
      kicker: "限時拼字",
      title: getSpellingTitle(word),
      prompt: "聽老師提示，5 秒內拼出英文。",
      answer: word.word,
      support: "老師可以放寬秒數，讓低年級也能玩。",
    },
  ];
  const task = randomItem(pool);
  if (task.type === "spell") {
    task.support = getSpellingSupport(word, owner);
  } else {
    task.support = owner ? `${task.support} 地點主人：${owner.name}` : task.support;
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
    addMemoryLog(`${team.name} 配對成功：${first.kind === "英文" ? first.text : second.text}${completed ? "" : "，換下一隊。"}`);
    triggerMemoryFeedback("success", completed ? `${team.name} 完成最後一組！` : `${team.name} 配對成功，換下一隊`, team.id);
    state.memory.flippedIds = [];

    if (completed) {
      addMemoryLog("全部配對完成！");
      triggerCelebration("完成配對！");
      showToast("全部配對完成");
    } else {
      advanceMemoryTeam();
    }

    render();
    return;
  }

  state.memory.locked = true;
  const missedTeam = getMemoryTeam();
  addMemoryLog(`${missedTeam.name} 沒有配成，換下一隊。`);
  triggerMemoryFeedback("miss", `${missedTeam.name} 沒配成，換下一隊`, missedTeam.id);
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
  const tileIndex = state.game.currentTile;
  const owner = getTileOwner(tileIndex);
  const reward = 60 + (task.bonus || 0);

  team.coins += reward;

  if (owner && owner.id !== team.id) {
    const rent = Math.min(20, team.coins);
    team.coins -= rent;
    owner.coins += rent;
    addLog(`${team.name} 答對，獲得 $${reward}，並付 ${owner.name} $${rent}。`);
  } else if (!owner && state.game.currentTile !== 0) {
    team.ownedTiles.push(tileIndex);
    addLog(`${team.name} 答對，獲得 $${reward}，並拿下第 ${tileIndex} 格。`);
  } else {
    addLog(`${team.name} 答對，獲得 $${reward}。`);
  }

  triggerCelebration("答對了！");
  completeTurn("答對，加分完成。");
}

function skipTask() {
  if (state.game.phase !== "task" || isBusy()) return;
  addLog(`${getCurrentTeam().name} 跳過任務。`);
  completeTurn("已跳過，換下一隊。");
}

function completeTurn(message) {
  state.game.phase = "ready";
  state.game.currentTask = null;
  advanceTeam();
  showToast(message);
  render();
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

function getTileOwner(tileIndex) {
  return state.game.teams.find((team) => team.ownedTiles.includes(tileIndex));
}

function totalOwnedTiles() {
  return state.game.teams.reduce((total, team) => total + team.ownedTiles.length, 0);
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
  return Array.isArray(state.lesson?.words) ? state.lesson.words : [];
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

function fillPattern(pattern, word) {
  const template = pattern || "I see a ___ .";
  return template.includes("___") ? template.replaceAll("___", word) : `${template} ${word}`;
}

function buildMeaningOptions(word) {
  const meanings = state.lesson.words
    .map((item) => item.meaning)
    .filter(Boolean)
    .filter((meaning) => meaning !== word.meaning);
  const shuffled = shuffle(meanings).slice(0, 2);
  return shuffle([word.meaning || word.word, ...shuffled]);
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

function saveCurrentCourse() {
  const now = Date.now();
  const lesson = normalizeLesson(state.lesson);
  lesson.slug = createCourseSlug(lesson.slug || lesson.name);
  const courses = loadCourseLibrary();
  const lessonKey = lesson.slug;
  const existingIndex = courses.findIndex((course) => createCourseSlug(course.lesson?.slug || course.lesson?.name) === lessonKey);

  if (existingIndex >= 0) {
    courses[existingIndex] = {
      ...courses[existingIndex],
      lesson,
      updatedAt: now,
    };
  } else {
    courses.unshift({
      id: createCourseId(),
      lesson,
      createdAt: now,
      updatedAt: now,
    });
  }

  saveCourseLibrary(courses.sort((a, b) => b.updatedAt - a.updatedAt));
  showToast(`已儲存課程：${lesson.name}`);
  render();
}

function loadSavedCourse(target) {
  const course = loadCourseLibrary().find((item) => item.id === target.dataset.courseId);
  if (!course) {
    showToast("找不到這份課程");
    render();
    return;
  }

  state.lesson = structuredClone(course.lesson);
  state.game = freshGameState({
    teams: state.game.teams,
    wordCount: state.lesson.words.length,
    enabledTasks: state.game.enabledTasks || state.lesson.enabledTasks,
  });
  state.memory = freshMemoryState({ teams: state.game.teams });
  state.activeGame = "hub";
  state.view = "teacher";
  showToast(`已載入課程：${state.lesson.name}`);
  render();
}

function deleteSavedCourse(target) {
  const courseId = target.dataset.courseId;
  const courses = loadCourseLibrary();
  const course = courses.find((item) => item.id === courseId);
  saveCourseLibrary(courses.filter((item) => item.id !== courseId));
  showToast(course ? `已刪除課程：${course.lesson.name}` : "已刪除課程");
  render();
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
    pairCount: state.memory.pairCount,
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
    started: false,
  });
  state.chromeCollapsed = false;
  showToast("記憶翻牌已重開");
  render();
}

function loadDemo() {
  state.lesson = structuredClone(defaultLesson);
  state.game = freshGameState({ wordCount: defaultLesson.words.length });
  state.memory = freshMemoryState({ teams: state.game.teams });
  state.activeGame = "hub";
  state.chromeCollapsed = false;
  showToast("已載入範例課程");
  render();
}

function updateLessonField(target) {
  const field = target.dataset.field;
  if (!field) return;
  state.lesson[field] = field === "slug" ? createCourseSlug(target.value) : target.value;
  saveState();
}

function updateTags(target) {
  state.lesson.tags = target.value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  saveState();
}

function updateMemoryPairCount(target) {
  const maxPairs = Math.min(12, getLessonWords().length);
  state.memory.pairCount = maxPairs ? clamp(Number(target.value) || 1, 1, maxPairs) : 0;
  state.memory.cards = buildMemoryCards(state.memory.pairCount);
  state.memory.flippedIds = [];
  state.memory.matchedIds = [];
  state.memory.started = false;
  saveState();
}

function updatePatterns(target) {
  state.lesson.patterns = target.value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (!state.lesson.patterns.length) {
    state.lesson.patterns = ["I see a ___ ."];
  }
  saveState();
}

function updateAskMode(target) {
  state.lesson.askMode = normalizeAskMode(target.value);
  if (!getAskPatterns().length) {
    state.lesson.askPatterns = [...defaultLesson.askPatterns];
  }
  render();
}

function updateAskPatterns(target) {
  state.lesson.askPatterns = normalizeTextList(target.value, defaultLesson.askPatterns);
  saveState();
}

function toggleTask(target) {
  const task = target.dataset.task;
  if (!task) return;

  if (target.checked) {
    state.game.enabledTasks = normalizeTaskList([...state.game.enabledTasks, task], state.game.enabledTasks);
  } else {
    state.game.enabledTasks = state.game.enabledTasks.filter((item) => item !== task);
    if (!state.game.enabledTasks.length) {
      state.game.enabledTasks = ["say"];
    }
  }
  render();
}

function addWord(form) {
  const formData = new FormData(form);
  const word = normalizeWord({
    word: formData.get("word"),
    meaning: formData.get("meaning"),
    category: formData.get("category"),
    sentence: formData.get("sentence"),
  });

  if (!word.word) {
    showToast("請先輸入英文單字");
    render();
    return;
  }

  state.lesson.words.push(word);
  resetWordDrawPile();
  if (!state.memory.started) {
    state.memory = freshMemoryState({ teams: state.game.teams, pairCount: state.memory?.pairCount || 6 });
  }
  form.reset();
  showToast(`已新增 ${word.word}`);
  render();
}

function updateWord(target) {
  const index = Number(target.dataset.index);
  const field = target.dataset.field;
  if (!Number.isInteger(index) || !field || !state.lesson.words[index]) return;
  state.lesson.words[index][field] = target.value;
  saveState();
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
  const index = state.game.teams.length;
  const color = teamColors[index % teamColors.length];
  state.game.teams.push({
    id: `team-${Date.now()}`,
    name: `第 ${index + 1} 隊`,
    color,
    position: 0,
    coins: 300,
    ownedTiles: [],
  });
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

  addLog(`${removed.name} 已從遊戲移除。`);
  showToast("已刪除隊伍");
  render();
}

function deleteWord(target) {
  const index = Number(target.dataset.index);
  if (!Number.isInteger(index)) return;
  const removed = state.lesson.words.splice(index, 1)[0];
  resetWordDrawPile();
  state.game.teams.forEach((team) => {
    team.ownedTiles = team.ownedTiles.filter((tileIndex) => tileIndex < tilePath.length);
  });
  showToast(removed ? `已刪除 ${removed.word}` : "已刪除");
  render();
}

function clearWords() {
  state.lesson.words = [];
  state.game = freshGameState({
    teams: state.game.teams,
    wordCount: getLessonWords().length,
    enabledTasks: state.game.enabledTasks,
  });
  state.memory = freshMemoryState({ teams: state.game.teams });
  showToast("單字已清空");
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

  const hasHeader = normalized[0] && normalized[0].some((cell) => /word|meaning|category|sentence/i.test(cell));
  const dataRows = hasHeader ? normalized.slice(1) : normalized;
  const words = dataRows
    .map(([word, meaning, category, sentence]) => normalizeWord({ word, meaning, category, sentence }))
    .filter((item) => item.word);

  if (!words.length) {
    showToast("CSV 需要至少包含 word 欄位");
    render();
    return;
  }

  state.lesson.words = words;
  state.game = freshGameState({
    teams: state.game.teams,
    wordCount: words.length,
    enabledTasks: state.game.enabledTasks,
  });
  state.memory = freshMemoryState({ teams: state.game.teams });
  textarea.value = "";
  showToast(`已匯入 ${words.length} 個單字`);
  render();
}

function exportCsv() {
  const rows = [
    ["word", "meaning", "category", "sentence"],
    ...state.lesson.words.map((item) => [item.word, item.meaning, item.category, item.sentence]),
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
  return {
    word: String(item.word || "").trim(),
    meaning: String(item.meaning || "").trim(),
    category: String(item.category || "").trim(),
    sentence: String(item.sentence || "").trim(),
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
  if (action === "save-course") saveCurrentCourse();
  if (action === "load-course") loadSavedCourse(target);
  if (action === "delete-course") deleteSavedCourse(target);
  if (action === "roll") rollDice();
  if (action === "mark-correct") markCorrect();
  if (action === "skip-task") skipTask();
  if (action === "flip-memory-card") flipMemoryCard(target);
  if (action === "add-team") addTeam();
  if (action === "add-word") {
    event.preventDefault();
    addWord(target.closest("form"));
  }
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
  if (action === "edit-patterns") updatePatterns(target);
  if (action === "edit-ask-patterns") updateAskPatterns(target);
  if (action === "edit-memory-pairs") updateMemoryPairCount(target);
  if (action === "edit-word") updateWord(target);
  if (action === "edit-team") updateTeam(target);
});

document.addEventListener("change", (event) => {
  const target = event.target;
  if (target.dataset.action === "edit-ask-mode") {
    updateAskMode(target);
  }
  if (target.dataset.action === "toggle-task") {
    toggleTask(target);
  }
});

document.addEventListener("submit", (event) => {
  const form = event.target;
  if (form.dataset.action === "add-word-form") {
    event.preventDefault();
    addWord(form);
  }
});

window.addEventListener("resize", () => {
  requestAnimationFrame(syncGameViewport);
});

render();
