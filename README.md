# 網頁大富翁

兒童美語課堂用的網頁大富翁。老師可以設定課程、單字與課程任務，學生在手機、平板、桌機上用瀏覽器遊玩。

## 使用方式

本機預覽時開啟 `index.html`，或用本機伺服器開啟目前資料夾。

## 主要功能

- 老師後台設定課程名稱、網址代碼、標籤、單字與課程任務（say、spell、sentence 等）。
- 單字支援 en、zh、音標與圖片網址。
- 已發布課程從 Supabase 雲端讀取；老師端課程列表只顯示雲端課程。
- 老師後台需驗證寫入密碼，才可編輯雲端課程。
- 課程儲存使用 `save_course_with_words` RPC，課程資料與單字在同一筆資料庫交易內完成，失敗會自動回滾。
- 修改課程後會延遲批次自動同步到 Supabase，也可手動立即寫入。
- CSV 匯入／匯出可用來備份或跨裝置移動單字表。
- 遊戲前台支援擲骰、移動動畫、題目卡、答對、再試一次、跳過。
- 棋盤在手機、平板、桌機上會自動調整。

## 部署

純靜態網站，使用 GitHub Pages 部署。

- GitHub Actions 在 push `main` 後自動部署。
- 前台網址：`https://jason49-coder.github.io/english-monopoly-test/`
- 老師後台：`https://jason49-coder.github.io/english-monopoly-test/teacher/`

## Supabase 設定

老師後台用 Supabase anon key 呼叫 RPC，並在 request header 帶上老師寫入密碼。資料庫 RLS 會比對 `TEACHER_WRITE_TOKEN` 的 SHA-256 hash，密碼正確才允許寫入 `courses` / `words`。

**schema 異動後請重新執行 `supabase/schema.sql`**，前端呼叫的 RPC 必須與資料庫版本一致。

## Supabase 維護

`.github/workflows/supabase-maintenance.yml` 每天會做兩件事：

1. 寫入 `maintenance_heartbeat`，讓資料庫產生定期活動。
2. 呼叫 `export_course_backup` RPC，匯出 `courses` / `words` JSON artifact，保留 30 天。

GitHub repository 需要設定這個 Actions secret：

- `TEACHER_WRITE_TOKEN`

`SUPABASE_URL` 和 `SUPABASE_ANON_KEY` 會使用前端公開設定作為 fallback；如果之後換 Supabase 專案，也可以在 GitHub Actions secrets 裡新增同名值覆蓋。

這個 workflow 可以降低 Free plan 專案被視為長期閒置的風險，也能保留課程備份；若要官方保證專案不被 paused，仍需使用 Supabase Pro organization。

若要更換老師寫入密碼：

1. 更新本機 `.env` 的 `TEACHER_WRITE_TOKEN`。
2. 將新 token 的 SHA-256 hash 更新到 `supabase/schema.sql` 的 `public.teacher_write_allowed()`。
3. 在 Supabase SQL Editor 重新執行 teacher write policy 區塊。
