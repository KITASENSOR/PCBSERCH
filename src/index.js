const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) return handleApi(request, env, url);
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response("Not found", { status: 404 });
  }
};

async function handleApi(request, env, url) {
  if (!env.DB) return json({ error: "D1 資料庫未設定" }, 500);
  try {
    if (request.method === "GET" && url.pathname === "/api/health") return json({ ok: true });
    if (request.method === "GET" && url.pathname === "/api/bom") return json(await getBomPayload(env.DB));
    if (request.method === "GET" && url.pathname === "/api/usage") return json(await queryUsage(env.DB, url.searchParams));
    if (request.method === "GET" && url.pathname === "/api/packaging") return json(await queryPackaging(env.DB, url.searchParams));
    if (request.method === "GET" && url.pathname === "/api/schedule") return json(await getSchedulePayload(env.DB));
    if (request.method === "POST" && url.pathname === "/api/schedule/delete") {
      return json(await deleteScheduleItems(env.DB, await request.json()));
    }
    if (request.method === "GET" && url.pathname === "/api/admin/export") {
      const auth = checkAdminAuth(request, env, url);
      return auth || json(await exportDatabase(env.DB));
    }
    if (request.method === "POST" && url.pathname === "/api/admin/import") {
      const auth = checkAdminAuth(request, env, url);
      return auth || json(await importDatabase(env.DB, await request.json()));
    }
    if (request.method === "POST" && url.pathname === "/api/materials/calculate") {
      return json(await calculateMaterials(env.DB, await request.json()));
    }
    if (url.pathname.startsWith("/api/")) {
      return json({ error: "不支援的 API 方法" }, 405, { allow: "GET, POST" });
    }
    return json({ error: "找不到 API" }, 404);
  } catch (error) {
    console.error(JSON.stringify({
      event: "api_error",
      path: url.pathname,
      message: error instanceof Error ? error.message : String(error)
    }));
    return json({ error: "伺服器錯誤" }, 500);
  }
}

async function getBomPayload(db) {
  const [bomResult, fixedResult] = await Promise.all([
    db.prepare("SELECT parent_number, child_parts FROM bom ORDER BY parent_number").all(),
    db.prepare("SELECT part_number FROM fixed_parts ORDER BY part_number").all()
  ]);
  return {
    updated_at: new Date().toISOString(),
    counts: {
      bom: (bomResult.results || []).length,
      fixed: (fixedResult.results || []).length
    },
    bom: (bomResult.results || []).map(row => ({
      parent_number: row.parent_number,
      child_parts: row.child_parts
    })),
    fixed: (fixedResult.results || []).map(row => row.part_number)
  };
}

async function getSchedulePayload(db) {
  await ensureScheduleCompletedTable(db);
  const [activeResult, completedResult] = await Promise.all([
    db.prepare("SELECT wo_id, part_no, side, plan_qty, real_qty, start_date, end_date, panel_size FROM schedule_items ORDER BY rowid").all(),
    db.prepare("SELECT wo_id, part_no, side, plan_qty, real_qty, start_date, end_date, panel_size FROM schedule_completed_items ORDER BY completed_at DESC, wo_id").all()
  ]);
  const activeRows = activeResult.results || [];
  const completedRows = completedResult.results || [];
  return {
    updated_at: new Date().toISOString(),
    count: activeRows.length,
    completed_count: completedRows.length,
    groups: groupScheduleRows(activeRows),
    completed_groups: groupScheduleRows(completedRows)
  };
}

function groupScheduleRows(rows) {
  const groups = [];
  const byDate = new Map();
  rows.forEach(row => {
    const date = normalizeDate(row.start_date) || "未排日期";
    if (!byDate.has(date)) {
      const group = { date, items: [], total_quantity: 0 };
      byDate.set(date, group);
      groups.push(group);
    }
    const item = {
      wo_id: row.wo_id,
      part_no: row.part_no,
      side: row.side || "",
      plan_qty: toNumber(row.plan_qty),
      real_qty: toNumber(row.real_qty),
      start_date: row.start_date || "",
      end_date: row.end_date || "",
      panel_size: row.panel_size || ""
    };
    byDate.get(date).items.push(item);
    byDate.get(date).total_quantity += item.plan_qty;
  });
  return groups;
}

async function deleteScheduleItems(db, payload) {
  await ensureScheduleCompletedTable(db);
  const woIds = uniqueRows((Array.isArray(payload?.wo_ids) ? payload.wo_ids : []).map(cleanText));
  if (woIds.length === 0) return { error: "請提供要刪除的工單" };

  let deletedSchedule = 0;
  for (let index = 0; index < woIds.length; index += 80) {
    const chunk = woIds.slice(index, index + 80);
    const placeholders = chunk.map(() => "?").join(", ");
    const countResult = await db.prepare(`SELECT COUNT(*) AS count FROM schedule_items WHERE wo_id IN (${placeholders})`).bind(...chunk).all();
    deletedSchedule += toNumber(countResult.results?.[0]?.count);
    await db.prepare(`
      INSERT INTO schedule_completed_items (
        wo_id, part_no, side, plan_qty, real_qty, start_date, end_date, panel_size, completed_at
      )
      SELECT wo_id, part_no, side, plan_qty, real_qty, start_date, end_date, panel_size, CURRENT_TIMESTAMP
      FROM schedule_items
      WHERE wo_id IN (${placeholders})
      ON CONFLICT(wo_id) DO UPDATE SET
        part_no = excluded.part_no,
        side = excluded.side,
        plan_qty = excluded.plan_qty,
        real_qty = excluded.real_qty,
        start_date = excluded.start_date,
        end_date = excluded.end_date,
        panel_size = excluded.panel_size,
        completed_at = CURRENT_TIMESTAMP
    `).bind(...chunk).run();
    await db.prepare(`DELETE FROM schedule_items WHERE wo_id IN (${placeholders})`).bind(...chunk).run();
  }
  const deletedNoteCombos = await deletePickingNoteCombos(db, woIds);
  return { deleted_schedule: deletedSchedule, completed_schedule: deletedSchedule, deleted_note_combos: deletedNoteCombos };
}

async function deletePickingNoteCombos(db, woIds) {
  let deleted = 0;
  try {
    const targetIds = new Set(woIds.map(cleanText).filter(Boolean));
    const tables = await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('picking_notes', 'picking_note_items')").all();
    for (const tableRow of tables.results || []) {
      const tableName = cleanText(tableRow.name);
      if (!tableName) continue;
      const info = await db.prepare(`PRAGMA table_info(${tableName})`).all();
      const columns = new Set((info.results || []).map(row => cleanText(row.name)));
      const keyColumn = columns.has("combo_key")
        ? "combo_key"
        : columns.has("key")
          ? "key"
          : columns.has("picking_key")
            ? "picking_key"
            : "";
      if (!keyColumn) continue;
      const combos = await db.prepare(`SELECT DISTINCT ${keyColumn} AS combo_key FROM ${tableName}`).all();
      const matched = (combos.results || [])
        .map(row => cleanText(row.combo_key))
        .filter(key => key && key.split("|").map(cleanText).some(id => targetIds.has(id)));
      if (matched.length === 0) continue;
      deleted += matched.length;
      for (let index = 0; index < matched.length; index += 80) {
        const chunk = matched.slice(index, index + 80);
        const placeholders = chunk.map(() => "?").join(", ");
        await db.prepare(`DELETE FROM ${tableName} WHERE ${keyColumn} IN (${placeholders})`).bind(...chunk).run();
      }
    }
  } catch (error) {
    console.warn(JSON.stringify({
      event: "picking_note_delete_skipped",
      message: error instanceof Error ? error.message : String(error)
    }));
  }
  return deleted;
}

async function exportDatabase(db) {
  await ensureScheduleCompletedTable(db);
  const [bom, fixed, usage, packaging, schedule, completed] = await Promise.all([
    db.prepare("SELECT parent_number, child_parts FROM bom ORDER BY parent_number").all(),
    db.prepare("SELECT part_number FROM fixed_parts ORDER BY part_number").all(),
    db.prepare("SELECT parent_number, child_part_number, batch_quantity, item_name FROM usage_items ORDER BY parent_number, child_part_number").all(),
    db.prepare("SELECT product_number, specification, package_1 FROM packaging ORDER BY product_number").all(),
    db.prepare("SELECT wo_id, part_no, side, plan_qty, real_qty, start_date, end_date, panel_size FROM schedule_items ORDER BY rowid").all(),
    db.prepare("SELECT wo_id, part_no, side, plan_qty, real_qty, start_date, end_date, panel_size, completed_at FROM schedule_completed_items ORDER BY completed_at DESC, wo_id").all()
  ]);
  const tables = {
    bom: bom.results || [],
    fixed_parts: fixed.results || [],
    usage_items: usage.results || [],
    packaging: packaging.results || [],
    schedule_items: schedule.results || [],
    schedule_completed_items: completed.results || []
  };
  return {
    exported_at: new Date().toISOString(),
    counts: Object.fromEntries(Object.entries(tables).map(([name, rows]) => [name, rows.length])),
    tables
  };
}

async function importDatabase(db, payload) {
  await ensureScheduleCompletedTable(db);
  const tables = payload?.tables || {};
  const counts = {};
  if (Array.isArray(tables.packaging)) {
    const rows = normalizePackagingRows(tables.packaging);
    await replaceTable(db, "packaging", ["product_number", "specification", "package_1"], rows);
    counts.packaging = rows.length;
  }
  if (Array.isArray(tables.usage_items)) {
    const rows = normalizeUsageRows(tables.usage_items);
    await replaceTable(db, "usage_items", ["parent_number", "child_part_number", "batch_quantity", "item_name"], rows, { resetSequence: true });
    counts.usage_items = rows.length;
  }
  if (Array.isArray(tables.fixed_parts)) {
    const rows = normalizeFixedRows(tables.fixed_parts);
    await replaceTable(db, "fixed_parts", ["part_number"], rows);
    counts.fixed_parts = rows.length;
  }
  if (Array.isArray(tables.bom)) {
    const rows = normalizeBomRows(tables.bom);
    await replaceTable(db, "bom", ["parent_number", "child_parts"], rows);
    counts.bom = rows.length;
  }
  if (Array.isArray(tables.schedule_items)) {
    const rows = await excludeCompletedScheduleRows(db, normalizeScheduleRows(tables.schedule_items));
    await replaceTable(db, "schedule_items", ["wo_id", "part_no", "side", "plan_qty", "real_qty", "start_date", "end_date", "panel_size"], rows);
    counts.schedule_items = rows.length;
  }
  if (Object.keys(counts).length === 0) return { error: "沒有可匯入的資料" };
  return { imported_at: new Date().toISOString(), counts };
}

async function excludeCompletedScheduleRows(db, rows) {
  if (rows.length === 0) return rows;
  const ids = rows.map(row => row.wo_id).filter(Boolean);
  const completed = new Set();
  for (let index = 0; index < ids.length; index += 80) {
    const chunk = ids.slice(index, index + 80);
    const placeholders = chunk.map(() => "?").join(", ");
    const result = await db.prepare(`SELECT wo_id FROM schedule_completed_items WHERE wo_id IN (${placeholders})`).bind(...chunk).all();
    (result.results || []).forEach(row => completed.add(cleanText(row.wo_id)));
  }
  return rows.filter(row => !completed.has(cleanText(row.wo_id)));
}

const D1_MAX_VARIABLES = 100;
const D1_BATCH_SIZE = 50;

async function replaceTable(db, tableName, columns, rows, options = {}) {
  const clearStatements = [db.prepare(`DELETE FROM ${tableName}`)];
  if (options.resetSequence) clearStatements.push(db.prepare("DELETE FROM sqlite_sequence WHERE name = ?").bind(tableName));
  await db.batch(clearStatements);
  if (rows.length === 0) return;

  const rowsPerInsert = Math.max(1, Math.floor((D1_MAX_VARIABLES - 1) / columns.length));
  const statements = [];
  for (let index = 0; index < rows.length; index += rowsPerInsert) {
    const chunk = rows.slice(index, index + rowsPerInsert);
    const valuesSql = chunk.map(() => `(${columns.map(() => "?").join(", ")})`).join(", ");
    const sql = `INSERT INTO ${tableName} (${columns.join(", ")}) VALUES ${valuesSql}`;
    const values = chunk.flatMap(row => columns.map(column => row[column] ?? ""));
    statements.push(db.prepare(sql).bind(...values));
  }
  for (let index = 0; index < statements.length; index += D1_BATCH_SIZE) {
    await db.batch(statements.slice(index, index + D1_BATCH_SIZE));
  }
}

async function calculateMaterials(db, payload) {
  const models = normalizeSelectedModels(payload?.models || []);
  if (models.length === 0) return { count: 0, items: [] };

  const modelQty = new Map();
  models.forEach(model => {
    modelQty.set(model.part_no, (modelQty.get(model.part_no) || 0) + model.plan_qty);
  });

  const usageRows = await queryByIn(
    db,
    "SELECT parent_number, child_part_number, batch_quantity, item_name FROM usage_items WHERE parent_number IN (__IN__) ORDER BY child_part_number",
    [...modelQty.keys()]
  );
  const required = new Map();
  for (const row of usageRows) {
    const planQty = modelQty.get(row.parent_number) || 0;
    const batchQty = toNumber(row.batch_quantity);
    const requiredQty = planQty * batchQty;
    if (!row.child_part_number || requiredQty === 0) continue;
    const part = row.child_part_number;
    const target = required.get(part) || { child_part_number: part, required_quantity: 0, item_name: "", parents: [] };
    if (!target.item_name && row.item_name) target.item_name = String(row.item_name).trim();
    target.required_quantity += requiredQty;
    target.parents.push({
      parent_number: row.parent_number,
      plan_qty: planQty,
      batch_quantity: batchQty,
      required_quantity: requiredQty
    });
    required.set(part, target);
  }

  const packagingRows = await queryByIn(db, "SELECT product_number, package_1 FROM packaging WHERE product_number IN (__IN__)", [...required.keys()]);
  const packagingByPart = new Map(packagingRows.map(row => [row.product_number, row]));
  const items = [...required.values()].map(item => {
    const packaging = packagingByPart.get(item.child_part_number) || {};
    const packageQty = toNumber(packaging.package_1);
    const packageCount = packageQty > 0 ? item.required_quantity / packageQty : null;
    return {
      child_part_number: item.child_part_number,
      item_name: item.item_name || "",
      required_quantity: roundNumber(item.required_quantity, 4),
      package_quantity: packageQty || null,
      package_count: packageCount === null ? null : roundNumber(packageCount, 1),
      parents: item.parents
    };
  }).sort((a, b) => a.child_part_number.localeCompare(b.child_part_number, undefined, { numeric: true }));

  return {
    selected_count: models.length,
    model_count: modelQty.size,
    count: items.length,
    items
  };
}

async function queryByIn(db, sqlTemplate, values, chunkSize = 80) {
  const rows = [];
  for (let index = 0; index < values.length; index += chunkSize) {
    const chunk = values.slice(index, index + chunkSize);
    if (chunk.length === 0) continue;
    const placeholders = chunk.map(() => "?").join(", ");
    const result = await db.prepare(sqlTemplate.replace("__IN__", placeholders)).bind(...chunk).all();
    rows.push(...(result.results || []));
  }
  return rows;
}

async function queryUsage(db, params) {
  const parent = cleanParam(params.get("parent"));
  const part = cleanParam(params.get("part"));
  const query = cleanParam(params.get("q"));
  const limit = getLimit(params.get("limit"));
  let sql = "SELECT parent_number, child_part_number, batch_quantity, item_name FROM usage_items";
  const where = [];
  const values = [];
  if (parent) {
    where.push("parent_number = ?");
    values.push(parent);
  }
  if (part) {
    where.push("child_part_number = ?");
    values.push(part);
  }
  if (query) {
    where.push("(parent_number LIKE ? OR child_part_number LIKE ? OR item_name LIKE ?)");
    const like = `%${query}%`;
    values.push(like, like, like);
  }
  if (where.length > 0) sql += ` WHERE ${where.join(" AND ")}`;
  sql += " ORDER BY parent_number, child_part_number LIMIT ?";
  values.push(limit);
  const result = await db.prepare(sql).bind(...values).all();
  return { count: result.results?.length || 0, usage: result.results || [] };
}

async function queryPackaging(db, params) {
  const query = cleanParam(params.get("q"));
  const limit = getLimit(params.get("limit"));
  let sql = "SELECT product_number, specification, package_1 FROM packaging";
  const values = [];
  if (query) {
    sql += " WHERE product_number LIKE ? OR specification LIKE ?";
    const like = `%${query}%`;
    values.push(like, like);
  }
  sql += " ORDER BY product_number LIMIT ?";
  values.push(limit);
  const result = await db.prepare(sql).bind(...values).all();
  return { count: result.results?.length || 0, packaging: result.results || [] };
}

function normalizeBomRows(rows) {
  const byParent = new Map();
  rows.forEach(row => {
    const parent = cleanText(row.parent_number);
    const children = cleanText(row.child_parts);
    if (!parent || !children) return;
    const set = byParent.get(parent) || new Set();
    children.split(",").map(cleanText).filter(Boolean).forEach(child => set.add(child));
    byParent.set(parent, set);
  });
  return [...byParent.entries()].map(([parent_number, children]) => ({
    parent_number,
    child_parts: [...children].join(",")
  }));
}

function normalizeFixedRows(rows) {
  return uniqueRows(rows.map(row => cleanText(row.part_number))).map(part_number => ({ part_number }));
}

function normalizeUsageRows(rows) {
  return rows.map(row => ({
    parent_number: cleanText(row.parent_number),
    child_part_number: cleanText(row.child_part_number),
    batch_quantity: toNumber(row.batch_quantity),
    item_name: cleanText(row.item_name)
  })).filter(row => row.parent_number && row.child_part_number && row.batch_quantity > 0);
}

function normalizePackagingRows(rows) {
  const byPart = new Map();
  rows.forEach(row => {
    const productNumber = cleanText(row.product_number);
    if (!productNumber) return;
    byPart.set(productNumber, {
      product_number: productNumber,
      specification: cleanText(row.specification),
      package_1: toNumber(row.package_1)
    });
  });
  return [...byPart.values()];
}

function normalizeScheduleRows(rows) {
  const groups = new Map();
  rows.forEach(row => {
    const woId = cleanText(row.wo_id);
    const partNo = cleanText(row.part_no);
    const planQty = toNumber(row.plan_qty);
    const realQty = toNumber(row.real_qty);
    if (!woId || !partNo || planQty <= 0) return;
    const normalized = {
      wo_id: woId,
      part_no: partNo,
      side: cleanText(row.side),
      plan_qty: planQty,
      real_qty: realQty,
      start_date: normalizeDate(row.start_date) || cleanText(row.start_date),
      end_date: normalizeDate(row.end_date) || cleanText(row.end_date),
      panel_size: cleanText(row.panel_size)
    };
    if (!groups.has(woId)) groups.set(woId, []);
    groups.get(woId).push(normalized);
  });
  return [...groups.values()].map(group => {
    const datedRows = group.filter(row => cleanText(row.start_date));
    const baseRows = datedRows.length > 0 ? datedRows : group;
    const base = { ...baseRows[0] };
    if (datedRows.length === 0) {
      base.plan_qty = group.reduce((sum, row) => sum + toNumber(row.plan_qty), 0);
      base.real_qty = group.reduce((sum, row) => sum + toNumber(row.real_qty), 0);
    } else {
      base.plan_qty = toNumber(base.plan_qty);
      base.real_qty = toNumber(base.real_qty);
    }
    base.side = group.reduce((value, row) => mergeTextList(value, row.side), "");
    base.start_date = baseRows.reduce((value, row) => mergeEarlierDate(value, row.start_date), "");
    base.end_date = group.reduce((value, row) => mergeLaterDate(value, row.end_date), "");
    const panelRow = group.find(row => cleanText(row.panel_size));
    base.panel_size = panelRow ? cleanText(panelRow.panel_size) : "";
    return base;
  });
}

function normalizeSelectedModels(rows) {
  const seen = new Set();
  return rows.map(row => ({
    wo_id: cleanText(row.wo_id),
    part_no: cleanText(row.part_no),
    plan_qty: toNumber(row.plan_qty)
  })).filter(row => {
    if (!row.part_no || row.plan_qty <= 0) return false;
    if (row.wo_id) {
      if (seen.has(row.wo_id)) return false;
      seen.add(row.wo_id);
    }
    return true;
  });
}

async function ensureScheduleCompletedTable(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS schedule_completed_items (
      wo_id TEXT PRIMARY KEY NOT NULL,
      part_no TEXT NOT NULL DEFAULT '',
      side TEXT,
      plan_qty REAL,
      real_qty REAL,
      start_date TEXT,
      end_date TEXT,
      panel_size TEXT,
      completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
}

function mergeTextList(currentValue, nextValue) {
  const parts = new Set(String(currentValue || "").split("/").map(cleanText).filter(Boolean));
  const next = cleanText(nextValue);
  if (next) parts.add(next);
  return [...parts].join("/");
}

function mergeEarlierDate(currentValue, nextValue) {
  const current = cleanText(currentValue);
  const next = cleanText(nextValue);
  if (!current) return next;
  if (!next) return current;
  return next < current ? next : current;
}

function mergeLaterDate(currentValue, nextValue) {
  const current = cleanText(currentValue);
  const next = cleanText(nextValue);
  if (!current) return next;
  if (!next) return current;
  return next > current ? next : current;
}

function uniqueRows(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function checkAdminAuth(request, env, url) {
  const expected = cleanText(env.ADMIN_TOKEN);
  if (!expected) return null;
  const provided = cleanText(request.headers.get("x-admin-token")) || cleanText(url.searchParams.get("token"));
  return provided === expected ? null : json({ error: "管理權限驗證失敗" }, 401);
}

function cleanParam(value) {
  return String(value || "").trim() || null;
}

function getLimit(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(1, Math.min(500, Math.floor(number))) : 100;
}

function cleanText(value) {
  return String(value ?? "").trim();
}

function toNumber(value) {
  const text = String(value ?? "").replace(/,/g, "").replace(/[^\d.+-]/g, "").trim();
  const number = Number(text);
  return Number.isFinite(number) ? number : 0;
}

function normalizeDate(value) {
  const text = cleanText(value);
  if (!text) return "";
  const match = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (match) return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  const serial = Number(text);
  if (Number.isFinite(serial) && serial > 20000 && serial < 80000) {
    return new Date(Date.UTC(1899, 11, 30 + Math.floor(serial))).toISOString().slice(0, 10);
  }
  return text;
}

function roundNumber(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function json(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...JSON_HEADERS, ...headers }
  });
}
