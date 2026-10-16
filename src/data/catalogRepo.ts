import { logDbError, parseIngredients, type Db, type Ingredient } from '@/data/db';

/**
 * Read-only access to the bundled catalogue (assets/catalog.db, copied into dawai.db on first
 * run). CONTRACT with tools/build-catalog.ts (Prompt 2.1):
 *   catalog(id TEXT PRIMARY KEY, brand, brand_norm, ingredients, strength, form, manufacturer)
 *   catalog_fts = FTS5 over brand_norm, external content with
 *     content='catalog', content_rowid='rowid', prefix='2 3'
 *     (so catalog_fts.rowid = catalog.rowid; run INSERT INTO catalog_fts(catalog_fts)
 *     VALUES('rebuild') after loading the rows)
 *   ingredient_class(ingredient, class_code)
 * Until Phase 2 replaces the placeholder file, these tables do not exist. Every method then
 * returns an empty result (and logs catalog_unavailable) instead of throwing.
 */

export interface CatalogRecord {
  id: string;
  brand: string;
  brandNorm: string;
  ingredients: Ingredient[];
  strength: string | null;
  form: string | null;
  manufacturer: string | null;
}

export interface IngredientClassRow {
  ingredient: string;
  classCode: string;
}

export interface CatalogRepo {
  /**
   * Brands that have, for EVERY given token, a word starting with that token. The word can be
   * anywhere in the name: "dolo" finds "dolo 650" and also "xyz dolo". Tokens must already be
   * normalised by the caller. Shortest names first. Never throws.
   */
  searchPrefix(tokens: readonly string[], limit: number): Promise<CatalogRecord[]>;
  getById(id: string): Promise<CatalogRecord | null>;
  ingredientClasses(): Promise<IngredientClassRow[]>;
  count(): Promise<number>;
}

interface CatalogRow {
  id: string;
  brand: string;
  brand_norm: string;
  ingredients: string;
  strength: string | null;
  form: string | null;
  manufacturer: string | null;
}

const COLUMNS = 'c.id, c.brand, c.brand_norm, c.ingredients, c.strength, c.form, c.manufacturer';
const MAX_TOKENS = 8;
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 10;

/** Rows with unreadable ingredients are dropped: no match is the safe direction. */
function toRecords(rows: readonly CatalogRow[]): CatalogRecord[] {
  const records: CatalogRecord[] = [];
  let dropped = false;
  for (const row of rows) {
    const ingredients = parseIngredients(row.ingredients);
    if (ingredients === null) {
      dropped = true;
      continue;
    }
    records.push({
      id: row.id,
      brand: row.brand,
      brandNorm: row.brand_norm,
      ingredients,
      strength: row.strength,
      form: row.form,
      manufacturer: row.manufacturer,
    });
  }
  if (dropped) {
    logDbError('catalog_json_corrupt');
  }
  return records;
}

/**
 * Builds an FTS5 query such as  "dol"* AND "650"*.
 * Each token is wrapped in double quotes so FTS operators (OR, NOT, NEAR, *, :, parentheses)
 * typed or OCR'd into a token are treated as plain text. Double quotes are removed.
 */
export function buildPrefixQuery(tokens: readonly string[]): string | null {
  const parts: string[] = [];
  for (const raw of tokens) {
    for (const piece of raw.replace(/"/g, ' ').split(/\s+/)) {
      if (piece !== '' && parts.length < MAX_TOKENS) {
        parts.push(`"${piece}"*`);
      }
    }
  }
  return parts.length === 0 ? null : parts.join(' AND ');
}

export function createCatalogRepo(db: Db): CatalogRepo {
  return {
    searchPrefix: async (tokens, limit) => {
      const query = buildPrefixQuery(tokens);
      if (query === null) {
        return [];
      }
      const safeLimit = Number.isFinite(limit)
        ? Math.min(MAX_LIMIT, Math.max(1, Math.floor(limit)))
        : DEFAULT_LIMIT;
      try {
        const rows = await db.getAllAsync<CatalogRow>(
          `SELECT ${COLUMNS}
           FROM catalog_fts
           JOIN catalog AS c ON c.rowid = catalog_fts.rowid
           WHERE catalog_fts MATCH ?
           ORDER BY bm25(catalog_fts), length(c.brand_norm), c.brand_norm
           LIMIT ?`,
          query,
          safeLimit,
        );
        return toRecords(rows);
      } catch {
        logDbError('catalog_unavailable');
        return [];
      }
    },

    getById: async (id) => {
      try {
        const row = await db.getFirstAsync<CatalogRow>(
          `SELECT ${COLUMNS} FROM catalog AS c WHERE c.id = ?`,
          id,
        );
        if (row === null) {
          return null;
        }
        return toRecords([row])[0] ?? null;
      } catch {
        logDbError('catalog_unavailable');
        return null;
      }
    },

    ingredientClasses: async () => {
      try {
        const rows = await db.getAllAsync<{ ingredient: string; class_code: string }>(
          'SELECT ingredient, class_code FROM ingredient_class ORDER BY ingredient, class_code',
        );
        return rows.map((r) => ({ ingredient: r.ingredient, classCode: r.class_code }));
      } catch {
        logDbError('catalog_unavailable');
        return [];
      }
    },

    count: async () => {
      try {
        const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM catalog');
        return row?.n ?? 0;
      } catch {
        logDbError('catalog_unavailable');
        return 0;
      }
    },
  };
}
