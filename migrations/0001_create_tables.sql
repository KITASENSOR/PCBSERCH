CREATE TABLE IF NOT EXISTS bom (
  parent_number TEXT PRIMARY KEY NOT NULL,
  child_parts TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fixed_parts (
  part_number TEXT PRIMARY KEY NOT NULL
);

CREATE TABLE IF NOT EXISTS usage_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_number TEXT NOT NULL,
  child_part_number TEXT NOT NULL,
  batch_quantity TEXT,
  item_name TEXT
);

CREATE INDEX IF NOT EXISTS idx_usage_parent
  ON usage_items(parent_number);

CREATE INDEX IF NOT EXISTS idx_usage_child_part
  ON usage_items(child_part_number);

CREATE TABLE IF NOT EXISTS packaging (
  product_number TEXT PRIMARY KEY NOT NULL,
  specification TEXT,
  package_1 TEXT
);
