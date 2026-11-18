CREATE TABLE IF NOT EXISTS temporary_bom (
  parent_number TEXT PRIMARY KEY NOT NULL,
  child_parts TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS temporary_bom_import_staging_v1 (
  import_id TEXT NOT NULL,
  parent_number TEXT NOT NULL,
  child_parts TEXT NOT NULL,
  PRIMARY KEY (import_id, parent_number)
);
