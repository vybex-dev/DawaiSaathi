import type { SQLiteDatabase } from 'expo-sqlite';

export type Language = 'en' | 'hi';
export type Role = 'elder' | 'caregiver';
export type TextSize = 'normal' | 'large';

export type SettingKey = 'language' | 'role' | 'textSize' | 'autoSpeak' | 'stubSession';

export interface SettingRow {
  key: string;
  value: string;
}

export interface PersistedSettings {
  language: Language | null;
  role: Role | null;
  textSize: TextSize;
  autoSpeak: boolean;
}

export const DEFAULT_SETTINGS: PersistedSettings = {
  language: null,
  role: null,
  textSize: 'normal',
  autoSpeak: false,
};

export type SettingsDb = Pick<SQLiteDatabase, 'getAllAsync' | 'runAsync' | 'execAsync'>;

export interface SettingsRepo {
  readRows(): Promise<SettingRow[]>;
  set(key: SettingKey, value: string): Promise<void>;
  clearAll(): Promise<void>;
}

const isLanguage = (v: string | undefined): v is Language => v === 'en' || v === 'hi';
const isRole = (v: string | undefined): v is Role => v === 'elder' || v === 'caregiver';
const isTextSize = (v: string | undefined): v is TextSize => v === 'normal' || v === 'large';

function toMap(rows: ReadonlyArray<SettingRow>): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of rows) {
    map.set(row.key, row.value);
  }
  return map;
}

/** Pure: turns raw rows into typed settings. Invalid or missing values fall back to defaults. */
export function parseSettings(rows: ReadonlyArray<SettingRow>): PersistedSettings {
  const map = toMap(rows);
  const language = map.get('language');
  const role = map.get('role');
  const textSize = map.get('textSize');
  const autoSpeak = map.get('autoSpeak');
  return {
    language: isLanguage(language) ? language : null,
    role: isRole(role) ? role : null,
    textSize: isTextSize(textSize) ? textSize : DEFAULT_SETTINGS.textSize,
    autoSpeak: autoSpeak === undefined ? DEFAULT_SETTINGS.autoSpeak : autoSpeak === '1',
  };
}

/** Pure: the stub "signed in" flag. Replaced by the real Supabase session in Prompt 6.2. */
export function parseStubSession(rows: ReadonlyArray<SettingRow>): boolean {
  return toMap(rows).get('stubSession') === '1';
}

/**
 * Called from SQLiteProvider onInit. Phase 1.3 takes over with versioned migrations;
 * its v1 migration must use CREATE TABLE IF NOT EXISTS so it stays compatible.
 */
export async function ensureSettingsTable(db: SettingsDb): Promise<void> {
  await db.execAsync(
    'CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);',
  );
}

export function createSettingsRepo(db: SettingsDb): SettingsRepo {
  return {
    readRows: () => db.getAllAsync<SettingRow>('SELECT key, value FROM settings'),
    set: async (key, value) => {
      await db.runAsync(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        key,
        value,
      );
    },
    clearAll: async () => {
      await db.runAsync('DELETE FROM settings');
    },
  };
}
