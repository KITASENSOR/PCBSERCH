CREATE TABLE IF NOT EXISTS bom_import_staging_v1 (
  import_id TEXT NOT NULL,
  parent_number TEXT NOT NULL,
  child_parts TEXT NOT NULL,
  PRIMARY KEY (import_id, parent_number)
);

CREATE TABLE IF NOT EXISTS fixed_parts_import_staging_v1 (
  import_id TEXT NOT NULL,
  part_number TEXT NOT NULL,
  PRIMARY KEY (import_id, part_number)
);

CREATE TABLE IF NOT EXISTS usage_items_import_staging_v1 (
  import_id TEXT NOT NULL,
  parent_number TEXT NOT NULL,
  child_part_number TEXT NOT NULL,
  batch_quantity TEXT,
  item_name TEXT
);

CREATE INDEX IF NOT EXISTS idx_usage_import_staging_v1_import_id
  ON usage_items_import_staging_v1(import_id);

CREATE TABLE IF NOT EXISTS packaging_import_staging_v1 (
  import_id TEXT NOT NULL,
  product_number TEXT NOT NULL,
  specification TEXT,
  package_1 TEXT,
  PRIMARY KEY (import_id, product_number)
);

CREATE TABLE IF NOT EXISTS schedule_items_import_staging_v1 (
  import_id TEXT NOT NULL,
  wo_id TEXT NOT NULL,
  part_no TEXT NOT NULL,
  side TEXT,
  plan_qty REAL,
  real_qty REAL,
  start_date TEXT,
  end_date TEXT,
  panel_size TEXT,
  PRIMARY KEY (import_id, wo_id)
);
