const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      return handleApi(request, env, url);
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response("Not found", { status: 404 });
  }
};

async function handleApi(request, env, url) {
  if (request.method !== "GET") {
    return json({ error: "只支援 GET 請求" }, 405, {
      allow: "GET"
    });
  }

  if (!env.DB) {
    return json({ error: "D1 資料庫尚未綁定" }, 500);
  }

  try {
    if (url.pathname === "/api/health") {
      return json({ ok: true });
    }

    if (url.pathname === "/api/bom") {
      return json(await getBomPayload(env.DB));
    }

    if (url.pathname === "/api/usage") {
      return json(await queryUsage(env.DB, url.searchParams));
    }

    if (url.pathname === "/api/packaging") {
      return json(await queryPackaging(env.DB, url.searchParams));
    }

    return json({ error: "找不到 API" }, 404);
  } catch (error) {
    console.error(JSON.stringify({
      event: "api_error",
      path: url.pathname,
      message: error instanceof Error ? error.message : String(error)
    }));

    return json({ error: "資料讀取失敗" }, 500);
  }
}

async function getBomPayload(db) {
  const bomQuery = db
    .prepare("SELECT parent_number, child_parts FROM bom ORDER BY parent_number")
    .all();
  const fixedQuery = db
    .prepare("SELECT part_number FROM fixed_parts ORDER BY part_number")
    .all();

  const [bomResult, fixedResult] = await Promise.all([bomQuery, fixedQuery]);
  const bom = (bomResult.results || []).map((row) => ({
    parent_number: row.parent_number,
    child_parts: row.child_parts
  }));
  const fixed = (fixedResult.results || []).map((row) => row.part_number);

  return {
    updated_at: new Date().toISOString(),
    counts: {
      bom: bom.length,
      fixed: fixed.length
    },
    bom,
    fixed
  };
}

async function queryUsage(db, searchParams) {
  const parent = cleanParam(searchParams.get("parent"));
  const part = cleanParam(searchParams.get("part"));
  const q = cleanParam(searchParams.get("q"));
  const limit = getLimit(searchParams.get("limit"));

  let sql = "SELECT parent_number, child_part_number, batch_quantity, item_name FROM usage_items";
  const where = [];
  const binds = [];

  if (parent) {
    where.push("parent_number = ?");
    binds.push(parent);
  }

  if (part) {
    where.push("child_part_number = ?");
    binds.push(part);
  }

  if (q) {
    where.push("(parent_number LIKE ? OR child_part_number LIKE ? OR item_name LIKE ?)");
    const token = `%${q}%`;
    binds.push(token, token, token);
  }

  if (where.length > 0) {
    sql += ` WHERE ${where.join(" AND ")}`;
  }

  sql += " ORDER BY parent_number, child_part_number LIMIT ?";
  binds.push(limit);

  const result = await db.prepare(sql).bind(...binds).all();

  return {
    count: result.results?.length || 0,
    usage: result.results || []
  };
}

async function queryPackaging(db, searchParams) {
  const q = cleanParam(searchParams.get("q"));
  const limit = getLimit(searchParams.get("limit"));

  let sql = "SELECT product_number, specification, package_1 FROM packaging";
  const binds = [];

  if (q) {
    sql += " WHERE product_number LIKE ? OR specification LIKE ?";
    const token = `%${q}%`;
    binds.push(token, token);
  }

  sql += " ORDER BY product_number LIMIT ?";
  binds.push(limit);

  const result = await db.prepare(sql).bind(...binds).all();

  return {
    count: result.results?.length || 0,
    packaging: result.results || []
  };
}

function cleanParam(value) {
  const text = String(value || "").trim();
  return text || null;
}

function getLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 100;
  return Math.max(1, Math.min(500, Math.floor(parsed)));
}

function json(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...JSON_HEADERS,
      ...headers
    }
  });
}
