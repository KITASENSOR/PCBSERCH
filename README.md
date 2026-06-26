# SMT PCB 查詢

此專案已改為 Cloudflare Workers + D1 架構。

正式網址：

https://smt-pcb-search.s110513202.workers.dev

D1：

- 資料庫名稱：`smt-pcb-search-db`
- Database ID：`76d8928e-b9ba-4720-9709-43590abbef7f`

## 檔案用途

- `public/index.html`：正式查詢頁，由 Worker 靜態資產服務。
- `src/index.js`：Worker API，提供 `/api/bom`、`/api/usage`、`/api/packaging`。
- `migrations/0001_create_tables.sql`：D1 資料表。
- `scripts/export_bom_to_sql.py`：將 `BOM.xlsx` 轉成 `data/bom_seed.sql`。
- `index.html`：GitHub Pages 導向頁，部署後請把 `workerUrl` 換成正式 workers.dev 網址。

## 建置流程

1. 安裝套件：`npm install`
2. 建立 D1：`npm run d1:create`
3. 將回傳的 `database_id` 填入 `wrangler.jsonc`
4. 產生資料匯入檔：`npm run data:seed`
5. 建立資料表：`npm run d1:migrate:remote`
6. 匯入資料：`npm run d1:seed:remote`
7. 部署 Worker：`npm run deploy`
8. 根目錄 `index.html` 已指向正式 workers.dev 網址，推回 GitHub Pages 後會自動導向新版查詢頁

## Excel 分表匯入

之後若只更新 Excel 其中一張工作表，可以只取代 D1 內對應資料表：

- 全部工作表：`npm run import:remote`
- BOM：`npm run import:remote -- -Sheet bom`
- 固定料：`npm run import:remote -- -Sheet fixed`
- 用量：`npm run import:remote -- -Sheet usage`
- 包裝：`npm run import:remote -- -Sheet packaging`

本機測試可改用 `npm run import:local -- -Sheet bom`。每次分表匯入只會清除並重建該工作表對應的 D1 資料，不會動到其他表。
