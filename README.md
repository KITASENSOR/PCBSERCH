# SMT PCB 查詢

這是 Cloudflare Workers + D1 專案，用於 SMT PCB 的 BOM、用量、包裝、排程與物料需求查詢。

## 目前部署資訊

- 正式網址：https://smt-pcb-search.s110513202.workers.dev
- Worker 名稱：`smt-pcb-search`
- Cloudflare Account ID：`d015cadd5a857ea10b617679c148d37c`
- 目前部署 ID：`15cd3d75-1154-4f8d-99b3-ea7c34ef476b`
- 目前版本 ID：`de3cee5b-e8cb-486c-8d74-a0f5e34cb34b`
- 版本號：`24`
- 版本建立時間：`2026-06-30T05:13:19.968357Z`
- 部署建立時間：`2026-06-30T05:13:22.737031Z`
- Script ETag：`c75edade677cc9b56654ea1f6806c61264cb4a1489ff1affc7b6570018cf1c9c`

## D1 資料庫

- 資料庫名稱：`smt-pcb-search-db`
- Database ID：`76d8928e-b9ba-4720-9709-43590abbef7f`
- Binding：`DB`

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

## 排程匯入與顯示規則

- 排程匯入後會依 `wo_id` 去重。
- `wo_id` 重複且沒有 `start_date` 時，才加總 `plan_qty`。
- `wo_id` 重複但有 `start_date` 時，不加總 `plan_qty`，保留該工單的第一筆有日期資料。
- 排程畫面顯示順序依照 Excel 匯入後寫入資料庫的順序，不再依日期或型號重新排序。

## 之後作業流程

本次已完成 Cloudflare 最新部署同步到 GitHub。之後修改請依照以下順序：

1. 先從 GitHub `main` 拉回最新檔案。
2. 在本機修改並測試。
3. commit 後推回 GitHub。
4. 用 GitHub 已同步的專案部署到 Cloudflare。
5. 若 Cloudflare 部署版本有變更，同步更新 `cloudflare-version.json` 與本 README。

## 分支規定

GitHub 專案只保留 `main` 分支。
