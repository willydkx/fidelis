import { Db } from '@/db/types';

// Applied in order; PRAGMA user_version records the last one that ran. Never edit a shipped
// migration — add a new one instead.
const MIGRATIONS: [version: number, sql: string][] = [
  [
    1,
    `
PRAGMA foreign_keys = ON;

CREATE TABLE objectives (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT    NOT NULL,
    description     TEXT,
    cadence         TEXT    NOT NULL CHECK (cadence IN ('daily','weekly','monthly')),
    tracking_type   TEXT    NOT NULL CHECK (tracking_type IN ('boolean','numeric')),
    target_value    REAL,
    unit            TEXT,
    status          TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','archived')),
    color           TEXT,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    archived_at     TEXT
);

CREATE TABLE daily_entries (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    objective_id    INTEGER NOT NULL REFERENCES objectives(id) ON DELETE CASCADE,
    entry_date      TEXT    NOT NULL,
    completed       INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0,1)),
    value           REAL,
    note            TEXT,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE (objective_id, entry_date)
);

CREATE TABLE app_settings (
    key             TEXT PRIMARY KEY,
    value           TEXT
);

CREATE INDEX idx_entries_date       ON daily_entries(entry_date);
CREATE INDEX idx_entries_objective  ON daily_entries(objective_id);
CREATE INDEX idx_objectives_status  ON objectives(status);
`,
  ],
  [
    2,
    `
PRAGMA foreign_keys = OFF;

CREATE TABLE objectives_new (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT    NOT NULL,
    description     TEXT,
    cadence         TEXT    NOT NULL CHECK (cadence IN ('daily','weekly','monthly','custom_days')),
    tracking_type   TEXT    NOT NULL CHECK (tracking_type IN ('boolean','numeric')),
    target_value    REAL,
    unit            TEXT,
    status          TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','archived')),
    color           TEXT,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    archived_at     TEXT,
    days_of_week    TEXT
);

INSERT INTO objectives_new
    (id, name, description, cadence, tracking_type, target_value, unit, status, color, sort_order, created_at, archived_at, days_of_week)
SELECT
    id, name, description, cadence, tracking_type, target_value, unit, status, color, sort_order, created_at, archived_at, NULL
FROM objectives;

DROP TABLE objectives;
ALTER TABLE objectives_new RENAME TO objectives;

CREATE INDEX idx_objectives_status ON objectives(status);

PRAGMA foreign_keys = ON;
`,
  ],
  [
    3,
    `
-- Sync between devices: a stable id for objectives, the time of each row's last change
-- (milliseconds since 1970, 0 = before sync existed) and a record of deletions.
ALTER TABLE objectives ADD COLUMN uid TEXT;
ALTER TABLE objectives ADD COLUMN modified_at INTEGER NOT NULL DEFAULT 0;
UPDATE objectives SET uid = lower(hex(randomblob(16)));
CREATE UNIQUE INDEX idx_objectives_uid ON objectives(uid);

ALTER TABLE daily_entries ADD COLUMN modified_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE app_settings ADD COLUMN modified_at INTEGER NOT NULL DEFAULT 0;

-- kind 'objective': key = objective uid; kind 'entry': key = '<objective uid>|<entry date>'.
CREATE TABLE sync_tombstones (
    kind        TEXT    NOT NULL,
    key         TEXT    NOT NULL,
    deleted_at  INTEGER NOT NULL,
    PRIMARY KEY (kind, key)
);
`,
  ],
];

export async function runMigrations(db: Db): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version', []);
  const currentVersion = row?.user_version ?? 0;

  for (const [version, sql] of MIGRATIONS) {
    if (version <= currentVersion) {
      continue;
    }
    await db.execAsync(sql);
    await db.execAsync(`PRAGMA user_version = ${version}`);
  }
  await db.execAsync('PRAGMA foreign_keys = ON');
}
