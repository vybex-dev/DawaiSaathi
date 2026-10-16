/**
 * Acceptance test for Prompt 2.1: opens the REAL assets/catalog.db made by `npm run build:catalog`.
 * While the file is still the Phase 1 placeholder (no catalog table) these tests are skipped,
 * so a fresh checkout stays green. After you build the catalogue they must pass.
 */
import { createCatalogRepo } from '@/data/catalogRepo';
import { createTestDb } from '@/data/tests/testDb';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const FILE = path.join(__dirname, '../../assets/catalog.db');

function isBuilt(): boolean {
  if (!fs.existsSync(FILE)) {
    return false;
  }
  const db = new DatabaseSync(FILE, { readOnly: true });
  try {
    return db.prepare("SELECT 1 FROM sqlite_master WHERE name = 'catalog'").get() !== undefined;
  } finally {
    db.close();
  }
}

const built = isBuilt();
const maybe = built ? describe : describe.skip;

maybe('bundled assets/catalog.db', () => {
  it('has a filled meta table', () => {
    const db = new DatabaseSync(FILE, { readOnly: true });
    try {
      const meta = Object.fromEntries(
        (db.prepare('SELECT key, value FROM meta').all() as { key: string; value: string }[]).map(
          (r) => [r.key, r.value],
        ),
      );
      for (const key of ['source', 'licence', 'built_at', 'row_count', 'schema_version']) {
        expect(meta[key]).toBeTruthy();
      }
      const count = (db.prepare('SELECT COUNT(*) AS n FROM catalog').get() as { n: number }).n;
      expect(Number(meta.row_count)).toBe(count);
      expect(count).toBeGreaterThan(0);
      expect(count).toBeLessThanOrEqual(30_000);
      expect(db.prepare('PRAGMA user_version').get()).toEqual({ user_version: 0 });
    } finally {
      db.close();
    }
  });

  it('answers an FTS prefix query for "dolo"', async () => {
    const db = createTestDb(FILE);
    try {
      const found = await createCatalogRepo(db).searchPrefix(['dolo'], 10);
      expect(found.length).toBeGreaterThan(0);
      for (const row of found) {
        // FTS matches whole words by prefix, anywhere in the name.
        expect(row.brandNorm.split(' ').some((word) => word.startsWith('dolo'))).toBe(true);
        expect(row.ingredients.length).toBeGreaterThan(0);
      }
    } finally {
      db.close();
    }
  });

  it('keeps the size under the 15 MB warning limit', () => {
    expect(fs.statSync(FILE).size / (1024 * 1024)).toBeLessThan(15);
  });
});

it('is either built or still the placeholder', () => {
  expect(fs.existsSync(FILE)).toBe(true);
});
