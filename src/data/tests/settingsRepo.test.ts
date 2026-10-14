import { DEFAULT_SETTINGS, parseSettings, parseStubSession } from '@/data/settingsRepo';

describe('parseSettings', () => {
  it('returns defaults for no rows', () => {
    expect(parseSettings([])).toEqual(DEFAULT_SETTINGS);
  });

  it('parses valid rows', () => {
    const result = parseSettings([
      { key: 'language', value: 'hi' },
      { key: 'role', value: 'caregiver' },
      { key: 'textSize', value: 'large' },
      { key: 'autoSpeak', value: '1' },
    ]);
    expect(result).toEqual({
      language: 'hi',
      role: 'caregiver',
      textSize: 'large',
      autoSpeak: true,
    });
  });

  it('ignores invalid values', () => {
    const result = parseSettings([
      { key: 'language', value: 'fr' },
      { key: 'role', value: 'admin' },
      { key: 'textSize', value: 'huge' },
    ]);
    expect(result).toEqual(DEFAULT_SETTINGS);
  });

  it('treats autoSpeak 0 as false', () => {
    expect(parseSettings([{ key: 'autoSpeak', value: '0' }]).autoSpeak).toBe(false);
  });
});

describe('parseStubSession', () => {
  it('is true only for "1"', () => {
    expect(parseStubSession([{ key: 'stubSession', value: '1' }])).toBe(true);
    expect(parseStubSession([{ key: 'stubSession', value: '0' }])).toBe(false);
    expect(parseStubSession([])).toBe(false);
  });
});
