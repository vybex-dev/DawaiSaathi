import { translate, type StringKey } from '@/i18n';
import en from '../../data/strings.en.json';
import hi from '../../data/strings.hi.json';

describe('strings files', () => {
  it('have identical keys', () => {
    expect(Object.keys(hi).sort()).toEqual(Object.keys(en).sort());
  });

  it('mark Hindi as needing review', () => {
    expect(hi['_meta.review']).toBe('NEEDS NATIVE REVIEW');
  });

  it('give every Hindi string Devanagari text', () => {
    for (const [key, value] of Object.entries(hi)) {
      if (key.startsWith('_meta.') || key === 'app.name') {
        continue;
      }
      expect(/[\u0900-\u097F]/.test(value)).toBe(true);
    }
  });
});

describe('translate', () => {
  it('returns the string for the requested language', () => {
    expect(translate('en', 'ui.continue')).toBe('Continue');
    expect(translate('hi', 'ui.continue')).toBe('आगे बढ़ें');
  });

  it('changes output when the language changes', () => {
    expect(translate('en', 'greeting.neutral')).not.toBe(translate('hi', 'greeting.neutral'));
  });

  it('falls back to the key for an unknown key and warns once', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const key = 'does.not.exist' as StringKey;
    expect(translate('hi', key)).toBe('does.not.exist');
    expect(translate('hi', key)).toBe('does.not.exist');
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
