import { SCHEMA_VERSION, initDatabase } from '@/data/db';
import { createCatalogRepo } from '@/data/catalogRepo';
import { createTestDb } from '@/data/tests/testDb';
import { parse } from 'csv-parse/sync';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { buildCatalog, main, type BuildOptions, type BuildResult } from '../../tools/build-catalog';

const FIXTURES = path.join(__dirname, 'fixtures');
const AZ = path.join(FIXTURES, 'az.csv');
const MEDICINE_DATA = path.join(FIXTURES, 'medicine_data.csv');
const MEDICINE_DETAILS = path.join(FIXTURES, 'Medicine_Details.csv');
const DEMO = path.join(FIXTURES, 'demo.txt');

let tmp: string;
let counter = 0;

beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'catalog-test-'));
});
afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function options(overrides: Partial<BuildOptions> = {}): BuildOptions {
  counter += 1;
  const dir = path.join(tmp, `run-${counter}`);
  return {
    azPath: AZ,
    medicineDataPath: MEDICINE_DATA,
    medicineDetailsPath: MEDICINE_DETAILS,
    demoBrandsPath: DEMO,
    outDb: path.join(dir, 'catalog.db'),
    outDir: path.join(dir, 'build'),
    maxRows: 30_000,
    twoIngredientPolicy: 'corroborated',
    source: 'test source',
    licence: 'TEST-LICENCE',
    now: () => new Date('2026-10-20T10:00:00.000Z'),
    ...overrides,
  };
}

function readCsv(file: string): Record<string, string>[] {
  return parse(fs.readFileSync(file, 'utf8'), { columns: true, skip_empty_lines: true }) as Record<
    string,
    string
  >[];
}

function rows(file: string, sql: string, ...params: string[]): Record<string, unknown>[] {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    return db.prepare(sql).all(...params) as Record<string, unknown>[];
  } finally {
    db.close();
  }
}

async function build(
  overrides: Partial<BuildOptions> = {},
): Promise<{ opts: BuildOptions; result: BuildResult }> {
  const opts = options(overrides);
  return { opts, result: await buildCatalog(opts) };
}

describe('buildCatalog with the default policy', () => {
  let opts: BuildOptions;
  let result: BuildResult;
  beforeAll(async () => {
    ({ opts, result } = await build());
  });

  it('creates catalog.db with the expected tables and leaves user_version at 0', () => {
    expect(fs.existsSync(opts.outDb)).toBe(true);
    const tables = rows(
      opts.outDb,
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    ).map((r) => r.name);
    expect(tables).toEqual(
      expect.arrayContaining(['catalog', 'catalog_fts', 'ingredient_class', 'meta']),
    );
    expect(rows(opts.outDb, 'PRAGMA user_version')).toEqual([{ user_version: 0 }]);
  });

  it('answers an FTS prefix query for "dolo"', () => {
    const found = rows(
      opts.outDb,
      `SELECT c.brand FROM catalog_fts JOIN catalog c ON c.rowid = catalog_fts.rowid
       WHERE catalog_fts MATCH '"dolo"*' ORDER BY c.brand`,
    ).map((r) => r.brand);
    expect(found).toEqual(['Dolo 650 Tablet', 'Dologel']);
  });

  it('fills the meta table', () => {
    const meta = Object.fromEntries(
      rows(opts.outDb, 'SELECT key, value FROM meta').map((r) => [r.key, r.value]),
    );
    expect(meta).toMatchObject({
      source: 'test source',
      licence: 'TEST-LICENCE',
      built_at: '2026-10-20T10:00:00.000Z',
      row_count: '10',
      schema_version: '1',
      two_ingredient_policy: 'corroborated',
      cross_checked_with: 'medicine_data.csv; Medicine_Details.csv',
    });
  });

  it('accepts the good rows and keeps source text exactly', () => {
    expect(result.rowCount).toBe(10);
    const all = rows(opts.outDb, 'SELECT * FROM catalog ORDER BY id');
    const byId = Object.fromEntries(all.map((r) => [r.id, r]));
    expect(Object.keys(byId).sort()).toEqual(
      [
        'az-1',
        'az-10',
        'az-12',
        'az-13',
        'az-14',
        'az-15',
        'az-16',
        'az-17',
        'az-2',
        'az-9',
      ].sort(),
    );
    expect(byId['az-1']).toMatchObject({
      brand: 'Dolo 650 Tablet',
      brand_norm: 'dolo 650',
      ingredients: '[{"name":"paracetamol","strength":"650mg"}]',
      strength: '650mg',
      form: 'tablet',
      manufacturer: 'Micro Labs Ltd',
    });
    expect(JSON.parse(String(byId['az-2']?.ingredients))).toEqual([
      { name: 'amoxycillin', strength: '500mg' },
      { name: 'clavulanic acid', strength: '125mg' },
    ]);
    expect(byId['az-2']?.strength).toBe('500mg + 125mg');
  });

  it('stores NA as a null strength, and a leading-point strength as written', () => {
    expect(
      JSON.parse(
        String(
          rows(opts.outDb, "SELECT ingredients FROM catalog WHERE id = 'az-9'")[0]?.ingredients,
        ),
      ),
    ).toEqual([{ name: 'adrenaline', strength: null }]);
    expect(rows(opts.outDb, "SELECT strength, form FROM catalog WHERE id = 'az-13'")).toEqual([
      { strength: '.75% w/w', form: 'cream' },
    ]);
  });

  it('keeps a bracketed qualifier in the ingredient name', () => {
    const row = rows(opts.outDb, "SELECT ingredients FROM catalog WHERE id = 'az-15'")[0];
    expect(JSON.parse(String(row?.ingredients))).toEqual([
      { name: 'vitamin b6 (pyridoxine)', strength: '3mg' },
    ]);
  });

  it('survives commas and quotes in source fields', () => {
    expect(rows(opts.outDb, "SELECT brand, manufacturer FROM catalog WHERE id = 'az-14'")).toEqual([
      { brand: 'Quoted, Comma Tablet', manufacturer: 'Nobody, Ltd' },
    ]);
  });

  it('writes rejects.csv with a reason for every dropped row, and drops nothing else', () => {
    expect(fs.existsSync(result.paths.rejects)).toBe(true);
    const rejects = readCsv(result.paths.rejects);
    expect(Object.keys(rejects[0] ?? {})).toEqual([
      'line',
      'id',
      'brand',
      'composition_1',
      'composition_2',
      'reason',
      'detail',
    ]);
    const reasonOf = (brand: string, line?: string): string | undefined =>
      rejects.find((r) => r.brand === brand && (line === undefined || r.line === line))?.reason;
    expect(reasonOf('Ascoril LS Syrup')).toBe('sources_disagree');
    expect(reasonOf('Unverified Combo Tablet')).toBe('two_ingredient_unverified');
    expect(reasonOf('', '5')).toBe('empty_brand');
    expect(reasonOf('Forte Tablet')).toBe('empty_brand');
    expect(reasonOf('No Ingredients Tablet')).toBe('empty_ingredients');
    expect(reasonOf('Dolo Duplicate Tablet')).toBe('duplicate_id');
    expect(reasonOf('Bad Strength Tablet')).toBe('unparseable_strength');
    expect(rejects).toHaveLength(7);
    expect(result.rejected).toBe(7);
    expect(result.rejectedByReason).toEqual({
      sources_disagree: 1,
      two_ingredient_unverified: 1,
      empty_brand: 2,
      empty_ingredients: 1,
      duplicate_id: 1,
      unparseable_strength: 1,
    });
    // Every source row is either in the catalogue or in rejects (nothing silently dropped).
    expect(result.rowCount + result.rejected + result.excludedOverCap).toBe(result.azRows);
  });

  it('explains a disagreement by showing both ingredient lists', () => {
    const row = readCsv(result.paths.rejects).find((r) => r.reason === 'sources_disagree');
    expect(row?.detail).toBe(
      'base file: ambroxol|levosalbutamol; other file: ambroxol|guaifenesin|levosalbutamol',
    );
  });

  it('writes an empty excluded.csv when everything fits under the cap', () => {
    expect(readCsv(result.paths.excluded)).toEqual([]);
    expect(result.excludedOverCap).toBe(0);
  });

  it('writes the verify sheet with the exact columns and one row per matching entry', () => {
    const sheet = readCsv(result.paths.verifySheet);
    expect(Object.keys(sheet[0] ?? {})).toEqual([
      'brand',
      'ingredients',
      'strength',
      'source_url',
      'verified_by',
      'verified_on',
      'ok',
    ]);
    expect(sheet).toEqual([
      {
        brand: 'Dolo 650 Tablet',
        ingredients: 'paracetamol',
        strength: '650mg',
        source_url: '',
        verified_by: '',
        verified_on: '',
        ok: '',
      },
      {
        brand: 'Augmentin 625 Duo Tablet',
        ingredients: 'amoxycillin + clavulanic acid',
        strength: '500mg + 125mg',
        source_url: '',
        verified_by: '',
        verified_on: '',
        ok: '',
      },
      {
        brand: 'Ascoril LS Syrup',
        ingredients: 'NOT IN CATALOGUE (rejected: sources_disagree)',
        strength: '',
        source_url: '',
        verified_by: '',
        verified_on: '',
        ok: '',
      },
      {
        brand: 'Unverified Combo',
        ingredients: 'NOT IN CATALOGUE (rejected: two_ingredient_unverified)',
        strength: '',
        source_url: '',
        verified_by: '',
        verified_on: '',
        ok: '',
      },
      {
        brand: 'Not In Dataset',
        ingredients: 'NOT IN CATALOGUE',
        strength: '',
        source_url: '',
        verified_by: '',
        verified_on: '',
        ok: '',
      },
    ]);
    expect(result.demoNotFound).toEqual(['Ascoril LS Syrup', 'Unverified Combo', 'Not In Dataset']);
  });

  it('warns about every unfinished item', () => {
    expect(result.warnings).toEqual([]);
  });

  it('reports the file size in MB', () => {
    expect(result.fileSizeMB).toBeGreaterThan(0);
    expect(result.fileSizeMB).toBeLessThan(1);
    expect(JSON.parse(fs.readFileSync(result.paths.report, 'utf8'))).toMatchObject({
      rowCount: 10,
      rejected: 7,
    });
  });
});

describe('the cap', () => {
  it('fills by priority: demo brands, then cross-checked rows, then the rest', async () => {
    const { opts, result } = await build({ maxRows: 3 });
    const ids = rows(opts.outDb, 'SELECT id FROM catalog ORDER BY rowid').map((r) => r.id);
    expect(ids).toEqual(['az-1', 'az-2', 'az-15']);
    expect(result.rowCount).toBe(3);
    expect(result.excludedOverCap).toBe(7);
    const excluded = readCsv(result.paths.excluded);
    expect(excluded).toHaveLength(7);
    expect(new Set(excluded.map((r) => r.reason))).toEqual(new Set(['over_cap']));
    expect(result.rowCount + result.rejected + result.excludedOverCap).toBe(result.azRows);
  });

  it('drops a discontinued product before an active one', async () => {
    const { result } = await build({ maxRows: 9 });
    const excluded = readCsv(result.paths.excluded);
    expect(excluded.map((r) => r.id)).toEqual(['az-10']);
    expect(excluded[0]?.discontinued).toBe('true');
  });

  it('never drops a demo brand, even at a cap of 1', async () => {
    const { opts } = await build({ maxRows: 1 });
    expect(rows(opts.outDb, 'SELECT id FROM catalog').map((r) => r.id)).toEqual(['az-1']);
  });

  it('puts a demo brand ahead of a cross-checked one', async () => {
    // Telma 40 (az-16) is NOT confirmed by another file; Dolo 650 (az-1) is. Demo comes first.
    const demo = path.join(tmp, 'demo-telma.txt');
    fs.writeFileSync(demo, 'Telma 40\n');
    const { opts, result } = await build({ maxRows: 1, demoBrandsPath: demo });
    expect(rows(opts.outDb, 'SELECT id FROM catalog').map((r) => r.id)).toEqual(['az-16']);
    expect(result.demoNotFound).toEqual([]);
  });
});

describe('two-ingredient policy', () => {
  it('"all" accepts an unverified two-ingredient row but still rejects a disagreement', async () => {
    const { opts, result } = await build({ twoIngredientPolicy: 'all' });
    expect(rows(opts.outDb, "SELECT id FROM catalog WHERE id = 'az-4'")).toHaveLength(1);
    expect(result.rejectedByReason.two_ingredient_unverified).toBeUndefined();
    expect(result.rejectedByReason.sources_disagree).toBe(1);
    expect(result.rowCount).toBe(11);
  });

  it('with no cross-check files, rejects every two-ingredient row and says so', async () => {
    const { opts, result } = await build({
      medicineDataPath: undefined,
      medicineDetailsPath: undefined,
    });
    expect(rows(opts.outDb, "SELECT id FROM catalog WHERE id IN ('az-2', 'az-4')")).toEqual([]);
    expect(result.rejectedByReason.two_ingredient_unverified).toBe(3);
    expect(result.warnings.join(' ')).toMatch(/No cross-check files/);
  });
});

describe('licence and reruns', () => {
  it('warns when the licence is UNCONFIRMED and still builds', async () => {
    const { result } = await build({ licence: 'UNCONFIRMED' });
    expect(result.warnings.join(' ')).toMatch(/Licence is UNCONFIRMED/);
    expect(result.rowCount).toBe(10);
  });

  it('overwrites an existing catalog.db and produces identical rows', async () => {
    const first = await build();
    const second = await buildCatalog(first.opts);
    expect(second.rowCount).toBe(first.result.rowCount);
    const dump = (file: string): Record<string, unknown>[] =>
      rows(file, 'SELECT * FROM catalog ORDER BY rowid');
    expect(dump(first.opts.outDb)).toEqual(dump(second.paths.db));
  });
});

describe('input errors', () => {
  it('names the missing columns', async () => {
    const bad = path.join(tmp, 'bad-header.csv');
    fs.writeFileSync(bad, 'id,name\n1,Dolo\n');
    await expect(buildCatalog(options({ azPath: bad }))).rejects.toThrow(
      /missing column\(s\): .*Is_discontinued/,
    );
  });

  it('refuses an empty base file', async () => {
    const empty = path.join(tmp, 'empty.csv');
    fs.writeFileSync(
      empty,
      'id,name,price(₹),Is_discontinued,manufacturer_name,type,pack_size_label,short_composition1,short_composition2\n',
    );
    await expect(buildCatalog(options({ azPath: empty }))).rejects.toThrow(/no data rows/);
  });

  it('tolerates a missing demo list, with a warning and an empty sheet', async () => {
    const { result } = await build({ demoBrandsPath: path.join(tmp, 'nope.txt') });
    expect(result.warnings.join(' ')).toMatch(/not found/);
    expect(readCsv(result.paths.verifySheet)).toEqual([]);
  });
});

describe('the app can read what the tool builds (contract with src/data/catalogRepo.ts)', () => {
  let opts: BuildOptions;
  beforeAll(async () => {
    ({ opts } = await build());
  });

  it('searches by prefix, gets by id and counts', async () => {
    const db = createTestDb(opts.outDb);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const repo = createCatalogRepo(db);
      const found = await repo.searchPrefix(['dolo'], 10);
      // Shortest normalised brand first: "dologel" (7) before "dolo 650" (8).
      expect(found.map((r) => r.brand)).toEqual(['Dologel', 'Dolo 650 Tablet']);
      expect(found.find((r) => r.id === 'az-1')).toEqual({
        id: 'az-1',
        brand: 'Dolo 650 Tablet',
        brandNorm: 'dolo 650',
        ingredients: [{ name: 'paracetamol', strength: '650mg' }],
        strength: '650mg',
        form: 'tablet',
        manufacturer: 'Micro Labs Ltd',
      });
      expect((await repo.searchPrefix(['dolo', '650'], 10)).map((r) => r.id)).toEqual(['az-1']);
      expect((await repo.getById('az-2'))?.ingredients).toHaveLength(2);
      expect(await repo.getById('az-3')).toBeNull();
      expect(await repo.count()).toBe(10);
      expect(await repo.ingredientClasses()).toEqual([]);
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
      db.close();
    }
  });

  it('accepts the app migrations on top of a copy, keeping the catalogue', async () => {
    const copy = path.join(tmp, 'copy-of-catalog.db');
    fs.copyFileSync(opts.outDb, copy);
    const db = createTestDb(copy);
    try {
      await initDatabase(db);
      const names = (
        (await db.getAllAsync<{ name: string }>(
          "SELECT name FROM sqlite_master WHERE type = 'table'",
        )) ?? []
      ).map((r) => r.name);
      expect(names).toEqual(
        expect.arrayContaining([
          'catalog',
          'catalog_fts',
          'my_medicines',
          'scan_cache',
          'settings',
        ]),
      );
      expect(await createCatalogRepo(db).count()).toBe(10);
      expect(await db.getFirstAsync('PRAGMA user_version')).toEqual({
        user_version: SCHEMA_VERSION,
      });
    } finally {
      db.close();
    }
  });
});

describe('command line', () => {
  let logSpy: jest.SpyInstance;
  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });
  afterEach(() => {
    logSpy.mockRestore();
  });

  const base = (dir: string): string[] => [
    '--az',
    AZ,
    '--medicine-data',
    MEDICINE_DATA,
    '--medicine-details',
    MEDICINE_DETAILS,
    '--demo',
    DEMO,
    '--out',
    path.join(dir, 'catalog.db'),
    '--out-dir',
    path.join(dir, 'build'),
    '--licence',
    'TEST-LICENCE',
  ];

  it('builds from flags and exits 0', async () => {
    const dir = path.join(tmp, 'cli-ok');
    expect(await main(base(dir))).toBe(0);
    expect(fs.existsSync(path.join(dir, 'catalog.db'))).toBe(true);
    expect(logSpy.mock.calls.flat().join('\n')).toMatch(/Wrote .*catalog\.db: 10 rows, [\d.]+ MB/);
  });

  it('rejects bad flag values with a clear message', async () => {
    await expect(main(['--two-ingredient', 'bogus'])).rejects.toThrow(/corroborated" or "all"/);
    await expect(main(['--max-rows', '30001'])).rejects.toThrow(/1 to 30000/);
    await expect(main(['--max-rows', 'abc'])).rejects.toThrow(/1 to 30000/);
    await expect(main(['--az'])).rejects.toThrow(/Missing value for --az/);
    await expect(main(['stray'])).rejects.toThrow(/Unexpected argument/);
  });

  it('explains where to put a missing base file', async () => {
    await expect(main(['--az', path.join(tmp, 'absent.csv')])).rejects.toThrow(
      /Base file not found.*docs\/phase-2\.1/,
    );
  });
});
