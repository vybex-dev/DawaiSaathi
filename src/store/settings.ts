import {
  DEFAULT_SETTINGS,
  parseSettings,
  type Language,
  type PersistedSettings,
  type Role,
  type SettingKey,
  type SettingRow,
  type SettingsRepo,
  type TextSize,
} from '@/data/settingsRepo';
import { create } from 'zustand';

let activeRepo: SettingsRepo | null = null;

async function persist(key: SettingKey, value: string): Promise<void> {
  if (activeRepo === null) {
    return;
  }
  try {
    await activeRepo.set(key, value);
  } catch {
    // Log the error code only, never values.
    console.warn(`settings_write_failed:${key}`);
  }
}

interface SettingsState extends PersistedSettings {
  hydrated: boolean;
  hydrateFrom(rows: ReadonlyArray<SettingRow>, repo: SettingsRepo): void;
  setLanguage(language: Language): Promise<void>;
  setRole(role: Role): Promise<void>;
  setTextSize(textSize: TextSize): Promise<void>;
  setAutoSpeak(autoSpeak: boolean): Promise<void>;
  /** Clears every settings row (including the stub session flag) and resets state. */
  resetSettings(): Promise<void>;
}

export const useSettings = create<SettingsState>((set) => ({
  ...DEFAULT_SETTINGS,
  hydrated: false,
  hydrateFrom: (rows, repo) => {
    activeRepo = repo;
    set({ ...parseSettings(rows), hydrated: true });
  },
  setLanguage: (language) => {
    set({ language });
    return persist('language', language);
  },
  setRole: (role) => {
    set({ role });
    return persist('role', role);
  },
  setTextSize: (textSize) => {
    set({ textSize });
    return persist('textSize', textSize);
  },
  setAutoSpeak: (autoSpeak) => {
    set({ autoSpeak });
    return persist('autoSpeak', autoSpeak ? '1' : '0');
  },
  resetSettings: async () => {
    set({ ...DEFAULT_SETTINGS });
    if (activeRepo === null) {
      return;
    }
    try {
      await activeRepo.clearAll();
    } catch {
      console.warn('settings_clear_failed');
    }
  },
}));
