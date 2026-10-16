import { createMedicinesRepo, generateId } from '@/data/medicinesRepo';
import { createMigratedTestDb, type TestDb } from './testDb';

let db: TestDb;
let errorSpy: jest.SpyInstance;
let clock: number;

beforeEach(async () => {
  db = await createMigratedTestDb();
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  clock = 1_000;
});
afterEach(() => {
  errorSpy.mockRestore();
  db.close();
});

function repo(): ReturnType<typeof createMedicinesRepo> {
  let n = 0;
  return createMedicinesRepo(db, {
    now: () => (clock += 1),
    newId: () => `id-${(n += 1)}`,
  });
}

const paracetamol = [{ name: 'paracetamol', strength: '500 mg' }];

describe('medicinesRepo', () => {
  it('adds a medicine and reads it back unchanged', async () => {
    const r = repo();
    const added = await r.add({
      brand: 'Dev Brand',
      ingredients: paracetamol,
      strength: '500 mg',
      form: 'tablet',
      catalogId: 'cat-1',
      confidence: 0.9,
      confirmed: true,
    });
    expect(await r.get(added.id)).toEqual(added);
    expect(added).toEqual({
      id: 'id-1',
      brand: 'Dev Brand',
      ingredients: paracetamol,
      strength: '500 mg',
      form: 'tablet',
      catalogId: 'cat-1',
      confidence: 0.9,
      confirmed: true,
      createdAt: 1_001,
    });
  });

  it('defaults to unconfirmed, null optionals and null strengths', async () => {
    const r = repo();
    const added = await r.add({
      brand: 'B',
      ingredients: [{ name: 'x', strength: null }],
      confidence: 0.5,
    });
    expect(added.confirmed).toBe(false);
    expect(added.strength).toBeNull();
    expect(added.form).toBeNull();
    expect(added.catalogId).toBeNull();
    expect((await r.get(added.id))?.ingredients).toEqual([{ name: 'x', strength: null }]);
  });

  it('clamps confidence into 0..1 and treats NaN as 0', async () => {
    const r = repo();
    const high = await r.add({ brand: 'a', ingredients: [], confidence: 7 });
    const low = await r.add({ brand: 'b', ingredients: [], confidence: -3 });
    const nan = await r.add({ brand: 'c', ingredients: [], confidence: Number.NaN });
    expect([high.confidence, low.confidence, nan.confidence]).toEqual([1, 0, 0]);
    expect((await r.get(high.id))?.confidence).toBe(1);
  });

  it('refuses an empty brand', async () => {
    await expect(repo().add({ brand: '   ', ingredients: [], confidence: 1 })).rejects.toThrow(
      'medicine_brand_required',
    );
  });

  it('lists newest first', async () => {
    const r = repo();
    await r.add({ brand: 'first', ingredients: [], confidence: 1 });
    await r.add({ brand: 'second', ingredients: [], confidence: 1 });
    await r.add({ brand: 'third', ingredients: [], confidence: 1 });
    expect((await r.list()).map((m) => m.brand)).toEqual(['third', 'second', 'first']);
  });

  it('confirms and unconfirms, reporting unknown ids', async () => {
    const r = repo();
    const { id } = await r.add({ brand: 'a', ingredients: paracetamol, confidence: 1 });
    expect(await r.confirm(id)).toBe(true);
    expect((await r.get(id))?.confirmed).toBe(true);
    expect(await r.confirm(id, false)).toBe(true);
    expect((await r.get(id))?.confirmed).toBe(false);
    expect(await r.confirm('nope')).toBe(false);
  });

  it('updates only the fields given', async () => {
    const r = repo();
    const { id } = await r.add({
      brand: 'Old',
      ingredients: paracetamol,
      form: 'tablet',
      confidence: 0.4,
    });
    const updated = await r.update(id, {
      brand: ' New ',
      ingredients: [{ name: 'ibuprofen', strength: '400 mg' }],
      confirmed: true,
    });
    expect(updated).toMatchObject({
      brand: 'New',
      ingredients: [{ name: 'ibuprofen', strength: '400 mg' }],
      form: 'tablet',
      confidence: 0.4,
      confirmed: true,
    });
    expect(await r.update(id, { form: null })).toMatchObject({ form: null });
  });

  it('update with no fields returns the record; unknown id returns null', async () => {
    const r = repo();
    const { id } = await r.add({ brand: 'a', ingredients: [], confidence: 1 });
    expect((await r.update(id, {}))?.id).toBe(id);
    expect(await r.update('nope', { brand: 'x' })).toBeNull();
    expect(await r.update('nope', {})).toBeNull();
  });

  it('removes one medicine and reports unknown ids', async () => {
    const r = repo();
    const a = await r.add({ brand: 'a', ingredients: [], confidence: 1 });
    await r.add({ brand: 'b', ingredients: [], confidence: 1 });
    expect(await r.remove(a.id)).toBe(true);
    expect(await r.remove(a.id)).toBe(false);
    expect(await r.count()).toBe(1);
  });

  it('clears everything', async () => {
    const r = repo();
    await r.add({ brand: 'a', ingredients: [], confidence: 1 });
    await r.add({ brand: 'b', ingredients: [], confidence: 1 });
    await r.clear();
    expect(await r.list()).toEqual([]);
    expect(await r.count()).toBe(0);
  });

  it('returns null for a missing id', async () => {
    expect(await repo().get('missing')).toBeNull();
  });

  describe('corrupt ingredients JSON', () => {
    const bad = ['not json at all SECRETBRAND', '{"name":"SECRETBRAND"}', '[{"name":5}]', '[1,2]'];

    it.each(bad)(
      'is returned as unconfirmed with no ingredients, never thrown (%s)',
      async (text) => {
        db.raw
          .prepare(
            'INSERT INTO my_medicines (id, brand, ingredients, confidence, confirmed, created_at) VALUES (?, ?, ?, ?, ?, ?)',
          )
          .run('bad-1', 'SECRETBRAND', text, 0.9, 1, 5);
        const r = repo();
        const fromGet = await r.get('bad-1');
        expect(fromGet).toMatchObject({ id: 'bad-1', ingredients: [], confirmed: false });
        expect((await r.list()).map((m) => m.confirmed)).toEqual([false]);
        expect(errorSpy).toHaveBeenCalledWith('db_error:medicine_json_corrupt');
      },
    );

    it('logs only a code, never medicine content', async () => {
      db.raw
        .prepare(
          'INSERT INTO my_medicines (id, brand, ingredients, confidence, confirmed, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .run('bad-2', 'SECRETBRAND', 'garbage SECRETBRAND', 0.9, 1, 5);
      await repo().list();
      const logged = JSON.stringify(errorSpy.mock.calls);
      expect(logged).not.toContain('SECRETBRAND');
    });
  });
});

describe('generateId', () => {
  it('returns unique UUID-shaped ids', () => {
    const ids = new Set(Array.from({ length: 500 }, () => generateId()));
    expect(ids.size).toBe(500);
    for (const id of ids) {
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    }
  });
});
