import { logDbError, tryParseJson, type Db } from '@/data/db';

export const SCAN_CACHE_MAX_ROWS = 200;

export interface ScanCacheEntry {
  imageHash: string;
  /** Parsed JSON. Its shape is NOT checked here: the scan service must validate it before use. */
  response: unknown;
  /** Epoch milliseconds. */
  createdAt: number;
}

export interface ScanCacheRepo {
  /** A miss, or a row with unreadable JSON, returns null (treated as a cache miss). */
  get(imageHash: string): Promise<ScanCacheEntry | null>;
  /** Stores (or replaces) a response, then prunes. Returns false if it cannot be serialised. */
  put(imageHash: string, response: unknown): Promise<boolean>;
  /** Keeps the newest maxRows rows (by insertion order). Returns how many were deleted. */
  prune(maxRows?: number): Promise<number>;
  clear(): Promise<void>;
  count(): Promise<number>;
}

export interface ScanCacheRepoOptions {
  now?: () => number;
}

interface ScanCacheRow {
  image_hash: string;
  response: string;
  created_at: number;
}

export function createScanCacheRepo(db: Db, options: ScanCacheRepoOptions = {}): ScanCacheRepo {
  const now = options.now ?? Date.now;

  const prune = async (maxRows: number = SCAN_CACHE_MAX_ROWS): Promise<number> => {
    const keep = Number.isFinite(maxRows) ? Math.max(0, Math.floor(maxRows)) : SCAN_CACHE_MAX_ROWS;
    // rowid order = insertion order (INSERT OR REPLACE gives a replaced row a new, higher rowid),
    // so a wrong phone clock can never make us delete the freshest entry.
    const result = await db.runAsync(
      'DELETE FROM scan_cache WHERE rowid NOT IN (SELECT rowid FROM scan_cache ORDER BY rowid DESC LIMIT ?)',
      keep,
    );
    return result.changes;
  };

  return {
    prune,

    get: async (imageHash) => {
      const row = await db.getFirstAsync<ScanCacheRow>(
        'SELECT image_hash, response, created_at FROM scan_cache WHERE image_hash = ?',
        imageHash,
      );
      if (row === null) {
        return null;
      }
      const parsed = tryParseJson(row.response);
      if (!parsed.ok) {
        logDbError('scan_cache_json_corrupt');
        return null;
      }
      return { imageHash: row.image_hash, response: parsed.value, createdAt: row.created_at };
    },

    put: async (imageHash, response) => {
      let text: string | undefined;
      try {
        text = JSON.stringify(response) as string | undefined;
      } catch {
        text = undefined;
      }
      if (typeof text !== 'string') {
        logDbError('scan_cache_unserialisable');
        return false;
      }
      const payload = text;
      await db.withTransactionAsync(async () => {
        await db.runAsync(
          'INSERT OR REPLACE INTO scan_cache (image_hash, response, created_at) VALUES (?, ?, ?)',
          imageHash,
          payload,
          now(),
        );
        await prune();
      });
      return true;
    },

    clear: async () => {
      await db.runAsync('DELETE FROM scan_cache');
    },

    count: async () => {
      const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM scan_cache');
      return row?.n ?? 0;
    },
  };
}
