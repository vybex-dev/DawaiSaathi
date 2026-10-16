import {
  parseStubSession,
  type Language,
  type Role,
  type SettingRow,
  type SettingsRepo,
} from '@/data/settingsRepo';
import { useSettings } from '@/store/settings';
import { create } from 'zustand';

export type GateTarget = 'language' | 'role' | 'account' | 'elder' | 'caregiver';

export interface GateInput {
  language: Language | null;
  role: Role | null;
  hasSession: boolean;
}

/** Pure gate: where does this user belong? Order of checks matters. */
export function resolveGate(input: GateInput): GateTarget {
  if (input.language === null) {
    return 'language';
  }
  if (input.role === null) {
    return 'role';
  }
  if (!input.hasSession) {
    return 'account';
  }
  return input.role;
}

export function isOnboardingTarget(target: GateTarget): boolean {
  return target === 'language' || target === 'role' || target === 'account';
}

let activeRepo: SettingsRepo | null = null;

interface SessionState {
  /** STUB until Prompt 6.2 replaces it with the real Supabase session. */
  hasSession: boolean;
  /** In memory only: the splash route shows once per cold start that needs onboarding. */
  splashDone: boolean;
  hydrated: boolean;
  hydrateFrom(rows: readonly SettingRow[], repo: SettingsRepo): void;
  setHasSession(value: boolean): Promise<void>;
  markSplashDone(): void;
}

export const useSession = create<SessionState>((set) => ({
  hasSession: false,
  splashDone: false,
  hydrated: false,
  hydrateFrom: (rows, repo) => {
    activeRepo = repo;
    set({ hasSession: parseStubSession(rows), hydrated: true });
  },
  setHasSession: async (value) => {
    set({ hasSession: value });
    if (activeRepo === null) {
      return;
    }
    try {
      await activeRepo.set('stubSession', value ? '1' : '0');
    } catch {
      console.warn('session_write_failed');
    }
  },
  markSplashDone: () => set({ splashDone: true }),
}));

export interface GateState {
  ready: boolean;
  target: GateTarget;
  splashDone: boolean;
}

export function useGate(): GateState {
  const language = useSettings((s) => s.language);
  const role = useSettings((s) => s.role);
  const settingsReady = useSettings((s) => s.hydrated);
  const hasSession = useSession((s) => s.hasSession);
  const sessionReady = useSession((s) => s.hydrated);
  const splashDone = useSession((s) => s.splashDone);
  return {
    ready: settingsReady && sessionReady,
    target: resolveGate({ language, role, hasSession }),
    splashDone,
  };
}

/** Development helper: behave like a fresh install without clearing app data. */
export async function resetForDev(): Promise<void> {
  await useSettings.getState().resetSettings();
  useSession.setState({ hasSession: false, splashDone: false });
}
