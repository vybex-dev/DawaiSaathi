import { buildPrefixQuery, createCatalogRepo } from '@/data/catalogRepo';
import { createMigratedTestDb, seedCatalog, type TestDb } from './testDb';

let db: TestDb;
let errorSpy: jest.SpyInstance;

const para = '[{"name":"paracetamol","strength":"650 mg"}]';

beforeEach(async () => {
  db = await createMigratedTestDb();
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  errorSpy.mockRestore();
  db.close();
});

function seed(): void {
  seedCatalog(
    db,
    [
      {
        id: 'c1',
        brand: 'Dolo 650',
        brandNorm: 'dolo',
        ingredients: para,
        strength: '650 mg',
        form: 'tablet',
        manufacturer: 'Micro Labs',
      },
      { id: 'c2', brand: 'Dolopar', brandNorm: 'dolopar', ingredients: para },
      {
        id: 'c3',
        brand: 'Azithral',
        brandNorm: 'azithral',
        ingredients: '[{"name":"azithromycin","strength":"500 mg"}]',
      },
      {
        id: 'c4',
        brand: 'Pan D',
        brandNorm: 'pan d',
        ingredients:
          '[{"name":"pantoprazole","strength":null},{"name":"domperidone","strength":"30 mg"}]',
      },
      { id: 'c5', brand: 'Brokenol', brandNorm: 'brokenol', ingredients: 'not json' },
    ],
    [
      { ingredient: 'paracetamol', classCode: 'analgesic' },
      { ingredient: 'azithromycin', classCode: 'macrolide' },
    ],
  );
}

describe('buildPrefixQuery', () => {
  it('quotes each token and ANDs them', () => {
    expect(buildPrefixQuery(['dol', '650'])).toBe('"dol"* AND "650"*');
  });
  it('drops empty tokens, splits spaces and strips double quotes', () => {
    expect(buildPrefixQuery(['', '  ', 'pan d', 'a"b'])).toBe('"pan"* AND "d"* AND "a"* AND "b"*');
  });
  it('returns null when nothing is left', () => {
    expect(buildPrefixQuery([])).toBeNull();
    expect(buildPrefixQuery(['', '""'])).toBeNull();
  });
  it('caps the number of tokens', () => {
    expect(
      buildPrefixQuery(Array.from({ length: 20 }, (_, i) => `t${i}`))?.split(' AND '),
    ).toHaveLength(8);
  });
});

describe('catalogRepo with a catalogue', () => {
  beforeEach(seed);

  it('finds brands by prefix, best (shortest) match first', async () => {
    const found = await createCatalogRepo(db).searchPrefix(['dol'], 10);
    expect(found.map((r) => r.id)).toEqual(['c1', 'c2']);
    expect(found[0]).toEqual({
      id: 'c1',
      brand: 'Dolo 650',
      brandNorm: 'dolo',
      ingredients: [{ name: 'paracetamol', strength: '650 mg' }],
      strength: '650 mg',
      form: 'tablet',
      manufacturer: 'Micro Labs',
    });
  });

  it('is case-insensitive and supports a two-letter prefix', async () => {
    const found = await createCatalogRepo(db).searchPrefix(['DO'], 10);
    expect(found.map((r) => r.id)).toEqual(['c1', 'c2']);
  });

  it('requires every token to match', async () => {
    const repo = createCatalogRepo(db);
    expect((await repo.searchPrefix(['pan', 'd'], 10)).map((r) => r.id)).toEqual(['c4']);
    expect(await repo.searchPrefix(['pan', 'zzz'], 10)).toEqual([]);
  });

  it('keeps null ingredient strengths as null', async () => {
    const [pan] = await createCatalogRepo(db).searchPrefix(['pan'], 5);
    expect(pan?.ingredients).toEqual([
      { name: 'pantoprazole', strength: null },
      { name: 'domperidone', strength: '30 mg' },
    ]);
  });

  it('respects the limit', async () => {
    expect(await createCatalogRepo(db).searchPrefix(['dol'], 1)).toHaveLength(1);
  });

  it('returns [] for no usable tokens without querying', async () => {
    const repo = createCatalogRepo(db);
    expect(await repo.searchPrefix([], 5)).toEqual([]);
    expect(await repo.searchPrefix(['', ' '], 5)).toEqual([]);
  });

  it.each(['dolo"', 'OR', 'NOT', 'NEAR(', '*', 'a:b', '(dol)', "d'olo", '^dolo', '-dolo', 'dolo*'])(
    'does not throw on FTS-special token %s',
    async (token) => {
      const result = await createCatalogRepo(db).searchPrefix([token], 5);
      expect(Array.isArray(result)).toBe(true);
    },
  );

  it('does not throw on Devanagari input', async () => {
    expect(await createCatalogRepo(db).searchPrefix(['डोलो'], 5)).toEqual([]);
  });

  it('drops rows with unreadable ingredients and logs only a code', async () => {
    const repo = createCatalogRepo(db);
    expect(await repo.searchPrefix(['broken'], 5)).toEqual([]);
    expect(errorSpy).toHaveBeenCalledWith('db_error:catalog_json_corrupt');
    expect(await repo.getById('c5')).toBeNull();
  });

  it('gets one entry by id, or null', async () => {
    const repo = createCatalogRepo(db);
    expect((await repo.getById('c3'))?.brand).toBe('Azithral');
    expect(await repo.getById('missing')).toBeNull();
  });

  it('lists ingredient classes', async () => {
    expect(await createCatalogRepo(db).ingredientClasses()).toEqual([
      { ingredient: 'azithromycin', classCode: 'macrolide' },
      { ingredient: 'paracetamol', classCode: 'analgesic' },
    ]);
  });

  it('counts catalogue rows', async () => {
    expect(await createCatalogRepo(db).count()).toBe(5);
  });
});

describe('catalogRepo with the Phase 1 placeholder (no catalogue tables)', () => {
  it('returns empty results and logs a code instead of throwing', async () => {
    db.raw.exec('CREATE TABLE meta (key TEXT, value TEXT)');
    const repo = createCatalogRepo(db);
    expect(await repo.searchPrefix(['dolo'], 5)).toEqual([]);
    expect(await repo.getById('x')).toBeNull();
    expect(await repo.ingredientClasses()).toEqual([]);
    expect(await repo.count()).toBe(0);
    expect(errorSpy).toHaveBeenCalledWith('db_error:catalog_unavailable');
  });
});
