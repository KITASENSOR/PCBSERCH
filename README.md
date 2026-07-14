# SMT PCB 查詢

這是 Cloudflare Workers + D1 專案，用於 SMT PCB 的 BOM、用量、包裝、排程與物料需求查詢。

## 目前部署資訊

- 正式網址：https://smt-pcb-search.s110513202.workers.dev
- Worker 名稱：`smt-pcb-search`

## 檔案用途

- `public/index.html`：Cloudflare Worker Assets 前端頁面。
- `public/data/`：由 `文件/BOM.xlsx` 產生的舊版靜態 JSON，僅保留作為資料比對參考，不是正式畫面的資料來源。
- `src/index.js`：Worker API 入口，透過 GitHub Actions 部署到 Cloudflare。
- `wrangler.jsonc`：Cloudflare Worker、Assets、observability 與 D1 binding 設定。
- `cloudflare-version.json`：本機記錄的 Cloudflare 部署版本資訊。
- `migrations/`：D1 資料表 migration。
- `scripts/`：Excel 與 D1 匯入/匯出輔助腳本。
- `文件/BOM.xlsx`：BOM、固定料、用量、包裝四張基礎資料來源，不由手機直接讀取。

GitHub Pages 已停用，根目錄也不保留網址導向頁；正式入口只使用 Cloudflare Worker Assets。

## API

- `GET /api/health`
- `GET /api/bom`
- `GET /api/usage`
- `GET /api/packaging`
- `GET /api/schedule`
- `POST /api/schedule/delete`
- `POST /api/materials/calculate`
- `GET /api/admin/export`
- `POST /api/admin/import`

若 Cloudflare 環境變數有設定 `ADMIN_TOKEN`，管理端 API 需要帶入 token 驗證。

`查BOM` 與 `下料` 透過 `/api/bom` 讀取 D1 的 BOM、固定料；`取料` 透過 `/api/materials/calculate` 使用 D1 的用量與包裝資料計算。Excel 上傳至 `/api/admin/import` 完成後，前端會重新讀取相關 D1 API。

## 作業流程

1. 除非使用者要求從Github拉回檔案到本機，否則直接在本機修改並測試，Github拉回檔案後直接覆蓋本機檔案。
2. 同時將修改內容寫入 Markdown，修改內容寫入格式為在上次修改內容空一列後：YYYY-MM-DD+修改內容標題-代號，空一列後寫修改內容。
3. commit 後推回 GitHub。
4. D1 schema 變更使用本機 Wrangler OAuth 套用；多 Cloudflare 帳號時需指定正確 `CLOUDFLARE_ACCOUNT_ID`，不走 GitHub Actions。
5. GitHub Actions 只負責 Cloudflare Worker/Assets 部署，不負責 D1 migration。
6. 作業流程說明上方的內容不增加新的內容，只有在API或檔案用途有變動才修改。

## 修改紀錄
2026-06-30排程匯入與顯示規則-plus

    - 排程匯入後會依 `wo_id` 去重。
    - `wo_id` 重複且沒有 `start_date` 時，才加總 `plan_qty`。
    - `wo_id` 重複但有 `start_date` 時，不加總 `plan_qty`，保留該工單的第一筆有日期資料。
    - 排程畫面顯示順序依照 Excel 匯入後寫入資料庫的順序，不再依日期或型號重新排序。


2026-07-01排程列表長按刪除修正-Business

    - 新增 `/api/schedule/delete`，可依工單號碼刪除排程資料。
    - 刪除排程時會嘗試移除包含該工單組合的取料備註；若備註資料表不存在，不影響排程刪除。
    - 排程列表長按進入刪除模式的時間調整為 0.8 秒。


2026-07-03回報入口嵌入-Plus

    - 固定入口改為同列顯示 `查BOM`、`下料`、`取料`、`回報`，進入頁面後不再隱藏目前頁面的入口。
    - `BOM 查詢` 標籤改為 `查BOM`，`下料系統` 標籤改為 `下料` 並移除圖案，`取料計算` 標籤改為 `取料`。
    - 新增 `回報` 頁，以 iframe 嵌入 `https://wip-progress-page.kitasensorpd.workers.dev`，不合併 D1 與 API 部署。


2026-07-04基礎資料改靜態讀取-Plus

    - 新增 `scripts/export_static_data.py`，可從 `文件/BOM.xlsx` 產生 `public/data/` 靜態 JSON。
    - `查BOM` 與 `下料` 改讀 `public/data/bom.json`，不再透過 `/api/bom` 讀取 D1。
    - `取料` 改在前端依選取工單讀取 `public/data/usage/*.json` 與 `public/data/packaging.json` 計算，不再透過 `/api/materials/calculate` 讀取 D1。
    - D1 保留給排程、排程刪除與取料備註等動態資料。


2026-07-04排程Excel巨集連接API規劃-Plus

    - 排程自動匯入來源確認為 `打件明細/SMT_WO_DATA.xlsx`，不是其他排程整理檔。
    - 不修改現有排程匯入規則、欄位對應、去重或合併邏輯。
    - 實作方向改為在 Excel 端加入巨集，於 `SMT_WO_DATA.xlsx` 存檔時呼叫既有 `/api/admin/import`。
    - API 端維持使用現有 `schedule_items` 匯入入口，避免改動取料計算與排程顯示邏輯。


2026-07-04新增排程自動匯入方式規劃-Fable

    - 不變動本專案現有的排程匯入方式與規則，上一條「Excel 巨集連接 API」規劃維持原狀。
    - 新增一條自動匯入管道：`8 排程匯入工作整合` 規劃中的 `API_Server_V03` 常駐程式，在 `SMT_WO_DATA.xlsx` 資料實際變更時直接 `POST /api/admin/import` 推送 `schedule_items`（上半部＋下半部排程，下半部只有工單、生產機種、數量三欄，`side`、日期與 `panel_size` 留空）。
    - 自動匯入邏輯與手動匯入相同：同一個 `/api/admin/import` 入口、同一套欄位對應與 `schedule_items` 正規化規則，只有觸發方式自動化。
    - 本專案 API 端不需改動。


2026-07-04自動匯入實測與排程完工分頁-Fable

    - 依使用者定案，Worker 維持不設 `ADMIN_TOKEN`（匯入口全放行），專案 8 的 `API_Server_V03` 以空 token 直推。
    - 實測自動推送成功（36 筆送出、正規化後存入 26 筆），驗證後已依使用者要求還原為推送前的 31 筆排程資料。
    - 陷阱：Cloudflare 以 `403 error 1010` 阻擋 `Python-urllib` 預設 User-Agent，程式端呼叫本站 API 必須自訂 `user-agent`。
    - 排程列表切換選單新增「完工」分頁：完工＝`end_date` 早於今天（當天完工日仍視為進行中）；此判斷後續已確認不是使用者要的刪除工單清單來源。
    - 完工分頁為項目層級過濾（同日期群組內只顯示已完工項目），分頁標籤同步顯示各分類筆數。
    - 已知行為（當時既有匯入行為，非本次新增）：匯入為整表重建，排程頁手動長按刪除的工單在下次推送會重新出現；此行為後續已改為完工表比對。
    - 詳細轉換與去重規則見 `8 排程匯入工作整合\README.md`。


2026-07-04排程篩選按鈕與刪除表確認-Plus

    - 排程列表篩選按鈕文案由「已排程／未排程」縮短為「已排／未排」。
    - 排程列表四個篩選按鈕改為固定同一列等寬顯示。
    - 不新增 D1 表；已回退錯誤新增的 `schedule_completed_items`。
    - 目前已找到既有刪除工單表來源：`打件明細/排程在製工單介面V1.html` 使用瀏覽器 `localStorage` 的 `scheduleDeletedWorkOrdersV1` 保存刪除工單，匯入時會略過該清單。
    - 目前已部署 Worker 的 `/api/schedule/delete` 仍是刪除 `schedule_items` 內的排程，並嘗試清理 `picking_notes` / `picking_note_items` 的取料備註；未使用新的完工 D1 表。


2026-07-04取料排程長按完工與匯入比對-Plus

    - 取料排程列表長按操作由「刪除」改為「完工」，前端改呼叫 `/api/schedule/complete`。
    - 新增 D1 表 `schedule_completed_work_orders` 保存完工工單，完工分頁改顯示此表資料。
    - 完工後工單會從 `schedule_items` 移到 `schedule_completed_work_orders`，不再只從 active 排程刪除。
    - `/api/admin/import` 匯入 `schedule_items` 時會比對完工表：來源仍存在且已完工的工單不匯入 active 排程；來源已不存在但完工表仍有的工單會從完工表移除。
    - 補上正式 Worker 的 `/api/picking/notes` GET/POST，取料備註可在 D1 `picking_notes` 正常讀寫與清空刪除。
    - 新增 migration 補齊排程、取料備註與完工表，讓新環境套 migrations 後可支援目前動態資料表。


2026-07-14 Excel覆蓋D1與固定料顯示修正-V1

    - `查BOM`、`下料` 改回讀取 `/api/bom`，固定料與 BOM 以 D1 為正式顯示來源。
    - `取料` 改回呼叫 `/api/materials/calculate`，用量與包裝以 D1 為計算來源。
    - Excel 上傳完成後等待相關 D1 API 重新載入，再顯示上傳成功，避免畫面沿用舊資料。
    - 各資料表先寫入獨立暫存區並核對筆數，確認無誤後再透過 D1 批次交易交換正式資料；暫存失敗時不會先清空正式資料。
    - 新增 `migrations/0003_import_staging_V1.sql`；部署新版 Worker 前必須先套用此 migration。
