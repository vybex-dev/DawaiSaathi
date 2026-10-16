/**
 * Local SQLite layer: connection settings, versioned migrations, wipeUserData.
 *
 * Pure TypeScript. No React and no expo imports, so everything here runs under Jest
 * against an in-memory SQLite (see src/data/tests/testDb.ts).
 *
 * The database is opened ONCE, by <SQLiteProvider> in app/_layout.tsx, which also copies the
 * bundled assets/catalog.db into dawai.db on first run. That provider calls initDatabase().
 *
 * Privacy: nothing in this layer logs medicine names, ingredients or JSON content.
 * Errors are logged as short codes only (see DbErrorCode).
 */

export const DATABASE_NAME = 'dawai.db';

/**
 * DEV ONLY. Set to true for ONE launch to re-copy assets/catalog.db over dawai.db after you
 * rebuild the catalogue. The catalogue lives in the same file as the user tables, so this also
 * wipes medicines, scan cache and settings. Set it back to false afterwards. It is ignored in
 * release builds (_layout.tsx ANDs it with __DEV__).
 */
export const FORCE_CATALOG_REFRESH = false;

export type SqlParam = string | number | null;

export interface RunResult {
  lastInsertRowId: number;
  changes: number;
}

/**
 * The subset of expo-sqlite's SQLiteDatabase this app uses. The real database is assignable to
 * it, and so is the in-memory test double. Repositories depend on this, never on expo-sqlite.
 */
export interface Db {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, ...params: SqlParam[]): Promise<RunResult>;
  getAllAsync<T>(source: string, ...params: SqlParam[]): Promise<T[]>;
  getFirstAsync<T>(source: string, ...params: SqlParam[]): Promise<T | null>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}

// ---------------------------------------------------------------------------------------------
// Logging (codes only) and JSON helpers shared by the repositories
// ---------------------------------------------------------------------------------------------

export type DbErrorCode =
  | 'db_version_newer'
  | 'wal_checkpoint_failed'
  | 'medicine_json_corrupt'
  | 'scan_cache_json_corrupt'
  | 'scan_cache_unserialisable'
  | 'catalog_json_corrupt'
  | 'catalog_unavailable';

/** The only way this layer logs. A code, never a value. */
export function logDbError(code: DbErrorCode): void {
  console.error(`db_error:${code}`);
}

export type JsonResult = { ok: true; value: unknown } | { ok: false };

/** JSON.parse that never throws. */
export function tryParseJson(text: string): JsonResult {
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false };
  }
}

export interface Ingredient {
  name: string;
  /** null when the strength is unreadable. We never guess. */
  strength: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Parses an ingredients JSON column: an array of {name, strength}. Returns null when the text is
 * not valid JSON or has the wrong shape. Callers decide what null means for them.
 */
export function parseIngredients(text: string): Ingredient[] | null {
  const parsed = tryParseJson(text);
  if (!parsed.ok || !Array.isArray(parsed.value)) {
    return null;
  }
  const result: Ingredient[] = [];
  for (const item of parsed.value as unknown[]) {
    if (!isRecord(item)) {
      return null;
    }
    const { name, strength } = item;
    if (typeof name !== 'string' || name.trim() === '') {
      return null;
    }
    if (strength !== undefined && strength !== null && typeof strength !== 'string') {
      return null;
    }
    result.push({ name, strength: typeof strength === 'string' ? strength : null });
  }
  return result;
}

// ---------------------------------------------------------------------------------------------
// Connection settings
// ---------------------------------------------------------------------------------------------

/**
 * Per-connection settings. Runs before migrations (journal_mode cannot change inside a
 * transaction).
 * - WAL: readers never block the writer. synchronous NORMAL is the standard safe pairing.
 * - secure_delete: deleted rows are overwritten, so "delete my data" really removes them.
 */
export async function configureConnection(db: Db): Promise<void> {
  await db.execAsync(
    [
      'PRAGMA journal_mode = WAL;',
      'PRAGMA synchronous = NORMAL;',
      'PRAGMA foreign_keys = ON;',
      'PRAGMA busy_timeout = 5000;',
      'PRAGMA secure_delete = ON;',
    ].join('\n'),
  );
}

// ---------------------------------------------------------------------------------------------
// Migrations
// ---------------------------------------------------------------------------------------------

export interface Migration {
  /** Integer, strictly ascending, starting at 1. Stored in PRAGMA user_version. */
  version: number;
  name: string;
  statements: readonly string[];
}

/**
 * RULES
 * 1. Never edit a migration that has shipped. Add a new one.
 * 2. Every statement must be re-runnable (IF NOT EXISTS), because phones that ran Phase 1.2
 *    already have a `settings` table at user_version 0.
 * 3. Migrations only touch USER tables. The catalogue tables (catalog, catalog_fts,
 *    ingredient_class, meta) come from the bundled assets/catalog.db and are read-only.
 *    tools/build-catalog.ts must leave that file's PRAGMA user_version at 0.
 */
export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    name: 'user tables',
    statements: [
      `CREATE TABLE IF NOT EXISTS settings (
         key TEXT PRIMARY KEY NOT NULL,
         value TEXT NOT NULL
       )`,
      // catalog_id has no foreign key on purpose: the catalogue is a separate, replaceable asset.
      // ingredients is a JSON array of {name, strength}. confirmed is 0/1.
      `CREATE TABLE IF NOT EXISTS my_medicines (
         id TEXT PRIMARY KEY NOT NULL,
         brand TEXT NOT NULL,
         ingredients TEXT NOT NULL,
         strength TEXT,
         form TEXT,
         catalog_id TEXT,
         confidence REAL NOT NULL DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 1),
         confirmed INTEGER NOT NULL DEFAULT 0 CHECK (confirmed IN (0, 1)),
         created_at INTEGER NOT NULL
       )`,
      `CREATE TABLE IF NOT EXISTS scan_cache (
         image_hash TEXT PRIMARY KEY NOT NULL,
         response TEXT NOT NULL,
         created_at INTEGER NOT NULL
       )`,
    ],
  },
  {
    version: 2,
    name: 'indexes',
    statements: [
      'CREATE INDEX IF NOT EXISTS idx_my_medicines_created_at ON my_medicines (created_at)',
      'CREATE INDEX IF NOT EXISTS idx_my_medicines_confirmed ON my_medicines (confirmed)',
      'CREATE INDEX IF NOT EXISTS idx_scan_cache_created_at ON scan_cache (created_at)',
    ],
  },
];

export const SCHEMA_VERSION = MIGRATIONS.reduce((max, m) => Math.max(max, m.version), 0);

/**
 * Brings the database up to the latest schema. Each migration runs in its own transaction
 * together with its user_version bump, so a failure leaves the previous version intact.
 * A database NEWER than this app (user downgraded) is left untouched.
 * Returns the schema version the database is at afterwards.
 */
export async function migrate(
  db: Db,
  migrations: readonly Migration[] = MIGRATIONS,
): Promise<number> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let current = row?.user_version ?? 0;
  const target = migrations.reduce((max, m) => Math.max(max, m.version), 0);

  if (current > target) {
    logDbError('db_version_newer');
    return current;
  }

  for (const migration of migrations) {
    if (migration.version <= current) {
      continue;
    }
    if (!Number.isInteger(migration.version)) {
      throw new Error('migration_version_invalid');
    }
    await db.withTransactionAsync(async () => {
      for (const statement of migration.statements) {
        await db.execAsync(statement);
      }
      await db.execAsync(`PRAGMA user_version = ${migration.version}`);
    });
    current = migration.version;
  }
  return current;
}

/** Passed to <SQLiteProvider onInit>. Runs once per app start, before any screen renders. */
export async function initDatabase(db: Db): Promise<void> {
  await configureConnection(db);
  await migrate(db);
}

// ---------------------------------------------------------------------------------------------
// Delete my data
// ---------------------------------------------------------------------------------------------

/**
 * Clears my_medicines, scan_cache and settings. NEVER touches the catalogue tables.
 * Callers must also reset the in-memory stores (see resetForDev in src/store/session.ts).
 */
export async function wipeUserData(db: Db): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.execAsync('DELETE FROM my_medicines; DELETE FROM scan_cache; DELETE FROM settings;');
  });
  // Best effort: fold the write-ahead log so deleted pages do not linger in the -wal file.
  try {
    await db.execAsync('PRAGMA wal_checkpoint(TRUNCATE);');
  } catch {
    logDbError('wal_checkpoint_failed');
  }
}
