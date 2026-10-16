import { parse } from 'csv-parse';
import fs from 'node:fs';
import { nameSignature, splitCompositionString } from './catalog-parse';
import { productKey } from './normalize-build';

/** The base file: "A-Z Medicine Dataset of India" (Kaggle). One row per product. */
export interface AzRow {
  /** 1-based data row number, for reject reports. */
  line: number;
  id: string;
  name: string;
  discontinued: boolean;
  manufacturer: string;
  packLabel: string;
  composition1: string;
  composition2: string;
}

const AZ_COLUMNS = {
  id: 'id',
  name: 'name',
  discontinued: 'Is_discontinued',
  manufacturer: 'manufacturer_name',
  packLabel: 'pack_size_label',
  composition1: 'short_composition1',
  composition2: 'short_composition2',
} as const;

function openCsv(path: string): ReturnType<typeof parse> {
  return fs.createReadStream(path).pipe(
    parse({
      columns: true,
      bom: true,
      skip_empty_lines: true,
      relax_column_count: true,
      relax_quotes: true,
    }),
  );
}

function requireColumns(
  record: Record<string, unknown>,
  columns: readonly string[],
  file: string,
): void {
  const missing = columns.filter((c) => !(c in record));
  if (missing.length > 0) {
    throw new Error(
      `${file} is missing column(s): ${missing.join(', ')}. Found: ${Object.keys(record).join(', ')}`,
    );
  }
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export async function readAzRows(path: string): Promise<AzRow[]> {
  const rows: AzRow[] = [];
  let line = 0;
  let checked = false;
  for await (const record of openCsv(path) as AsyncIterable<Record<string, unknown>>) {
    line += 1;
    if (!checked) {
      requireColumns(record, Object.values(AZ_COLUMNS), path);
      checked = true;
    }
    rows.push({
      line,
      id: text(record[AZ_COLUMNS.id]).trim(),
      name: text(record[AZ_COLUMNS.name]),
      discontinued: text(record[AZ_COLUMNS.discontinued]).trim().toLowerCase() === 'true',
      manufacturer: text(record[AZ_COLUMNS.manufacturer]).replace(/\s+/g, ' ').trim(),
      packLabel: text(record[AZ_COLUMNS.packLabel]),
      composition1: text(record[AZ_COLUMNS.composition1]),
      composition2: text(record[AZ_COLUMNS.composition2]),
    });
  }
  if (!checked) {
    throw new Error(`${path} has no data rows`);
  }
  return rows;
}

/**
 * Why a cross-check exists: the base file has only two composition columns, so a product with
 * three or more ingredients is silently cut to two. The two other files list the full
 * composition. For each product name we keep every ingredient-name signature they give.
 */
export type CrossCheck = Map<string, Set<string>>;

interface CrossCheckSource {
  path: string;
  nameColumn: string;
  compositionColumn: string;
}

export async function readCrossCheck(sources: readonly CrossCheckSource[]): Promise<CrossCheck> {
  const map: CrossCheck = new Map();
  for (const source of sources) {
    let checked = false;
    for await (const record of openCsv(source.path) as AsyncIterable<Record<string, unknown>>) {
      if (!checked) {
        requireColumns(record, [source.nameColumn, source.compositionColumn], source.path);
        checked = true;
      }
      const name = text(record[source.nameColumn]);
      const composition = text(record[source.compositionColumn]);
      if (name.trim() === '' || composition.trim() === '') {
        continue;
      }
      const key = productKey(name);
      const signature = nameSignature(splitCompositionString(composition));
      if (signature === '') {
        continue;
      }
      const existing = map.get(key);
      if (existing) {
        existing.add(signature);
      } else {
        map.set(key, new Set([signature]));
      }
    }
  }
  return map;
}

export const MEDICINE_DATA_SOURCE = {
  nameColumn: 'product_name',
  compositionColumn: 'salt_composition',
} as const;

export const MEDICINE_DETAILS_SOURCE = {
  nameColumn: 'Medicine Name',
  compositionColumn: 'Composition',
} as const;
