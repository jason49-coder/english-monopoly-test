const { test, expect } = require("@playwright/test");
const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");

const TOKEN_KEY = "english-monopoly-teacher-write-token-v2";
const LEGACY_KEY = "english-monopoly-teacher-write-token-v1";
const PASSWORD = "test-only-password";
let server;
let baseUrl;

test.beforeAll(async () => {
  const root = path.resolve(__dirname, "..");
  server = http.createServer(async (req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    const file = path.resolve(root, `.${pathname.endsWith("/") ? `${pathname}index.html` : pathname}`);
    if (!file.startsWith(`${root}${path.sep}`)) {
      res.writeHead(403).end();
      return;
    }
    try {
      const body = await fs.readFile(file);
      const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png" };
      res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test.beforeEach(async ({ context }) => {
  // Stub cloud responses so these login tests never read or mutate production data.
  await context.addInitScript(() => {
    window.supabase = {
      createClient() {
        const query = {
          select() { return query; },
          eq() { return query; },
          order() { return query; },
          then(resolve) { return Promise.resolve({ data: [], error: null }).then(resolve); },
        };
        return { from() { return query; } };
      },
    };
  });
  await context.route("https://*.supabase.co/**", async (route) => {
    const request = route.request();
    const verifying = request.url().includes("/rpc/teacher_write_allowed");
    const allowed = request.headers()["x-teacher-token"] === PASSWORD;
    await route.fulfill({ json: verifying ? allowed : [] });
  });
});

async function openLogin(page, route = "/teacher/") {
  await page.goto(`${baseUrl}${route}`);
  await page.waitForFunction(() => !cloudSave.verifying && (cloudSync.status === "ready" || cloudSave.tokenStatus === "invalid"));
}

async function login(page, remember = false, password = PASSWORD) {
  await page.getByLabel("老師密碼", { exact: true }).fill(password);
  await page.getByRole("checkbox", { name: "在這台裝置記住登入" }).setChecked(remember);
  await page.getByRole("button", { name: "進入後台", exact: true }).click();
}

async function expectNoStoredPassword(page) {
  expect(await page.evaluate((key) => [localStorage.getItem(key), sessionStorage.getItem(key)], TOKEN_KEY)).toEqual([null, null]);
}

for (const route of ["/teacher/", "/teacher.html"]) {
  test(`default login requires a password again after reload: ${route}`, async ({ page, context }) => {
    await openLogin(page, route);
    await expect(page.getByRole("checkbox")).not.toBeChecked();
    await page.getByLabel("老師密碼", { exact: true }).fill(PASSWORD);
    await expectNoStoredPassword(page);
    await login(page);
    await expect(page.getByRole("button", { name: "登出後台" })).toBeVisible();
    await expectNoStoredPassword(page);
    const nextPage = await context.newPage();
    await openLogin(nextPage, route);
    await expect(nextPage.getByLabel("老師密碼", { exact: true })).toHaveValue("");
    await page.reload();
    await expect(page.getByLabel("老師密碼", { exact: true })).toHaveValue("");
  });
}

test("opt-in persists only after verification, restores login, and logout clears it", async ({ page, context }) => {
  await openLogin(page);
  await page.getByLabel("老師密碼", { exact: true }).fill(PASSWORD);
  await page.getByRole("checkbox").check();
  await expectNoStoredPassword(page);
  await page.getByLabel("老師密碼", { exact: true }).press("Enter");
  await expect(page.getByRole("button", { name: "登出後台" })).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), TOKEN_KEY)).toBe(PASSWORD);
  await page.reload();
  await expect(page.getByRole("button", { name: "登出後台" })).toBeVisible();
  const nextPage = await context.newPage();
  await openLogin(nextPage);
  await expect(nextPage.getByRole("button", { name: "登出後台" })).toBeVisible();
  await nextPage.getByRole("button", { name: "登出後台" }).click();
  await expectNoStoredPassword(nextPage);
  await expect(nextPage.getByRole("checkbox")).not.toBeChecked();
  await nextPage.reload();
  await expect(nextPage.getByLabel("老師密碼", { exact: true })).toHaveValue("");
});

test("legacy local and session passwords are removed without automatic login", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html`);
  await page.evaluate(({ key, password }) => {
    localStorage.setItem(key, password);
    sessionStorage.setItem(key, password);
  }, { key: LEGACY_KEY, password: PASSWORD });
  let verificationRequests = 0;
  page.on("request", (request) => { if (request.url().includes("teacher_write_allowed")) verificationRequests++; });
  await openLogin(page);
  await expect(page.getByLabel("老師密碼", { exact: true })).toHaveValue("");
  await expect(page.getByRole("checkbox")).not.toBeChecked();
  expect(verificationRequests).toBe(0);
  expect(await page.evaluate((key) => [localStorage.getItem(key), sessionStorage.getItem(key)], LEGACY_KEY)).toEqual([null, null]);
});

test("wrong passwords are not persisted and a clear error is shown", async ({ page }) => {
  await openLogin(page);
  await login(page, true, "wrong-password");
  await expect(page.locator(".cloud-token-status")).toHaveText("寫入密碼錯誤，請重新輸入。");
  await expect(page.getByLabel("老師密碼", { exact: true })).toHaveValue("");
  await expectNoStoredPassword(page);
  await page.reload();
  await expect(page.getByRole("checkbox")).not.toBeChecked();
});

test("revoked remembered credentials are cleared", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html`);
  await page.evaluate((key) => localStorage.setItem(key, "old-password"), TOKEN_KEY);
  await openLogin(page);
  await expect(page.getByLabel("老師密碼", { exact: true })).toHaveValue("");
  await expectNoStoredPassword(page);
  await expect(page.locator(".cloud-token-status")).toHaveText("寫入密碼錯誤，請重新輸入。");
});

test("network failure preserves editable input and does not remember unverified credentials", async ({ page, context }) => {
  await openLogin(page);
  await context.route("**/rpc/teacher_write_allowed", (route) => route.fulfill({ status: 503, json: { message: "暫時無法驗證" } }));
  await login(page, true);
  await expect(page.locator(".cloud-token-status")).toHaveText("暫時無法驗證");
  await expect(page.getByLabel("老師密碼", { exact: true })).toHaveValue(PASSWORD);
  await expect(page.getByRole("checkbox")).toBeChecked();
  await expectNoStoredPassword(page);
  await context.unroute("**/rpc/teacher_write_allowed");
  await login(page, false);
  await expect(page.getByRole("button", { name: "登出後台" })).toBeVisible();
  await expectNoStoredPassword(page);
});

test("storage failure still permits a temporary login", async ({ page, context }) => {
  await context.addInitScript((key) => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === key) throw new DOMException("Storage unavailable", "QuotaExceededError");
      return original.call(this, name, value);
    };
  }, TOKEN_KEY);
  await openLogin(page);
  await login(page, true);
  await expect(page.getByRole("button", { name: "登出後台" })).toBeVisible();
  await expect(page.locator(".toast")).toContainText("瀏覽器無法記住登入");
  await expectNoStoredPassword(page);
  await page.reload();
  await expect(page.getByLabel("老師密碼", { exact: true })).toHaveValue("");
});

test("login fits a narrow mobile screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openLogin(page);
  await expect(page.getByRole("checkbox")).toBeVisible();
  await expect(page.getByRole("button", { name: "進入後台", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: ".tools/teacher-login-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: ".tools/teacher-login-desktop.png", fullPage: true });
});
