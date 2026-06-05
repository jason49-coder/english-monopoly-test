# 網頁大富翁

兒童美語課堂用的網頁大富翁。老師可以設定課程、單字、中文提示、分類、例句、隊伍，學生在手機、平板、桌機上用瀏覽器遊玩。

## 使用方式

本機預覽時開啟 `index.html`，或用本機伺服器開啟目前資料夾。

## 主要功能

- 老師後台設定課程名稱、參考句型、題型、隊伍與單字。
- 單字支援英文、中文提示、分類、例句。
- 已發布課程會從 Supabase 雲端讀取，並快取到 localStorage 作為離線或連線失敗時的 fallback。
- 老師後台可透過 Supabase RLS 寫入雲端，並保留本機課程草稿作為備份。
- CSV 匯入/匯出可用來備份或跨裝置移動單字表。
- 遊戲前台支援擲骰、移動動畫、題目卡、答對、再試一次、跳過。
- 棋盤在手機、平板、桌機上會自動調整。

## 部署

這是純靜態網站，目前使用 GitHub Pages 部署。

- GitHub Actions 會在 push `main` 後部署到 GitHub Pages。
- 前台網址：`https://jason49-coder.github.io/english-monopoly-test/`
- 老師後台：`https://jason49-coder.github.io/english-monopoly-test/teacher/`

注意：正式網址會優先讀取 Supabase 的 published 課程；如果 Supabase 或 CDN 暫時無法連線，前端會使用瀏覽器 localStorage 裡最近快取或老師手動儲存的課程資料。

## Supabase 寫入設定

老師後台的「儲存到 Supabase」會用 Supabase anon key 呼叫 REST API，並在 request header 帶上老師寫入密碼。資料庫 RLS 會比對 `TEACHER_WRITE_TOKEN` 的 SHA-256 hash，只有密碼正確時才允許新增、更新或刪除 `courses` / `words`。

若要更換老師寫入密碼：

1. 更新本機 `.env` 的 `TEACHER_WRITE_TOKEN`。
2. 將新 token 的 SHA-256 hash 更新到 `supabase/schema.sql` 的 `public.teacher_write_allowed()`。
3. 在 Supabase SQL Editor 重新執行 teacher write policy 區塊。
