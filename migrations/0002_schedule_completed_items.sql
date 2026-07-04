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
);
