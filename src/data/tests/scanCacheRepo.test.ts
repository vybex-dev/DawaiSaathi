import { SCAN_CACHE_MAX_ROWS, createScanCacheRepo } from '@/data/scanCacheRepo';
import { createMigratedTestDb, type TestDb } from './testDb';

let db: TestDb;
let errorSpy: jest.SpyInstance;

beforeEach(async () => {
  db = await createMigratedTestDb();
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  errorSpy.mockRestore();
  db.close();
});

describe('scanCacheRepo', () => {
  it('returns null on a miss', async () => {
    expect(await createScanCacheRepo(db).get('nope')).toBeNull();
  });

  it('round-trips nested JSON by hash', async () => {
    const repo = createScanCacheRepo(db, { now: () => 42 });
    const response = {
      medicines: [{ brand_text: 'Dolo', confidence: 0.9, nulls: null }],
      n: [1, 2],
    };
    expect(await repo.put('h1', response)).toBe(true);
    expect(await repo.get('h1')).toEqual({ imageHash: 'h1', response, createdAt: 42 });
  });

  it('replaces an existing hash instead of adding a second row', async () => {
    const repo = createScanCacheRepo(db);
    await repo.put('h1', { v: 1 });
    await repo.put('h1', { v: 2 });
    expect(await repo.count()).toBe(1);
    expect((await repo.get('h1'))?.response).toEqual({ v: 2 });
  });

  it('prunes to 200 rows, keeping the newest', async () => {
    const repo = createScanCacheRepo(db);
    for (let i = 1; i <= SCAN_CACHE_MAX_ROWS + 5; i += 1) {
      await repo.put(`h${i}`, { i });
    }
    expect(await repo.count()).toBe(SCAN_CACHE_MAX_ROWS);
    expect(await repo.get('h1')).toBeNull();
    expect(await repo.get('h5')).toBeNull();
    expect(await repo.get('h6')).not.toBeNull();
    expect(await repo.get(`h${SCAN_CACHE_MAX_ROWS + 5}`)).not.toBeNull();
  });

  it('keeps the freshest row even if the phone clock goes backwards', async () => {
    let t = 1_000_000;
    const repo = createScanCacheRepo(db, { now: () => (t -= 1000) });
    for (let i = 1; i <= SCAN_CACHE_MAX_ROWS + 1; i += 1) {
      await repo.put(`h${i}`, { i });
    }
    expect(await repo.get(`h${SCAN_CACHE_MAX_ROWS + 1}`)).not.toBeNull();
    expect(await repo.get('h1')).toBeNull();
  });

  it('prune(n) keeps n rows and reports how many it deleted', async () => {
    const repo = createScanCacheRepo(db);
    for (let i = 1; i <= 6; i += 1) {
      await repo.put(`h${i}`, i);
    }
    expect(await repo.prune(2)).toBe(4);
    expect(await repo.count()).toBe(2);
    expect(await repo.get('h6')).not.toBeNull();
  });

  it('treats unreadable JSON as a miss and logs only a code', async () => {
    db.raw
      .prepare('INSERT INTO scan_cache (image_hash, response, created_at) VALUES (?, ?, ?)')
      .run('bad', '{SECRETMEDICINE', 1);
    expect(await createScanCacheRepo(db).get('bad')).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith('db_error:scan_cache_json_corrupt');
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain('SECRETMEDICINE');
  });

  it('refuses values that cannot be serialised, without throwing', async () => {
    const repo = createScanCacheRepo(db);
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(await repo.put('c', circular)).toBe(false);
    expect(await repo.put('u', undefined)).toBe(false);
    expect(await repo.count()).toBe(0);
    expect(errorSpy).toHaveBeenCalledWith('db_error:scan_cache_unserialisable');
  });

  it('clears everything', async () => {
    const repo = createScanCacheRepo(db);
    await repo.put('a', 1);
    await repo.clear();
    expect(await repo.count()).toBe(0);
  });
});
