# 網頁大富翁

兒童美語課堂用的網頁大富翁。老師可以設定課程、單字、中文提示、分類、例句、隊伍，學生在手機、平板、桌機上用瀏覽器遊玩。

## 使用方式

本機預覽時開啟 `index.html`，或用本機伺服器開啟目前資料夾。

## 主要功能

- 老師後台設定課程名稱、參考句型、題型、隊伍與單字。
- 單字支援英文、中文提示、分類、例句。
- 已發布課程會從 Supabase 雲端讀取，並快取到 localStorage 作為離線或連線失敗時的 fallback。
- 老師後台可透過 Netlify Function 寫入 Supabase，並保留本機課程草稿作為備份。
- CSV 匯入/匯出可用來備份或跨裝置移動單字表。
- 遊戲前台支援擲骰、移動動畫、題目卡、答對、再試一次、跳過。
- 棋盤在手機、平板、桌機上會自動調整。

## 部署

這是純靜態網站，可以部署到 GitHub Pages、Netlify、Vercel 或 Cloudflare Pages。

- Netlify：可直接拖曳 `english-monopoly-deploy.zip` 或整個資料夾部署。
- Vercel：匯入專案即可，`vercel.json` 已包含靜態設定。
- GitHub Pages：上傳檔案到 repository 後啟用 Pages；`.nojekyll` 已加入。

注意：正式網址會優先讀取 Supabase 的 published 課程；如果 Supabase 或 CDN 暫時無法連線，前端會使用瀏覽器 localStorage 裡最近快取或老師手動儲存的課程資料。

## Supabase 寫入設定

老師後台的「儲存到 Supabase」會呼叫 `/api/courses`。Netlify production site 需要設定這些環境變數：

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_REF`
- `TEACHER_WRITE_TOKEN`

`TEACHER_WRITE_TOKEN` 是老師端寫入密碼。瀏覽器不會持有 Supabase 管理權限 token；高權限寫入只在 Netlify Function 內執行。
