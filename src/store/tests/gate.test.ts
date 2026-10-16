import { isOnboardingTarget, resolveGate, type GateInput, type GateTarget } from '@/store/session';

const cases: [string, GateInput, GateTarget][] = [
  [
    'nothing chosen goes to language',
    { language: null, role: null, hasSession: false },
    'language',
  ],
  ['language only goes to role', { language: 'en', role: null, hasSession: false }, 'role'],
  [
    'language and role, no session goes to account',
    { language: 'hi', role: 'elder', hasSession: false },
    'account',
  ],
  [
    'elder with session goes to elder home',
    { language: 'en', role: 'elder', hasSession: true },
    'elder',
  ],
  [
    'caregiver with session goes to caregiver home',
    { language: 'hi', role: 'caregiver', hasSession: true },
    'caregiver',
  ],
  [
    'missing language wins over role and session',
    { language: null, role: 'elder', hasSession: true },
    'language',
  ],
];

describe('resolveGate', () => {
  it.each(cases)('%s', (_name, input, expected) => {
    expect(resolveGate(input)).toBe(expected);
  });
});

describe('isOnboardingTarget', () => {
  it('is true only for the three onboarding steps', () => {
    expect(isOnboardingTarget('language')).toBe(true);
    expect(isOnboardingTarget('role')).toBe(true);
    expect(isOnboardingTarget('account')).toBe(true);
    expect(isOnboardingTarget('elder')).toBe(false);
    expect(isOnboardingTarget('caregiver')).toBe(false);
  });
});
