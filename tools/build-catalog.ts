/**
 * npm run build:catalog
 *
 * Turns the source CSVs into assets/catalog.db (the SQLite file bundled with the app) and writes
 * the hand-check files to build/. Run it on your laptop; nothing here needs the network.
 *
 * Inputs (put them in data/source/, which git ignores):
 *   A_Z_medicines_dataset_of_India.csv   base file, required
 *   medicine_data.csv                    cross-check, optional but strongly recommended
 *   Medicine_Details.csv                 cross-check, optional but strongly recommended
 *
 * Why the cross-check files matter: the base file has only two composition columns, so any
 * product with three or more ingredients is cut to two with no marker. Measured on the files
 * supplied, about 1 in 4 two-ingredient rows that could be checked were really 3 to 9
 * ingredient products. Missing an ingredient would make an interaction check look safer than
 * it is, so a two-ingredient row is only accepted when every other file agrees with it
 * (--two-ingredient corroborated, the default).
 *
 * Nothing is silently fixed. Every dropped row lands in build/rejects.csv (bad or doubtful data)
 * or build/excluded.csv (good data that did not fit under the row cap), with a reason.
 */
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  deriveForm,
  joinStrengths,
  nameSignature,
  parseIngredient,
  type Ingredient,
} from './catalog-parse';
import {
  MEDICINE_DATA_SOURCE,
  MEDICINE_DETAILS_SOURCE,
  readAzRows,
  readCrossCheck,
  type CrossCheck,
} from './catalog-sources';
import { normalizeBrand, productKey } from './normalize-build';

export const CATALOG_SCHEMA_VERSION = '1';
export const DEFAULT_MAX_ROWS = 30_000;
export const SIZE_WARNING_MB = 15;

export type RejectReason =
  | 'missing_id'
  | 'duplicate_id'
  | 'empty_brand'
  | 'empty_ingredients'
  | 'unparseable_strength'
  | 'sources_disagree'
  | 'two_ingredient_unverified';

export type TwoIngredientPolicy = 'corroborated' | 'all';

export interface BuildOptions {
  azPath: string;
  medicineDataPath?: string;
  medicineDetailsPath?: string;
  demoBrandsPath: string;
  outDb: string;
  outDir: string;
  maxRows: number;
  twoIngredientPolicy: TwoIngredientPolicy;
  source: string;
  licence: string;
  now?: () => Date;
  log?: (line: string) => void;
}

export interface BuildResult {
  rowCount: number;
  fileSizeMB: number;
  azRows: number;
  rejected: number;
  rejectedByReason: Partial<Record<RejectReason, number>>;
  excludedOverCap: number;
  corroboratedRows: number;
  demoLines: number;
  demoNotFound: string[];
  warnings: string[];
  paths: { db: string; rejects: string; excluded: string; verifySheet: string; report: string };
}

interface Candidate {
  id: string;
  brand: string;
  brandNorm: string;
  ingredients: Ingredient[];
  strength: string | null;
  form: string | null;
  manufacturer: string;
  discontinued: boolean;
  corroborated: boolean;
  demo: boolean;
  order: number;
}

// ---------------------------------------------------------------------------------------------
// CSV output
// ---------------------------------------------------------------------------------------------

function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function csvText(header: readonly string[], rows: readonly (readonly string[])[]): string {
  const lines = [header, ...rows].map((fields) => fields.map(csvField).join(','));
  return `${lines.join('\n')}\n`;
}

// ---------------------------------------------------------------------------------------------
// Demo brands
// ---------------------------------------------------------------------------------------------

function readDemoBrands(file: string, warnings: string[]): string[] {
  if (!fs.existsSync(file)) {
    warnings.push(`${file} not found: verify-sheet.csv will be empty.`);
    return [];
  }
  return fs
    .readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'));
}

// ---------------------------------------------------------------------------------------------
// Cross-check
// ---------------------------------------------------------------------------------------------

type CrossStatus =
  { status: 'corroborated' } | { status: 'none' } | { status: 'disagree'; other: string };

/** Every other file that lists this product must give the same ingredient names. */
function crossStatus(cross: CrossCheck, key: string, signature: string): CrossStatus {
  const signatures = cross.get(key);
  if (!signatures) {
    return { status: 'none' };
  }
  for (const other of signatures) {
    if (other !== signature) {
      return { status: 'disagree', other };
    }
  }
  return { status: 'corroborated' };
}

// ---------------------------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------------------------

function removeIfExists(file: string): void {
  for (const suffix of ['', '-wal', '-shm', '-journal']) {
    fs.rmSync(`${file}${suffix}`, { force: true });
  }
}

/**
 * The layout src/data/catalogRepo.ts reads (see its header comment). PRAGMA user_version is left
 * at 0 on purpose: the app's migrations use it, and this file becomes part of dawai.db.
 */
function writeDatabase(
  file: string,
  rows: readonly Candidate[],
  meta: Record<string, string>,
): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  removeIfExists(file);
  const db = new DatabaseSync(file);
  try {
    db.exec(`
      PRAGMA journal_mode = DELETE;
      CREATE TABLE catalog (
        id TEXT PRIMARY KEY,
        brand TEXT NOT NULL,
        brand_norm TEXT NOT NULL,
        ingredients TEXT NOT NULL,
        strength TEXT,
        form TEXT,
        manufacturer TEXT
      );
      CREATE VIRTUAL TABLE catalog_fts USING fts5(
        brand_norm, content='catalog', content_rowid='rowid', prefix='2 3'
      );
      CREATE TABLE ingredient_class (
        ingredient TEXT NOT NULL,
        class_code TEXT NOT NULL,
        PRIMARY KEY (ingredient, class_code)
      );
      CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    `);
    const insert = db.prepare(
      'INSERT INTO catalog (id, brand, brand_norm, ingredients, strength, form, manufacturer) VALUES (?, ?, ?, ?, ?, ?, ?)',
    );
    db.exec('BEGIN');
    for (const row of rows) {
      insert.run(
        row.id,
        row.brand,
        row.brandNorm,
        JSON.stringify(row.ingredients),
        row.strength,
        row.form,
        row.manufacturer === '' ? null : row.manufacturer,
      );
    }
    const insertMeta = db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)');
    for (const [key, value] of Object.entries(meta)) {
      insertMeta.run(key, value);
    }
    db.exec('COMMIT');
    db.exec("INSERT INTO catalog_fts(catalog_fts) VALUES('rebuild')");
    db.exec("INSERT INTO catalog_fts(catalog_fts, rank) VALUES('integrity-check', 1)");
    db.exec("INSERT INTO catalog_fts(catalog_fts) VALUES('optimize')");
    db.exec('VACUUM');
  } finally {
    db.close();
  }
}

// ---------------------------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------------------------

export async function buildCatalog(options: BuildOptions): Promise<BuildResult> {
  const log = options.log ?? (() => undefined);
  const now = options.now ?? (() => new Date());
  const warnings: string[] = [];
  const warn = (message: string): void => {
    warnings.push(message);
    log(`WARNING: ${message}`);
  };

  const demoLines = readDemoBrands(options.demoBrandsPath, warnings);
  const demoNorms = new Set(demoLines.map(normalizeBrand).filter((n) => n !== ''));

  log(`Reading ${options.azPath} ...`);
  const azRows = await readAzRows(options.azPath);

  const crossSources = [
    options.medicineDataPath ? { path: options.medicineDataPath, ...MEDICINE_DATA_SOURCE } : null,
    options.medicineDetailsPath
      ? { path: options.medicineDetailsPath, ...MEDICINE_DETAILS_SOURCE }
      : null,
  ].filter((s): s is NonNullable<typeof s> => s !== null);
  if (crossSources.length === 0) {
    warn(
      'No cross-check files given. Two-ingredient products cannot be verified, so under the default policy every one of them will be rejected.',
    );
  }
  log(`Reading ${crossSources.length} cross-check file(s) ...`);
  const cross = await readCrossCheck(crossSources);

  const rejects: string[][] = [];
  const rejectedByReason: Partial<Record<RejectReason, number>> = {};
  const demoRejections = new Map<string, Set<RejectReason>>();
  const seenIds = new Set<string>();
  const candidates: Candidate[] = [];

  azRows.forEach((row, index) => {
    const brand = row.name.replace(/\s+/g, ' ').trim();
    const brandNorm = brand === '' ? '' : normalizeBrand(brand);

    const reject = (reason: RejectReason, detail = ''): void => {
      rejectedByReason[reason] = (rejectedByReason[reason] ?? 0) + 1;
      rejects.push([
        String(row.line),
        row.id,
        brand,
        row.composition1.trim(),
        row.composition2.trim(),
        reason,
        detail,
      ]);
      if (brandNorm !== '' && demoNorms.has(brandNorm)) {
        const reasons = demoRejections.get(brandNorm) ?? new Set<RejectReason>();
        reasons.add(reason);
        demoRejections.set(brandNorm, reasons);
      }
    };

    if (row.id === '') {
      reject('missing_id');
      return;
    }
    if (seenIds.has(row.id)) {
      reject('duplicate_id');
      return;
    }
    seenIds.add(row.id);

    if (brandNorm === '') {
      reject('empty_brand', brand === '' ? 'name is empty' : 'nothing left after normalisation');
      return;
    }

    const components = [row.composition1, row.composition2].filter((c) => c.trim() !== '');
    if (components.length === 0) {
      reject('empty_ingredients');
      return;
    }
    const ingredients: Ingredient[] = [];
    for (const component of components) {
      const parsed = parseIngredient(component);
      if (!parsed.ok) {
        reject(parsed.reason, parsed.detail);
        return;
      }
      ingredients.push(parsed.ingredient);
    }

    const mine = nameSignature(components);
    const check = crossStatus(cross, productKey(brand), mine);
    if (check.status === 'disagree') {
      reject('sources_disagree', `base file: ${mine}; other file: ${check.other}`);
      return;
    }
    if (
      components.length >= 2 &&
      check.status !== 'corroborated' &&
      options.twoIngredientPolicy === 'corroborated'
    ) {
      reject('two_ingredient_unverified', 'no other source confirms this is the full list');
      return;
    }

    candidates.push({
      id: `az-${row.id}`,
      brand,
      brandNorm,
      ingredients,
      strength: joinStrengths(ingredients),
      form: deriveForm(row.packLabel),
      manufacturer: row.manufacturer,
      discontinued: row.discontinued,
      corroborated: check.status === 'corroborated',
      demo: demoNorms.has(brandNorm),
      order: index,
    });
  });

  // Fill the cap by priority: demo brands, then products another file confirms, then active
  // before discontinued, then source order. Source order is arbitrary (ids are not ordered by
  // popularity), so beyond the first two groups the catalogue is a sample, not a ranking.
  const numericId = (c: Candidate): number => {
    const n = Number(c.id.slice(3));
    return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
  };
  const ranked = [...candidates].sort(
    (a, b) =>
      Number(b.demo) - Number(a.demo) ||
      Number(b.corroborated) - Number(a.corroborated) ||
      Number(a.discontinued) - Number(b.discontinued) ||
      numericId(a) - numericId(b) ||
      a.order - b.order,
  );
  const selected = ranked.slice(0, options.maxRows);
  const overflow = ranked.slice(options.maxRows);
  if (overflow.length > 0) {
    log(
      `${candidates.length} usable rows; keeping ${selected.length} (cap ${options.maxRows}), excluding ${overflow.length}.`,
    );
  }

  const builtAt = now().toISOString();
  writeDatabase(options.outDb, selected, {
    source: options.source,
    licence: options.licence,
    built_at: builtAt,
    row_count: String(selected.length),
    schema_version: CATALOG_SCHEMA_VERSION,
    two_ingredient_policy: options.twoIngredientPolicy,
    cross_checked_with: crossSources.map((s) => path.basename(s.path)).join('; '),
  });
  const fileSizeMB = fs.statSync(options.outDb).size / (1024 * 1024);
  log(`Wrote ${options.outDb}: ${selected.length} rows, ${fileSizeMB.toFixed(2)} MB.`);
  if (fileSizeMB > SIZE_WARNING_MB) {
    warn(
      `catalog.db is ${fileSizeMB.toFixed(2)} MB, above the ${SIZE_WARNING_MB} MB warning limit.`,
    );
  }
  if (/^unconfirmed$/i.test(options.licence.trim())) {
    warn('Licence is UNCONFIRMED. Read it on the dataset page and pass --licence "...".');
  }

  // Hand-check sheet: one row per catalogue entry matching each demo brand (exact normalised
  // name). A demo brand that is not in the catalogue still gets a row, saying why.
  const byNorm = new Map<string, Candidate[]>();
  for (const row of selected) {
    if (row.demo) {
      byNorm.set(row.brandNorm, [...(byNorm.get(row.brandNorm) ?? []), row]);
    }
  }
  const demoNotFound: string[] = [];
  const verifyRows: string[][] = [];
  for (const line of demoLines) {
    const matches = byNorm.get(normalizeBrand(line)) ?? [];
    if (matches.length === 0) {
      demoNotFound.push(line);
      const why = [...(demoRejections.get(normalizeBrand(line)) ?? [])].join(', ');
      verifyRows.push([
        line,
        why === '' ? 'NOT IN CATALOGUE' : `NOT IN CATALOGUE (rejected: ${why})`,
        '',
        '',
        '',
        '',
        '',
      ]);
      continue;
    }
    for (const match of matches) {
      verifyRows.push([
        match.brand,
        match.ingredients.map((i) => i.name).join(' + '),
        match.strength ?? '',
        '',
        '',
        '',
        '',
      ]);
    }
  }

  fs.mkdirSync(options.outDir, { recursive: true });
  const paths = {
    db: options.outDb,
    rejects: path.join(options.outDir, 'rejects.csv'),
    excluded: path.join(options.outDir, 'excluded.csv'),
    verifySheet: path.join(options.outDir, 'verify-sheet.csv'),
    report: path.join(options.outDir, 'build-report.json'),
  };
  fs.writeFileSync(
    paths.rejects,
    csvText(['line', 'id', 'brand', 'composition_1', 'composition_2', 'reason', 'detail'], rejects),
  );
  fs.writeFileSync(
    paths.excluded,
    csvText(
      ['id', 'brand', 'brand_norm', 'discontinued', 'corroborated', 'reason'],
      overflow.map((c) => [
        c.id,
        c.brand,
        c.brandNorm,
        String(c.discontinued),
        String(c.corroborated),
        'over_cap',
      ]),
    ),
  );
  fs.writeFileSync(
    paths.verifySheet,
    csvText(
      ['brand', 'ingredients', 'strength', 'source_url', 'verified_by', 'verified_on', 'ok'],
      verifyRows,
    ),
  );

  const rejectedTotal = rejects.length;
  const result: BuildResult = {
    rowCount: selected.length,
    fileSizeMB,
    azRows: azRows.length,
    rejected: rejectedTotal,
    rejectedByReason,
    excludedOverCap: overflow.length,
    corroboratedRows: selected.filter((c) => c.corroborated).length,
    demoLines: demoLines.length,
    demoNotFound,
    warnings,
    paths,
  };
  fs.writeFileSync(paths.report, `${JSON.stringify({ builtAt, ...result }, null, 2)}\n`);

  log(`Rejected ${rejectedTotal} of ${azRows.length} source rows (see ${paths.rejects}):`);
  for (const [reason, count] of Object.entries(rejectedByReason)) {
    log(`  ${reason}: ${count}`);
  }
  log(
    `Verify sheet: ${verifyRows.length} rows for ${demoLines.length} demo brands (${paths.verifySheet}).`,
  );
  if (demoNotFound.length > 0) {
    log(`Demo brands not in the catalogue: ${demoNotFound.join(', ')}`);
  }
  return result;
}

// ---------------------------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------------------------

function parseArgs(argv: readonly string[]): Map<string, string> {
  const args = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag?.startsWith('--')) {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) {
        throw new Error(`Missing value for ${flag}`);
      }
      args.set(flag.slice(2), value);
      i += 1;
    } else {
      throw new Error(`Unexpected argument: ${flag ?? ''}`);
    }
  }
  return args;
}

export const DEFAULT_SOURCE =
  'A-Z Medicine Dataset of India (Kaggle, shudhanshusingh), cross-checked against medicine_data.csv (Kaggle, mohneesh7) and Medicine_Details.csv (Kaggle, singhnavjot2062001)';

export async function main(argv: readonly string[]): Promise<number> {
  const args = parseArgs(argv);
  const get = (name: string, fallback: string): string => args.get(name) ?? fallback;
  const optionalFile = (name: string, fallback: string): string | undefined => {
    const file = get(name, fallback);
    return fs.existsSync(file) ? file : undefined;
  };

  const policy = get('two-ingredient', 'corroborated');
  if (policy !== 'corroborated' && policy !== 'all') {
    throw new Error('--two-ingredient must be "corroborated" or "all"');
  }
  const maxRows = Number(get('max-rows', String(DEFAULT_MAX_ROWS)));
  if (!Number.isInteger(maxRows) || maxRows < 1 || maxRows > DEFAULT_MAX_ROWS) {
    throw new Error(`--max-rows must be a whole number from 1 to ${DEFAULT_MAX_ROWS}`);
  }
  const azPath = get('az', 'data/source/A_Z_medicines_dataset_of_India.csv');
  if (!fs.existsSync(azPath)) {
    throw new Error(
      `Base file not found: ${azPath}. Put the CSV there or pass --az <path>. See docs/phase-2.1-catalogue.md.`,
    );
  }

  const result = await buildCatalog({
    azPath,
    medicineDataPath: optionalFile('medicine-data', 'data/source/medicine_data.csv'),
    medicineDetailsPath: optionalFile('medicine-details', 'data/source/Medicine_Details.csv'),
    demoBrandsPath: get('demo', 'tools/demo-brands.txt'),
    outDb: get('out', 'assets/catalog.db'),
    outDir: get('out-dir', 'build'),
    maxRows,
    twoIngredientPolicy: policy,
    source: get('source', DEFAULT_SOURCE),
    licence: get('licence', 'UNCONFIRMED'),
    log: (line) => console.log(line),
  });
  return result.rowCount > 0 ? 0 : 1;
}

if (require.main === module) {
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      console.error(error instanceof Error ? error.message : 'build failed');
      process.exitCode = 1;
    },
  );
}
