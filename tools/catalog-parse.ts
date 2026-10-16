import { normalizeIngredientName } from './normalize-build';

export interface Ingredient {
  name: string;
  /** null only when the source says the strength is not available ("NA"). */
  strength: string | null;
}

/** "Name (strength)" split at the LAST parenthesised group. */
export interface SplitComponent {
  name: string;
  /** Raw text inside the last parentheses when it looks like a strength, else null. */
  strengthRaw: string | null;
}

/**
 * "Vitamin B6 (Pyridoxine) (3mg)" -> name "Vitamin B6 (Pyridoxine)", strength "3mg".
 * A trailing group that does not look like a strength (does not start with a digit or point and
 * is not "NA") stays part of the name and the strength is reported as missing.
 */
export function splitComponent(text: string): SplitComponent {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  const match = /^(.*?)\s*\(([^()]*)\)$/.exec(trimmed);
  if (match) {
    const inner = (match[2] ?? '').trim();
    if (/^[.\d]/.test(inner) || /^na$/i.test(inner) || inner === '') {
      return { name: (match[1] ?? '').trim(), strengthRaw: inner };
    }
  }
  return { name: trimmed, strengthRaw: null };
}

export type StrengthResult = { ok: true; strength: string | null } | { ok: false };

/**
 * A strength is a number greater than zero followed by a unit, e.g. 500mg, 5mg/5ml, 0.10% w/w,
 * 60Million spores, 100IU/ml. "NA" (not available) is accepted and stored as null. Everything
 * else is unparseable and the row is rejected, never guessed.
 */
export function parseStrength(raw: string): StrengthResult {
  const text = raw.replace(/\s+/g, ' ').trim();
  if (/^na$/i.test(text)) {
    return { ok: true, strength: null };
  }
  // The number may start with a point (".75% w/w" is 0.75). "30.mg" (point, no digits) is rejected.
  const match = /^(\d+(?:\.\d+)?|\.\d+)\s*([a-z%][a-z0-9%./ -]*)$/i.exec(text);
  if (!match) {
    return { ok: false };
  }
  if (!(Number(match[1]) > 0)) {
    return { ok: false };
  }
  return { ok: true, strength: text };
}

export type IngredientResult =
  | { ok: true; ingredient: Ingredient }
  | { ok: false; reason: 'empty_ingredients' | 'unparseable_strength'; detail: string };

/** Parses one composition cell such as "Amoxycillin  (500mg) ". */
export function parseIngredient(text: string): IngredientResult {
  const { name, strengthRaw } = splitComponent(text);
  const cleanName = normalizeIngredientName(name);
  if (cleanName === '') {
    return { ok: false, reason: 'empty_ingredients', detail: 'ingredient name is empty' };
  }
  if (strengthRaw === null) {
    return { ok: false, reason: 'unparseable_strength', detail: 'strength missing' };
  }
  const strength = parseStrength(strengthRaw);
  if (!strength.ok) {
    return { ok: false, reason: 'unparseable_strength', detail: `strength "${strengthRaw}"` };
  }
  return { ok: true, ingredient: { name: cleanName, strength: strength.strength } };
}

/**
 * Names only, sorted and joined. Used to compare one product across source files, where the
 * strength notation differs but the ingredient names should agree.
 */
export function nameSignature(components: readonly string[]): string {
  return components
    .map((c) => normalizeIngredientName(splitComponent(c).name))
    .filter((n) => n !== '')
    .sort()
    .join('|');
}

/** Splits a "A (1mg) + B (2mg)" composition string (the format of the two cross-check files). */
export function splitCompositionString(text: string): string[] {
  return text
    .split(/\s\+\s/)
    .map((part) => part.trim())
    .filter((part) => part !== '');
}

/** Row-level display strength: the ingredient strengths in order, " + " between them. */
export function joinStrengths(ingredients: readonly Ingredient[]): string | null {
  const parts = ingredients.map((i) => i.strength).filter((s): s is string => s !== null);
  return parts.length === 0 ? null : parts.join(' + ');
}

const FORM_RULES: readonly (readonly [RegExp, string])[] = [
  [/\btablets?\b/, 'tablet'],
  [/\bcapsules?\b/, 'capsule'],
  [/\beye drops?\b/, 'eye drops'],
  [/\bear drops?\b/, 'ear drops'],
  [/\bnasal (?:drops?|spray)\b/, 'nasal'],
  [/\bdrops?\b/, 'drops'],
  [/\bsyrup\b/, 'syrup'],
  [/\bsuspension\b/, 'suspension'],
  [/\b(?:injection|infusion)\b/, 'injection'],
  [/\bcream\b/, 'cream'],
  [/\bointment\b/, 'ointment'],
  [/\bgel\b/, 'gel'],
  [/\blotion\b/, 'lotion'],
  [/\bsolution\b/, 'solution'],
  [/\bpowder\b/, 'powder'],
  [/\b(?:inhaler|rotacap|respule)s?\b/, 'inhaler'],
  [/\bspray\b/, 'spray'],
  [/\bsachets?\b/, 'sachet'],
];

/** Dosage form from a pack label such as "strip of 10 tablets". null when no rule matches. */
export function deriveForm(packLabel: string): string | null {
  const label = packLabel.toLowerCase();
  for (const [pattern, form] of FORM_RULES) {
    if (pattern.test(label)) {
      return form;
    }
  }
  return null;
}
