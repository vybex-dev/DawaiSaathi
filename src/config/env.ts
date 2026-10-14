// Reads the only two settings the app needs, both public (EXPO_PUBLIC_ prefix).
// Gemini and Groq keys are NEVER read here: they live in Supabase secrets.
//
// Why getEnv() names each variable literally: Expo replaces
// process.env.EXPO_PUBLIC_NAME at build time only when the name is written out in full.
// Dynamic access such as process.env[name] would come back empty in a real build.

export interface Env {
  supabaseUrl: string;
  supabasePublishableKey: string;
}

export interface RawEnv {
  supabaseUrl: string | undefined;
  supabasePublishableKey: string | undefined;
}

export class EnvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvError';
  }
}

const URL_NAME = 'EXPO_PUBLIC_SUPABASE_URL';
const KEY_NAME = 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY';

// Built from pieces so this file never contains a full secret-key prefix
// (tools/check-secrets.sh would flag it).
const SECRET_KEY_PREFIX = 'sb_' + 'secret_';
const SERVICE_ROLE_WORD = 'service' + '_role';

function clean(value: string | undefined): string | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/** Pure and testable: validates raw values and returns a typed Env, or throws EnvError. */
export function parseEnv(raw: RawEnv): Env {
  const url = clean(raw.supabaseUrl);
  const key = clean(raw.supabasePublishableKey);

  const missing: string[] = [];
  if (url === null) missing.push(URL_NAME);
  if (key === null) missing.push(KEY_NAME);
  if (url === null || key === null) {
    throw new EnvError(
      `Missing setting: ${missing.join(', ')}. ` +
        'Copy .env.example to .env, fill in the values, then restart with: ' +
        'npx expo start --dev-client --clear',
    );
  }

  if (!/^https?:\/\/\S+$/.test(url)) {
    throw new EnvError(`${URL_NAME} must start with https:// (or http:// for a local project).`);
  }

  // Never echo the key itself in an error message.
  if (key.startsWith(SECRET_KEY_PREFIX) || key.includes(SERVICE_ROLE_WORD)) {
    throw new EnvError(
      `${KEY_NAME} looks like a secret key. Use the publishable key only; secret keys must never be in the app.`,
    );
  }

  return { supabaseUrl: url, supabasePublishableKey: key };
}

let cached: Env | null = null;

/** The app's settings. Throws a readable EnvError if a value is missing or wrong. */
export function getEnv(): Env {
  if (cached === null) {
    cached = parseEnv({
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabasePublishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    });
  }
  return cached;
}
