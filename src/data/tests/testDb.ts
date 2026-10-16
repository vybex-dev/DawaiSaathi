/**
 * Test-only. An in-memory SQLite that satisfies the Db interface, built on Node's built-in
 * node:sqlite (Node 22.13+). Real SQL runs, including FTS5, so repository tests are meaningful.
 * Never import this from app code: it is not part of the app bundle.
 */
import { initDatabase, type Db, type RunResult, type SqlParam } from '@/data/db';
import type { DatabaseSync } from 'node:sqlite';

function loadDatabaseSync(): typeof DatabaseSync {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require('node:sqlite') as typeof import('node:sqlite')).DatabaseSync;
  } catch {
    throw new Error('Database tests need Node 22.13 or newer (node:sqlite). Run: node -v');
  }
}

export interface TestDb extends Db {
  /** Direct access for arranging or inspecting data in tests. */
  raw: DatabaseSync;
  close(): void;
}

/** In memory by default. Pass a file path to open an existing database file (e.g. a built catalog.db). */
export function createTestDb(filename: string = ':memory:'): TestDb {
  const Database = loadDatabaseSync();
  const raw = new Database(filename);
  let inTransaction = false;

  return {
    raw,
    close: () => raw.close(),
    execAsync: async (source) => {
      raw.exec(source);
    },
    runAsync: async (source, ...params: SqlParam[]): Promise<RunResult> => {
      const result = raw.prepare(source).run(...params);
      return {
        changes: Number(result.changes),
        lastInsertRowId: Number(result.lastInsertRowid),
      };
    },
    getAllAsync: async <T>(source: string, ...params: SqlParam[]): Promise<T[]> =>
      raw.prepare(source).all(...params) as unknown as T[],
    getFirstAsync: async <T>(source: string, ...params: SqlParam[]): Promise<T | null> => {
      const row = raw.prepare(source).get(...params);
      return row === undefined ? null : (row as unknown as T);
    },
    withTransactionAsync: async (task) => {
      // expo-sqlite cannot nest transactions either; fail the same way so tests catch it.
      if (inTransaction) {
        throw new Error('nested_transaction');
      }
      inTransaction = true;
      raw.exec('BEGIN');
      try {
        await task();
        raw.exec('COMMIT');
      } catch (error) {
        raw.exec('ROLLBACK');
        throw error;
      } finally {
        inTransaction = false;
      }
    },
  };
}

/** A database that has been through initDatabase(): user tables exist, no catalogue. */
export async function createMigratedTestDb(): Promise<TestDb> {
  const db = createTestDb();
  await initDatabase(db);
  return db;
}

export interface SeedCatalogRow {
  id: string;
  brand: string;
  brandNorm: string;
  /** Stored verbatim, so tests can plant invalid JSON. */
  ingredients: string;
  strength?: string | null;
  form?: string | null;
  manufacturer?: string | null;
}

/** Builds the catalogue tables exactly as the contract in catalogRepo.ts describes. */
export function seedCatalog(
  db: TestDb,
  rows: readonly SeedCatalogRow[],
  classes: readonly { ingredient: string; classCode: string }[] = [],
): void {
  db.raw.exec(`
    CREATE TABLE IF NOT EXISTS meta (key TEXT, value TEXT);
    CREATE TABLE catalog (
      id TEXT PRIMARY KEY, brand TEXT NOT NULL, brand_norm TEXT NOT NULL,
      ingredients TEXT NOT NULL, strength TEXT, form TEXT, manufacturer TEXT
    );
    CREATE VIRTUAL TABLE catalog_fts USING fts5(
      brand_norm, content='catalog', content_rowid='rowid', prefix='2 3'
    );
    CREATE TABLE ingredient_class (ingredient TEXT NOT NULL, class_code TEXT NOT NULL);
  `);
  const insert = db.raw.prepare(
    'INSERT INTO catalog (id, brand, brand_norm, ingredients, strength, form, manufacturer) VALUES (?, ?, ?, ?, ?, ?, ?)',
  );
  for (const r of rows) {
    insert.run(
      r.id,
      r.brand,
      r.brandNorm,
      r.ingredients,
      r.strength ?? null,
      r.form ?? null,
      r.manufacturer ?? null,
    );
  }
  db.raw.exec("INSERT INTO catalog_fts(catalog_fts) VALUES('rebuild')");
  const insertClass = db.raw.prepare(
    'INSERT INTO ingredient_class (ingredient, class_code) VALUES (?, ?)',
  );
  for (const c of classes) {
    insertClass.run(c.ingredient, c.classCode);
  }
}
