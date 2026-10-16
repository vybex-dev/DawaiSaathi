import { logDbError, parseIngredients, type Db, type Ingredient } from '@/data/db';

export interface MedicineRecord {
  id: string;
  brand: string;
  ingredients: Ingredient[];
  strength: string | null;
  form: string | null;
  catalogId: string | null;
  /** 0 to 1. */
  confidence: number;
  confirmed: boolean;
  /** Epoch milliseconds. */
  createdAt: number;
}

export interface NewMedicine {
  /** Optional. Generated when omitted. */
  id?: string;
  brand: string;
  ingredients: readonly Ingredient[];
  strength?: string | null;
  form?: string | null;
  catalogId?: string | null;
  confidence: number;
  /** Defaults to false: nothing is checked until the person confirms it. */
  confirmed?: boolean;
}

export type MedicineUpdate = Partial<Omit<MedicineRecord, 'id' | 'createdAt'>>;

export interface MedicinesRepo {
  add(input: NewMedicine): Promise<MedicineRecord>;
  /** Returns the updated record, or null when the id does not exist. */
  update(id: string, patch: MedicineUpdate): Promise<MedicineRecord | null>;
  /** Returns false when the id does not exist. */
  confirm(id: string, confirmed?: boolean): Promise<boolean>;
  /** Returns false when the id does not exist. */
  remove(id: string): Promise<boolean>;
  /** Newest first. */
  list(): Promise<MedicineRecord[]>;
  get(id: string): Promise<MedicineRecord | null>;
  clear(): Promise<void>;
  count(): Promise<number>;
}

export interface MedicinesRepoOptions {
  now?: () => number;
  newId?: () => string;
}

interface MedicineRow {
  id: string;
  brand: string;
  ingredients: string;
  strength: string | null;
  form: string | null;
  catalog_id: string | null;
  confidence: number;
  confirmed: number;
  created_at: number;
}

const COLUMNS =
  'id, brand, ingredients, strength, form, catalog_id, confidence, confirmed, created_at';

/**
 * Local ids only need to be unique on one phone. UUID v4 shaped so they can be sent to the
 * server's uuid column later without conversion.
 */
export function generateId(): string {
  const bytes = new Uint8Array(16);
  const webCrypto = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } })
    .crypto;
  if (webCrypto?.getRandomValues) {
    webCrypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

/**
 * A row whose ingredients JSON is unreadable is NOT hidden (that would make a check look more
 * complete than it is) and NOT trusted: it comes back with no ingredients and confirmed false,
 * so the UI shows "Not checked" and the engine excludes it. Only a code is logged.
 */
function rowToRecord(row: MedicineRow): MedicineRecord {
  const parsed = parseIngredients(row.ingredients);
  if (parsed === null) {
    logDbError('medicine_json_corrupt');
  }
  return {
    id: row.id,
    brand: row.brand,
    ingredients: parsed ?? [],
    strength: row.strength,
    form: row.form,
    catalogId: row.catalog_id,
    confidence: row.confidence,
    confirmed: parsed === null ? false : row.confirmed === 1,
    createdAt: row.created_at,
  };
}

function serialiseIngredients(ingredients: readonly Ingredient[]): string {
  return JSON.stringify(ingredients.map((i) => ({ name: i.name, strength: i.strength ?? null })));
}

export function createMedicinesRepo(db: Db, options: MedicinesRepoOptions = {}): MedicinesRepo {
  const now = options.now ?? Date.now;
  const newId = options.newId ?? generateId;

  const get = async (id: string): Promise<MedicineRecord | null> => {
    const row = await db.getFirstAsync<MedicineRow>(
      `SELECT ${COLUMNS} FROM my_medicines WHERE id = ?`,
      id,
    );
    return row === null ? null : rowToRecord(row);
  };

  return {
    get,

    add: async (input) => {
      const brand = input.brand.trim();
      if (brand === '') {
        throw new Error('medicine_brand_required');
      }
      const id = input.id ?? newId();
      const createdAt = now();
      await db.runAsync(
        `INSERT INTO my_medicines (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        brand,
        serialiseIngredients(input.ingredients),
        input.strength ?? null,
        input.form ?? null,
        input.catalogId ?? null,
        clampConfidence(input.confidence),
        input.confirmed === true ? 1 : 0,
        createdAt,
      );
      return {
        id,
        brand,
        ingredients: input.ingredients.map((i) => ({ name: i.name, strength: i.strength ?? null })),
        strength: input.strength ?? null,
        form: input.form ?? null,
        catalogId: input.catalogId ?? null,
        confidence: clampConfidence(input.confidence),
        confirmed: input.confirmed === true,
        createdAt,
      };
    },

    update: async (id, patch) => {
      const sets: string[] = [];
      const params: (string | number | null)[] = [];
      if (patch.brand !== undefined) {
        const brand = patch.brand.trim();
        if (brand === '') {
          throw new Error('medicine_brand_required');
        }
        sets.push('brand = ?');
        params.push(brand);
      }
      if (patch.ingredients !== undefined) {
        sets.push('ingredients = ?');
        params.push(serialiseIngredients(patch.ingredients));
      }
      if (patch.strength !== undefined) {
        sets.push('strength = ?');
        params.push(patch.strength);
      }
      if (patch.form !== undefined) {
        sets.push('form = ?');
        params.push(patch.form);
      }
      if (patch.catalogId !== undefined) {
        sets.push('catalog_id = ?');
        params.push(patch.catalogId);
      }
      if (patch.confidence !== undefined) {
        sets.push('confidence = ?');
        params.push(clampConfidence(patch.confidence));
      }
      if (patch.confirmed !== undefined) {
        sets.push('confirmed = ?');
        params.push(patch.confirmed ? 1 : 0);
      }
      if (sets.length === 0) {
        return get(id);
      }
      const result = await db.runAsync(
        `UPDATE my_medicines SET ${sets.join(', ')} WHERE id = ?`,
        ...params,
        id,
      );
      return result.changes > 0 ? get(id) : null;
    },

    confirm: async (id, confirmed = true) => {
      const result = await db.runAsync(
        'UPDATE my_medicines SET confirmed = ? WHERE id = ?',
        confirmed ? 1 : 0,
        id,
      );
      return result.changes > 0;
    },

    remove: async (id) => {
      const result = await db.runAsync('DELETE FROM my_medicines WHERE id = ?', id);
      return result.changes > 0;
    },

    list: async () => {
      const rows = await db.getAllAsync<MedicineRow>(
        `SELECT ${COLUMNS} FROM my_medicines ORDER BY created_at DESC, rowid DESC`,
      );
      return rows.map(rowToRecord);
    },

    clear: async () => {
      await db.runAsync('DELETE FROM my_medicines');
    },

    count: async () => {
      const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM my_medicines');
      return row?.n ?? 0;
    },
  };
}
