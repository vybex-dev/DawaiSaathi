/**
 * BUILD-TIME copy of the brand normaliser, used only by tools/build-catalog.ts. It is disclosed
 * as tooling in DISCLOSURE.md. The app gets its own src/engine/normalize.ts (Prompt 3.x), and a
 * later test checks that both agree on 200 rows. If you change a rule here, change it there.
 *
 * Rules, applied in this order:
 *  1. Unicode NFKC, then lowercase.
 *  2. Remove strengths: a number followed by a unit (mg, mcg, ug, g, gm, ml, iu, %), including
 *     compound strengths such as 500mg/5ml. A bare number is KEPT: "Dolo 650" is part of the brand.
 *  3. Turn every character that is not a letter, combining mark or digit into a space
 *     (punctuation stripped). Marks are kept so Devanagari vowel signs survive.
 *  4. Drop suffix tokens (whole tokens only, anywhere in the name): see SUFFIX_TOKENS.
 *  5. Collapse spaces and trim.
 */

/**
 * The playbook list is: sr, xl, er, mr, dsr, forte, plus, ip, tablet, tablets, tab, cap,
 * capsules. "capsule" (singular) is a deliberate addition: the dataset writes "Capsule", so
 * without it every capsule brand would keep a trailing word the strip never shows.
 */
export const SUFFIX_TOKENS: ReadonlySet<string> = new Set([
  'sr',
  'xl',
  'er',
  'mr',
  'dsr',
  'forte',
  'plus',
  'ip',
  'tablet',
  'tablets',
  'tab',
  'cap',
  'capsule',
  'capsules',
]);

const UNIT = '(?:mg|mcg|ug|gm|g|ml|iu|%)';
const NUMBER = '(?:\\d+(?:\\.\\d+)?|\\.\\d+)'; // 500, 0.5 and .5
// number + unit, optionally "/ [number] unit". The lookahead stops "5gum" from losing "5g".
const STRENGTH_PATTERN = new RegExp(
  `${NUMBER}\\s*${UNIT}(?:\\s*/\\s*(?:${NUMBER}\\s*)?${UNIT})?(?![a-z])`,
  'g',
);

/** Returns '' when nothing is left (the caller treats that as an empty brand). */
export function normalizeBrand(name: string): string {
  const lowered = name.normalize('NFKC').toLowerCase();
  const withoutStrengths = lowered.replace(STRENGTH_PATTERN, ' ');
  const withoutPunctuation = withoutStrengths.replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ');
  return withoutPunctuation
    .split(' ')
    .filter((token) => token !== '' && !SUFFIX_TOKENS.has(token))
    .join(' ');
}

/**
 * Ingredient names are compared and stored as lowercase generic names. Nothing else is changed:
 * salts ("chlorpheniramine maleate") are kept, because stripping them would be a silent fix.
 */
export function normalizeIngredientName(name: string): string {
  return name.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Key for matching the same product across source files: lowercase, spaces collapsed. */
export function productKey(name: string): string {
  return name.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
}
