# SMT PCB 查詢

這是 Cloudflare Workers + D1 專案，用於 SMT PCB 的 BOM、用量、包裝、排程與物料需求查詢。

## 目前部署資訊

- 正式網址：https://smt-pcb-search.s110513202.workers.dev
- Worker 名稱：`smt-pcb-search`

## 檔案用途

- `public/index.html`：Cloudflare Worker Assets 前端頁面。
- `src/index.js`：Worker API 入口，透過 GitHub Actions 部署到 Cloudflare。
- `wrangler.jsonc`：Cloudflare Worker、Assets、observability 與 D1 binding 設定。
- `cloudflare-version.json`：本機記錄的 Cloudflare 部署版本資訊。
- `migrations/`：D1 資料表 migration。
- `scripts/`：Excel 與 D1 匯入/匯出輔助腳本。

GitHub Pages 已停用，根目錄也不保留網址導向頁；正式入口只使用 Cloudflare Worker Assets。

## API

- `GET /api/health`
- `GET /api/bom`
- `GET /api/usage`
- `GET /api/packaging`
- `GET /api/schedule`
- `POST /api/materials/calculate`
- `GET /api/admin/export`
- `POST /api/admin/import`

若 Cloudflare 環境變數有設定 `ADMIN_TOKEN`，管理端 API 需要帶入 token 驗證。

## 作業流程

1. 除非使用者要求從Github拉回檔案到本機，否則直接在本機修改並測試。
2. 同時將修改內容寫入 Markdown，修改內容寫入格式為在上次修改內容空一列後：## YYYYMMDD+修改內容標題-代號，空一列後寫修改內容。
3. commit 後推回 GitHub。
4. 由 GitHub Actions 使用 GitHub 上的最新內容部署到 Cloudflare。
5. 作業流程說明上方的內容不增加新的內容，只有在API或檔案用途有變動才修改。

## 20260630排程匯入與顯示規則-plus

- 排程匯入後會依 `wo_id` 去重。
- `wo_id` 重複且沒有 `start_date` 時，才加總 `plan_qty`。
- `wo_id` 重複但有 `start_date` 時，不加總 `plan_qty`，保留該工單的第一筆有日期資料。
- 排程畫面顯示順序依照 Excel 匯入後寫入資料庫的順序，不再依日期或型號重新排序。




