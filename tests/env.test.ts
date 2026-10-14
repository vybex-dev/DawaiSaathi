import { EnvError, parseEnv } from '@/config/env';

const GOOD_URL = 'https://example.supabase.co';
const GOOD_KEY = 'publishable-test-value';

describe('parseEnv', () => {
  it('returns trimmed values when both are present', () => {
    const env = parseEnv({ supabaseUrl: `  ${GOOD_URL} `, supabasePublishableKey: ` ${GOOD_KEY}` });
    expect(env).toEqual({ supabaseUrl: GOOD_URL, supabasePublishableKey: GOOD_KEY });
  });

  it('names every missing variable in the error', () => {
    expect(() => parseEnv({ supabaseUrl: undefined, supabasePublishableKey: undefined })).toThrow(
      /EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY/,
    );
  });

  it('treats blank strings as missing', () => {
    expect(() => parseEnv({ supabaseUrl: '   ', supabasePublishableKey: GOOD_KEY })).toThrow(
      EnvError,
    );
  });

  it('rejects a URL without a scheme', () => {
    expect(() =>
      parseEnv({ supabaseUrl: 'example.supabase.co', supabasePublishableKey: GOOD_KEY }),
    ).toThrow(/must start with https/);
  });

  it('rejects a secret-looking key and never echoes it', () => {
    const secretLooking = 'sb_' + 'secret_abc123';
    let message = '';
    try {
      parseEnv({ supabaseUrl: GOOD_URL, supabasePublishableKey: secretLooking });
    } catch (error) {
      message = error instanceof Error ? error.message : '';
    }
    expect(message).toMatch(/looks like a secret key/);
    expect(message).not.toContain(secretLooking);
  });
});
