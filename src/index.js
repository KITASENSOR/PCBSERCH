var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.js
var w = Object.defineProperty;
var p = /* @__PURE__ */ __name((a, e) => w(a, "name", { value: e, configurable: true }), "p");
var B = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
var X = { async fetch(a, e, t) {
  let n = new URL(a.url);
  return n.pathname.startsWith("/api/") ? L(a, e, n) : e.ASSETS ? e.ASSETS.fetch(a) : new Response("Not found", { status: 404 });
} };
async function L(a, e, t) {
  if (!e.DB) return l({ error: "D1 \u8CC7\u6599\u5EAB\u672A\u8A2D\u5B9A" }, 500);
  try {
    if (a.method === "GET" && t.pathname === "/api/health") return l({ ok: true });
    if (a.method === "GET" && t.pathname === "/api/bom") return l(await A(e.DB));
    if (a.method === "GET" && t.pathname === "/api/usage") return l(await C(e.DB, t.searchParams));
    if (a.method === "GET" && t.pathname === "/api/packaging") return l(await j(e.DB, t.searchParams));
    if (a.method === "GET" && t.pathname === "/api/schedule") return l(await I(e.DB));
    if (a.method === "POST" && t.pathname === "/api/schedule/delete") return l(await V(e.DB, await a.json()));
    if (a.method === "POST" && t.pathname === "/api/schedule/complete") return l(await ee(e.DB, await a.json()));
    if (a.method === "GET" && t.pathname === "/api/picking/notes") return l(await oe(e.DB, t.searchParams));
    if (a.method === "POST" && t.pathname === "/api/picking/notes") return l(await re(e.DB, await a.json()));
    if (a.method === "GET" && t.pathname === "/api/admin/export") {
      let n = M(a, e, t);
      return n || l(await N(e.DB));
    }
    if (a.method === "POST" && t.pathname === "/api/admin/import") {
      let n = M(a, e, t);
      return n || l(await x(e.DB, await a.json()));
    }
    return a.method === "POST" && t.pathname === "/api/materials/calculate" ? l(await z(e.DB, await a.json())) : t.pathname.startsWith("/api/") ? l({ error: "\u4E0D\u652F\u63F4\u7684 API \u65B9\u6CD5" }, 405, { allow: "GET, POST" }) : l({ error: "\u627E\u4E0D\u5230 API" }, 404);
  } catch (n) {
    return console.error(JSON.stringify({ event: "api_error", path: t.pathname, message: n instanceof Error ? n.message : String(n) })), l({ error: "\u4F3A\u670D\u5668\u932F\u8AA4" }, 500);
  }
}
__name(L, "L");
p(L, "handleApi");
async function A(a) {
  let [e, t] = await Promise.all([a.prepare("SELECT parent_number, child_parts FROM bom ORDER BY parent_number").all(), a.prepare("SELECT part_number FROM fixed_parts ORDER BY part_number").all()]), n = (e.results || []).map((i) => ({ parent_number: i.parent_number, child_parts: i.child_parts })), r = (t.results || []).map((i) => i.part_number);
  return { updated_at: (/* @__PURE__ */ new Date()).toISOString(), counts: { bom: n.length, fixed: r.length }, bom: n, fixed: r };
}
__name(A, "A");
p(A, "getBomPayload");
async function I(a) {
  let [t, n] = await Promise.all([
    a.prepare("SELECT wo_id, part_no, side, plan_qty, real_qty, start_date, end_date, panel_size FROM schedule_items ORDER BY rowid").all(),
    a.prepare("SELECT wo_id, part_no, side, plan_qty, real_qty, start_date, end_date, panel_size, completed_at FROM schedule_completed_work_orders ORDER BY completed_at DESC, rowid DESC").all()
  ]), r = t.results || [], i = n.results || [], c = te(r, false), s = te(i, true);
  return { updated_at: (/* @__PURE__ */ new Date()).toISOString(), count: r.length, completed_count: i.length, groups: c, completed_groups: s };
}
__name(I, "I");
p(I, "getSchedulePayload");
function te(a, e) {
  let t = [], n = /* @__PURE__ */ new Map();
  return (a || []).forEach((r) => {
    let i = e ? R(r.completed_at) || "\u5DF2\u5B8C\u5DE5" : R(r.start_date) || "\u672A\u6392\u65E5\u671F";
    if (!n.has(i)) {
      let s = { date: i, items: [], total_quantity: 0, completed: e };
      n.set(i, s), t.push(s);
    }
    let c = { wo_id: r.wo_id, part_no: r.part_no, side: r.side || "", plan_qty: m(r.plan_qty), real_qty: m(r.real_qty), start_date: r.start_date || "", end_date: r.end_date || "", panel_size: r.panel_size || "", completed_at: r.completed_at || "", completed: e };
    n.get(i).items.push(c), n.get(i).total_quantity += c.plan_qty;
  }), t;
}
__name(te, "te");
p(te, "buildScheduleGroups");
async function V(a, e) {
  let t = J((Array.isArray(e?.wo_ids) ? e.wo_ids : []).map(u));
  if (t.length === 0) return { error: "\u8ACB\u63D0\u4F9B\u8981\u522A\u9664\u7684\u5DE5\u55AE" };
  let n = 0;
  for (let r = 0; r < t.length; r += 80) {
    let i = t.slice(r, r + 80), c = i.map(() => "?").join(", "), s = await a.prepare(`SELECT COUNT(*) AS count FROM schedule_items WHERE wo_id IN (${c})`).bind(...i).all();
    n += m(s.results?.[0]?.count);
    await a.prepare(`DELETE FROM schedule_items WHERE wo_id IN (${c})`).bind(...i).run();
  }
  let r = await Z(a, t);
  return { deleted_schedule: n, deleted_note_combos: r };
}
__name(V, "V");
p(V, "deleteScheduleItems");
async function ee(a, e) {
  let t = J((Array.isArray(e?.wo_ids) ? e.wo_ids : []).map(u));
  if (t.length === 0) return { error: "\u8ACB\u63D0\u4F9B\u8981\u5B8C\u5DE5\u7684\u5DE5\u55AE" };
  let n = await k(a, "SELECT wo_id, part_no, side, plan_qty, real_qty, start_date, end_date, panel_size FROM schedule_items WHERE wo_id IN (__IN__) ORDER BY rowid", t);
  for (let c of n)
    await a.prepare(`INSERT INTO schedule_completed_work_orders(wo_id, part_no, side, plan_qty, real_qty, start_date, end_date, panel_size, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(wo_id) DO UPDATE SET
        part_no = excluded.part_no,
        side = excluded.side,
        plan_qty = excluded.plan_qty,
        real_qty = excluded.real_qty,
        start_date = excluded.start_date,
        end_date = excluded.end_date,
        panel_size = excluded.panel_size,
        completed_at = CURRENT_TIMESTAMP`).bind(c.wo_id, c.part_no, c.side || "", m(c.plan_qty), m(c.real_qty), c.start_date || "", c.end_date || "", c.panel_size || "").run();
  let r = 0;
  for (let c = 0; c < t.length; c += 80) {
    let s = t.slice(c, c + 80), _ = s.map(() => "?").join(", "), b = await a.prepare(`SELECT COUNT(*) AS count FROM schedule_items WHERE wo_id IN (${_})`).bind(...s).all();
    r += m(b.results?.[0]?.count), await a.prepare(`DELETE FROM schedule_items WHERE wo_id IN (${_})`).bind(...s).run();
  }
  return { completed_schedule: n.length, removed_active_schedule: r };
}
__name(ee, "ee");
p(ee, "completeScheduleItems");
async function Z(a, e) {
  let t = 0;
  try {
    let n = new Set(e.map(u).filter(Boolean)), r = await a.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('picking_notes', 'picking_note_items')").all();
    for (let i of r.results || []) {
      let c = u(i.name);
      if (!c) continue;
      let s = await a.prepare(`PRAGMA table_info(${c})`).all(), _ = new Set((s.results || []).map((o) => u(o.name))), b = _.has("combo_key") ? "combo_key" : _.has("key") ? "key" : _.has("picking_key") ? "picking_key" : "";
      if (!b) continue;
      let d = await a.prepare(`SELECT DISTINCT ${b} AS combo_key FROM ${c}`).all(), o = (d.results || []).map((h) => u(h.combo_key)).filter((h) => h && h.split("|").map(u).some((f) => n.has(f)));
      if (o.length === 0) continue;
      t += o.length;
      for (let h = 0; h < o.length; h += 80) {
        let f = o.slice(h, h + 80), g = f.map(() => "?").join(", ");
        await a.prepare(`DELETE FROM ${c} WHERE ${b} IN (${g})`).bind(...f).run();
      }
    }
  } catch (n) {
    console.warn(JSON.stringify({ event: "picking_note_delete_skipped", message: n instanceof Error ? n.message : String(n) }));
  }
  return t;
}
__name(Z, "Z");
p(Z, "deletePickingNoteCombos");
async function oe(a, e) {
  let t = u(e.get("key")), n = await a.prepare("SELECT child_part_number, note FROM picking_notes WHERE combo_key = ? ORDER BY child_part_number").bind(t).all(), r = {};
  for (let i of n.results || []) r[i.child_part_number] = i.note;
  return { key: t, notes: r };
}
__name(oe, "oe");
p(oe, "getPickingNotes");
async function re(a, e) {
  let t = u(e?.key), n = u(e?.child_part_number), r = u(e?.note);
  if (!t || !n) return { error: "\u7F3A\u5C11\u53D6\u6599\u5099\u8A3B\u9375\u503C\u6216\u6599\u865F" };
  return r ? (await a.prepare(`INSERT INTO picking_notes(combo_key, child_part_number, note, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(combo_key, child_part_number) DO UPDATE SET
      note = excluded.note,
      updated_at = CURRENT_TIMESTAMP`).bind(t, n, r).run(), { ok: true }) : (await a.prepare("DELETE FROM picking_notes WHERE combo_key = ? AND child_part_number = ?").bind(t, n).run(), { ok: true });
}
__name(re, "re");
p(re, "savePickingNote");
async function N(a) {
  let [e, t, n, r, i] = await Promise.all([a.prepare("SELECT parent_number, child_parts FROM bom ORDER BY parent_number").all(), a.prepare("SELECT part_number FROM fixed_parts ORDER BY part_number").all(), a.prepare("SELECT parent_number, child_part_number, batch_quantity, item_name FROM usage_items ORDER BY parent_number, child_part_number").all(), a.prepare("SELECT product_number, specification, package_1 FROM packaging ORDER BY product_number").all(), a.prepare("SELECT wo_id, part_no, side, plan_qty, real_qty, start_date, end_date, panel_size FROM schedule_items ORDER BY rowid").all()]), c = { bom: e.results || [], fixed_parts: t.results || [], usage_items: n.results || [], packaging: r.results || [], schedule_items: i.results || [] };
  return { exported_at: (/* @__PURE__ */ new Date()).toISOString(), counts: Object.fromEntries(Object.entries(c).map(([s, _]) => [s, _.length])), tables: c };
}
__name(N, "N");
p(N, "exportDatabase");
async function x(a, e) {
  let t = e?.tables || {}, n = {};
  if (Array.isArray(t.packaging)) {
    let r = W(t.packaging);
    await y(a, "packaging", ["product_number", "specification", "package_1"], r), n.packaging = r.length;
  }
  if (Array.isArray(t.usage_items)) {
    let r = $(t.usage_items);
    await y(a, "usage_items", ["parent_number", "child_part_number", "batch_quantity", "item_name"], r, { resetSequence: true }), n.usage_items = r.length;
  }
  if (Array.isArray(t.fixed_parts)) {
    let r = Y(t.fixed_parts);
    await y(a, "fixed_parts", ["part_number"], r), n.fixed_parts = r.length;
  }
  if (Array.isArray(t.bom)) {
    let r = P(t.bom);
    await y(a, "bom", ["parent_number", "child_parts"], r), n.bom = r.length;
  }
  if (Array.isArray(t.schedule_items)) {
    let r = G(t.schedule_items);
    let i = await ne(a, r);
    await y(a, "schedule_items", ["wo_id", "part_no", "side", "plan_qty", "real_qty", "start_date", "end_date", "panel_size"], i.rows), n.schedule_items = i.rows.length, n.completed_skipped = i.skipped, n.completed_removed = i.removed;
  }
  return Object.keys(n).length === 0 ? { error: "\u6C92\u6709\u53EF\u532F\u5165\u7684\u8CC7\u6599" } : { imported_at: (/* @__PURE__ */ new Date()).toISOString(), counts: n };
}
__name(x, "x");
p(x, "importDatabase");
async function ne(a, e) {
  let t = new Set((e || []).map((c) => u(c.wo_id)).filter(Boolean)), n = await a.prepare("SELECT wo_id FROM schedule_completed_work_orders").all(), r = new Set((n.results || []).map((c) => u(c.wo_id)).filter(Boolean)), i = [...r].filter((c) => !t.has(c));
  for (let c = 0; c < i.length; c += 80) {
    let s = i.slice(c, c + 80), _ = s.map(() => "?").join(", ");
    await a.prepare(`DELETE FROM schedule_completed_work_orders WHERE wo_id IN (${_})`).bind(...s).run();
  }
  i.forEach((c) => r.delete(c));
  let c = (e || []).filter((s) => !r.has(u(s.wo_id)));
  return { rows: c, skipped: (e || []).length - c.length, removed: i.length };
}
__name(ne, "ne");
p(ne, "filterCompletedScheduleRows");
var F = 100;
var O = 50;
async function y(a, e, t, n, r = {}) {
  let i = [a.prepare(`DELETE FROM ${e}`)];
  if (r.resetSequence && i.push(a.prepare("DELETE FROM sqlite_sequence WHERE name = ?").bind(e)), await a.batch(i), n.length === 0) return;
  let c = Math.max(1, Math.floor((F - 1) / t.length)), s = [];
  for (let _ = 0; _ < n.length; _ += c) {
    let b = n.slice(_, _ + c), d = b.map(() => `(${t.map(() => "?").join(", ")})`).join(", "), o = `INSERT INTO ${e} (${t.join(", ")}) VALUES ${d}`, h = b.flatMap((f) => t.map((g) => f[g] ?? ""));
    s.push(a.prepare(o).bind(...h));
  }
  for (let _ = 0; _ < s.length; _ += O) await a.batch(s.slice(_, _ + O));
}
__name(y, "y");
p(y, "replaceTable");
async function z(a, e) {
  let t = Q(e?.models || []);
  if (t.length === 0) return { count: 0, items: [] };
  let n = /* @__PURE__ */ new Map();
  t.forEach((o) => {
    n.set(o.part_no, (n.get(o.part_no) || 0) + o.plan_qty);
  });
  let r = [...n.keys()], i = await k(a, "SELECT parent_number, child_part_number, batch_quantity, item_name FROM usage_items WHERE parent_number IN (__IN__) ORDER BY child_part_number", r), c = /* @__PURE__ */ new Map();
  for (let o of i) {
    let h = n.get(o.parent_number) || 0, f = m(o.batch_quantity), g = h * f;
    if (!o.child_part_number || g === 0) continue;
    let q = o.child_part_number, E = c.get(q) || { child_part_number: q, required_quantity: 0, item_name: "", parents: [] };
    !E.item_name && o.item_name && (E.item_name = String(o.item_name).trim()), E.required_quantity += g, E.parents.push({ parent_number: o.parent_number, plan_qty: h, batch_quantity: f, required_quantity: g }), c.set(q, E);
  }
  let s = [...c.keys()], _ = await k(a, "SELECT product_number, package_1 FROM packaging WHERE product_number IN (__IN__)", s), b = new Map(_.map((o) => [o.product_number, o])), d = [...c.values()].map((o) => {
    let h = b.get(o.child_part_number) || {}, f = m(h.package_1), g = f > 0 ? o.required_quantity / f : null;
    return { child_part_number: o.child_part_number, item_name: o.item_name || "", required_quantity: T(o.required_quantity, 4), package_quantity: f || null, package_count: g === null ? null : T(g, 1), parents: o.parents };
  }).sort((o, h) => o.child_part_number.localeCompare(h.child_part_number, void 0, { numeric: true }));
  return { selected_count: t.length, model_count: r.length, count: d.length, items: d };
}
__name(z, "z");
p(z, "calculateMaterials");
async function k(a, e, t, n = 80) {
  let r = [];
  for (let i = 0; i < t.length; i += n) {
    let c = t.slice(i, i + n);
    if (c.length === 0) continue;
    let s = c.map(() => "?").join(", "), _ = await a.prepare(e.replace("__IN__", s)).bind(...c).all();
    r.push(..._.results || []);
  }
  return r;
}
__name(k, "k");
p(k, "queryByIn");
async function C(a, e) {
  let t = S(e.get("parent")), n = S(e.get("part")), r = S(e.get("q")), i = D(e.get("limit")), c = "SELECT parent_number, child_part_number, batch_quantity, item_name FROM usage_items", s = [], _ = [];
  if (t && (s.push("parent_number = ?"), _.push(t)), n && (s.push("child_part_number = ?"), _.push(n)), r) {
    s.push("(parent_number LIKE ? OR child_part_number LIKE ? OR item_name LIKE ?)");
    let d = `%${r}%`;
    _.push(d, d, d);
  }
  s.length > 0 && (c += ` WHERE ${s.join(" AND ")}`), c += " ORDER BY parent_number, child_part_number LIMIT ?", _.push(i);
  let b = await a.prepare(c).bind(..._).all();
  return { count: b.results?.length || 0, usage: b.results || [] };
}
__name(C, "C");
p(C, "queryUsage");
async function j(a, e) {
  let t = S(e.get("q")), n = D(e.get("limit")), r = "SELECT product_number, specification, package_1 FROM packaging", i = [];
  if (t) {
    r += " WHERE product_number LIKE ? OR specification LIKE ?";
    let s = `%${t}%`;
    i.push(s, s);
  }
  r += " ORDER BY product_number LIMIT ?", i.push(n);
  let c = await a.prepare(r).bind(...i).all();
  return { count: c.results?.length || 0, packaging: c.results || [] };
}
__name(j, "j");
p(j, "queryPackaging");
function P(a) {
  let e = /* @__PURE__ */ new Map();
  return a.forEach((t) => {
    let n = u(t.parent_number), r = u(t.child_parts);
    if (!n || !r) return;
    let i = e.get(n) || /* @__PURE__ */ new Set();
    r.split(",").map(u).filter(Boolean).forEach((c) => i.add(c)), e.set(n, i);
  }), [...e.entries()].map(([t, n]) => ({ parent_number: t, child_parts: [...n].join(",") }));
}
__name(P, "P");
p(P, "normalizeBomRows");
function Y(a) {
  return J(a.map((e) => u(e.part_number))).map((e) => ({ part_number: e }));
}
__name(Y, "Y");
p(Y, "normalizeFixedRows");
function $(a) {
  return a.map((e) => ({ parent_number: u(e.parent_number), child_part_number: u(e.child_part_number), batch_quantity: m(e.batch_quantity), item_name: u(e.item_name) })).filter((e) => e.parent_number && e.child_part_number && e.batch_quantity > 0);
}
__name($, "$");
p($, "normalizeUsageRows");
function W(a) {
  let e = /* @__PURE__ */ new Map();
  return a.forEach((t) => {
    let n = u(t.product_number);
    n && e.set(n, { product_number: n, specification: u(t.specification), package_1: m(t.package_1) });
  }), [...e.values()];
}
__name(W, "W");
p(W, "normalizePackagingRows");
function G(a) {
  let e = /* @__PURE__ */ new Map();
  return a.forEach((t) => {
    let n = u(t.wo_id), r = u(t.part_no), i = m(t.plan_qty), c = m(t.real_qty);
    if (!n || !r || i <= 0) return;
    let s = { wo_id: n, part_no: r, side: u(t.side), plan_qty: i, real_qty: c, start_date: R(t.start_date) || u(t.start_date), end_date: R(t.end_date) || u(t.end_date), panel_size: u(t.panel_size) };
    e.has(n) || e.set(n, []), e.get(n).push(s);
  }), [...e.values()].map((t) => {
    let n = t.filter((i) => u(i.start_date)), r = n.length > 0 ? n : t, i = { ...r[0] };
    if (n.length === 0) {
      i.plan_qty = t.reduce((c, s) => c + m(s.plan_qty), 0), i.real_qty = t.reduce((c, s) => c + m(s.real_qty), 0);
    } else {
      i.plan_qty = m(i.plan_qty), i.real_qty = m(i.real_qty);
    }
    i.side = t.reduce((c, s) => H(c, s.side), ""), i.start_date = r.reduce((c, s) => K(c, s.start_date), ""), i.end_date = t.reduce((c, s) => U(c, s.end_date), "");
    let c = t.find((s) => u(s.panel_size));
    return i.panel_size = c ? u(c.panel_size) : "", i;
  });
}
__name(G, "G");
p(G, "normalizeScheduleRows");
function H(a, e) {
  let t = new Set(String(a || "").split("/").map(u).filter(Boolean));
  return e && t.add(e), [...t].join("/");
}
__name(H, "H");
p(H, "mergeTextList");
function K(a, e) {
  return a ? e && e < a ? e : a : e || "";
}
__name(K, "K");
p(K, "mergeEarlierDate");
function U(a, e) {
  return a ? e && e > a ? e : a : e || "";
}
__name(U, "U");
p(U, "mergeLaterDate");
function Q(a) {
  let e = /* @__PURE__ */ new Set();
  return a.map((t) => ({ wo_id: u(t.wo_id), part_no: u(t.part_no), plan_qty: m(t.plan_qty) })).filter((t) => {
    if (!t.part_no || t.plan_qty <= 0) return false;
    if (t.wo_id) {
      if (e.has(t.wo_id)) return false;
      e.add(t.wo_id);
    }
    return true;
  });
}
__name(Q, "Q");
p(Q, "normalizeSelectedModels");
function J(a) {
  return [...new Set(a.filter(Boolean))].sort((e, t) => e.localeCompare(t, void 0, { numeric: true }));
}
__name(J, "J");
p(J, "uniqueRows");
function M(a, e, t) {
  let n = u(e.ADMIN_TOKEN);
  return !n || (u(a.headers.get("x-admin-token")) || u(t.searchParams.get("token"))) === n ? null : l({ error: "\u7BA1\u7406\u6B0A\u9650\u9A57\u8B49\u5931\u6557" }, 401);
}
__name(M, "M");
p(M, "checkAdminAuth");
function S(a) {
  return String(a || "").trim() || null;
}
__name(S, "S");
p(S, "cleanParam");
function D(a) {
  let e = Number(a);
  return Number.isFinite(e) ? Math.max(1, Math.min(500, Math.floor(e))) : 100;
}
__name(D, "D");
p(D, "getLimit");
function u(a) {
  return String(a ?? "").trim();
}
__name(u, "u");
p(u, "cleanText");
function m(a) {
  let e = String(a ?? "").replace(/,/g, "").replace(/[^\d.+-]/g, "").trim(), t = Number(e);
  return Number.isFinite(t) ? t : 0;
}
__name(m, "m");
p(m, "toNumber");
function R(a) {
  let e = u(a);
  if (!e) return "";
  let t = e.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (t) return `${t[1]}-${t[2].padStart(2, "0")}-${t[3].padStart(2, "0")}`;
  let n = Number(e);
  return Number.isFinite(n) && n > 2e4 && n < 8e4 ? new Date(Date.UTC(1899, 11, 30 + Math.floor(n))).toISOString().slice(0, 10) : e;
}
__name(R, "R");
p(R, "normalizeDate");
function T(a, e) {
  let t = 10 ** e;
  return Math.round((a + Number.EPSILON) * t) / t;
}
__name(T, "T");
p(T, "roundNumber");
function l(a, e = 200, t = {}) {
  return new Response(JSON.stringify(a), { status: e, headers: { ...B, ...t } });
}
__name(l, "l");
p(l, "json");
export {
  X as default
};
//# sourceMappingURL=index.js.map
