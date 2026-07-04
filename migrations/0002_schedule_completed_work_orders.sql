CREATE TABLE IF NOT EXISTS schedule_items (
  wo_id TEXT PRIMARY KEY NOT NULL,
  part_no TEXT NOT NULL,
  side TEXT,
  plan_qty REAL,
  real_qty REAL,
  start_date TEXT,
  end_date TEXT,
  panel_size TEXT,
  uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_schedule_wo_id
  ON schedule_items(wo_id);

CREATE INDEX IF NOT EXISTS idx_schedule_part_no
  ON schedule_items(part_no);

CREATE TABLE IF NOT EXISTS picking_notes (
  combo_key TEXT NOT NULL,
  child_part_number TEXT NOT NULL,
  note TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (combo_key, child_part_number)
);

CREATE TABLE IF NOT EXISTS schedule_completed_work_orders (
  wo_id TEXT PRIMARY KEY NOT NULL,
  part_no TEXT NOT NULL,
  side TEXT,
  plan_qty REAL,
  real_qty REAL,
  start_date TEXT,
  end_date TEXT,
  panel_size TEXT,
  completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_schedule_completed_part_no
  ON schedule_completed_work_orders(part_no);

CREATE INDEX IF NOT EXISTS idx_schedule_completed_completed_at
  ON schedule_completed_work_orders(completed_at);
