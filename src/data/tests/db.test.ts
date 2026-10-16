import {
  MIGRATIONS,
  SCHEMA_VERSION,
  configureConnection,
  initDatabase,
  migrate,
  wipeUserData,
  type Migration,
} from '@/data/db';
import { createMedicinesRepo } from '@/data/medicinesRepo';
import { createScanCacheRepo } from '@/data/scanCacheRepo';
import { createMigratedTestDb, createTestDb, seedCatalog } from './testDb';

let errorSpy: jest.SpyInstance;
beforeEach(() => {
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  errorSpy.mockRestore();
});

function names(db: ReturnType<typeof createTestDb>, type: 'table' | 'index'): string[] {
  const rows = db.raw
    .prepare("SELECT name FROM sqlite_master WHERE type = ? AND name NOT LIKE 'sqlite_%'")
    .all(type) as { name: string }[];
  return rows.map((r) => r.name).sort();
}

function userVersion(db: ReturnType<typeof createTestDb>): number {
  return (db.raw.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;
}

describe('migrations list', () => {
  it('has strictly ascending integer versions starting at 1', () => {
    MIGRATIONS.forEach((m, index) => {
      expect(m.version).toBe(index + 1);
    });
    expect(SCHEMA_VERSION).toBe(MIGRATIONS.length);
  });
});

describe('initDatabase', () => {
  it('builds the user tables and indexes on a fresh database', async () => {
    const db = createTestDb();
    await initDatabase(db);
    expect(userVersion(db)).toBe(SCHEMA_VERSION);
    expect(names(db, 'table')).toEqual(['my_medicines', 'scan_cache', 'settings']);
    expect(names(db, 'index')).toEqual(
      expect.arrayContaining([
        'idx_my_medicines_confirmed',
        'idx_my_medicines_created_at',
        'idx_scan_cache_created_at',
      ]),
    );
  });

  it('is safe to run again and keeps existing data', async () => {
    const db = await createMigratedTestDb();
    await createMedicinesRepo(db).add({ brand: 'Keep me', ingredients: [], confidence: 1 });
    await initDatabase(db);
    await initDatabase(db);
    expect(userVersion(db)).toBe(SCHEMA_VERSION);
    expect(await createMedicinesRepo(db).count()).toBe(1);
  });

  it('upgrades a Phase 1.2 database (settings table at version 0) without losing settings', async () => {
    const db = createTestDb();
    db.raw.exec(
      "CREATE TABLE settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL); INSERT INTO settings VALUES ('language','hi'),('role','elder');",
    );
    expect(userVersion(db)).toBe(0);
    await initDatabase(db);
    expect(userVersion(db)).toBe(SCHEMA_VERSION);
    const rows = db.raw.prepare('SELECT key, value FROM settings ORDER BY key').all();
    expect(rows).toEqual([
      { key: 'language', value: 'hi' },
      { key: 'role', value: 'elder' },
    ]);
  });

  it('leaves a database from a newer app untouched and logs a code', async () => {
    const db = createTestDb();
    db.raw.exec(`PRAGMA user_version = ${SCHEMA_VERSION + 5}`);
    await initDatabase(db);
    expect(userVersion(db)).toBe(SCHEMA_VERSION + 5);
    expect(names(db, 'table')).toEqual([]);
    expect(errorSpy).toHaveBeenCalledWith('db_error:db_version_newer');
  });

  it('keeps a catalogue that arrived from the bundled asset (version 0 file with catalogue tables)', async () => {
    const db = createTestDb();
    seedCatalog(db, [{ id: 'a', brand: 'Dolo', brandNorm: 'dolo', ingredients: '[]' }]);
    await initDatabase(db);
    expect(names(db, 'table')).toEqual(
      expect.arrayContaining([
        'catalog',
        'catalog_fts',
        'ingredient_class',
        'meta',
        'my_medicines',
      ]),
    );
    expect(db.raw.prepare('SELECT COUNT(*) AS n FROM catalog').get()).toEqual({ n: 1 });
  });
});

describe('migrate', () => {
  it('rolls a failing migration back completely and keeps the previous version', async () => {
    const db = createTestDb();
    const broken: Migration[] = [
      { version: 1, name: 'ok', statements: ['CREATE TABLE a (x TEXT)'] },
      { version: 2, name: 'bad', statements: ['CREATE TABLE b (x TEXT)', 'THIS IS NOT SQL'] },
    ];
    await expect(migrate(db, broken)).rejects.toThrow();
    expect(userVersion(db)).toBe(1);
    expect(names(db, 'table')).toEqual(['a']);
  });
});

describe('configureConnection', () => {
  it('turns on foreign keys, secure_delete and a busy timeout', async () => {
    const db = createTestDb();
    await configureConnection(db);
    expect(db.raw.prepare('PRAGMA foreign_keys').get()).toEqual({ foreign_keys: 1 });
    expect(db.raw.prepare('PRAGMA secure_delete').get()).toEqual({ secure_delete: 1 });
    expect(db.raw.prepare('PRAGMA busy_timeout').get()).toEqual({ timeout: 5000 });
  });
});

describe('wipeUserData', () => {
  it('empties the user tables and never touches the catalogue', async () => {
    const db = await createMigratedTestDb();
    seedCatalog(
      db,
      [{ id: 'a', brand: 'Dolo', brandNorm: 'dolo', ingredients: '[]' }],
      [{ ingredient: 'paracetamol', classCode: 'analgesic' }],
    );
    db.raw.exec("INSERT INTO meta VALUES ('source','test')");
    await createMedicinesRepo(db).add({ brand: 'X', ingredients: [], confidence: 1 });
    await createScanCacheRepo(db).put('h', { a: 1 });
    db.raw.exec("INSERT INTO settings VALUES ('language','en')");

    await wipeUserData(db);

    const count = (table: string): number =>
      (db.raw.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
    expect(count('my_medicines')).toBe(0);
    expect(count('scan_cache')).toBe(0);
    expect(count('settings')).toBe(0);
    expect(count('catalog')).toBe(1);
    expect(count('ingredient_class')).toBe(1);
    expect(count('meta')).toBe(1);
  });

  it('works on empty tables and twice in a row', async () => {
    const db = await createMigratedTestDb();
    await wipeUserData(db);
    await wipeUserData(db);
    expect(await createMedicinesRepo(db).count()).toBe(0);
  });
});
