import {
  deriveForm,
  joinStrengths,
  nameSignature,
  parseIngredient,
  parseStrength,
  splitComponent,
  splitCompositionString,
} from '../../tools/catalog-parse';

describe('splitComponent', () => {
  it('splits name and strength at the last parentheses', () => {
    expect(splitComponent('Amoxycillin  (500mg) ')).toEqual({
      name: 'Amoxycillin',
      strengthRaw: '500mg',
    });
  });
  it('keeps a bracketed qualifier in the name', () => {
    expect(splitComponent('Vitamin B6 (Pyridoxine) (3mg)')).toEqual({
      name: 'Vitamin B6 (Pyridoxine)',
      strengthRaw: '3mg',
    });
  });
  it('reports a missing strength when the last bracket is not one', () => {
    expect(splitComponent('Vitamin B6 (Pyridoxine)')).toEqual({
      name: 'Vitamin B6 (Pyridoxine)',
      strengthRaw: null,
    });
    expect(splitComponent('Paracetamol')).toEqual({ name: 'Paracetamol', strengthRaw: null });
  });
  it('accepts NA, empty brackets and a leading point as strength text', () => {
    expect(splitComponent('Adrenaline (NA)').strengthRaw).toBe('NA');
    expect(splitComponent('Adrenaline ()').strengthRaw).toBe('');
    expect(splitComponent('Ofloxacin (.75% w/w)').strengthRaw).toBe('.75% w/w');
  });
});

describe('parseStrength', () => {
  it.each([
    '500mg',
    '500 mg',
    '5mg/5ml',
    '0.10% w/w',
    '.75% w/w',
    '2.50% w/v',
    '60Million spores',
    '100IU/ml',
    '600000IU',
    '1.4gm/5ml',
    '65 mg/5 ml',
    '6.5ccid50',
    '40D - Antigen units',
  ])('accepts %s and keeps its text', (raw) => {
    expect(parseStrength(raw)).toEqual({ ok: true, strength: raw.replace(/\s+/g, ' ').trim() });
  });

  it('stores NA (not available) as null', () => {
    expect(parseStrength('NA')).toEqual({ ok: true, strength: null });
    expect(parseStrength(' na ')).toEqual({ ok: true, strength: null });
  });

  it.each([
    'lots',
    '',
    '   ',
    '10',
    'mg',
    '-5mg',
    '0mg',
    '0.0 mg',
    '30.mg/5ml',
    'abc 500mg',
    '500',
    '(500mg)',
  ])('rejects %p', (raw) => {
    expect(parseStrength(raw)).toEqual({ ok: false });
  });
});

describe('parseIngredient', () => {
  it('returns a lowercase generic name and the strength', () => {
    expect(parseIngredient('Amoxycillin  (500mg) ')).toEqual({
      ok: true,
      ingredient: { name: 'amoxycillin', strength: '500mg' },
    });
  });
  it('keeps the salt in the name', () => {
    expect(parseIngredient('Chlorpheniramine Maleate (2mg/5ml)')).toEqual({
      ok: true,
      ingredient: { name: 'chlorpheniramine maleate', strength: '2mg/5ml' },
    });
  });
  it('rejects an empty name', () => {
    expect(parseIngredient(' (500mg)')).toMatchObject({ ok: false, reason: 'empty_ingredients' });
  });
  it('rejects a missing or unreadable strength with the offending text', () => {
    expect(parseIngredient('Paracetamol')).toMatchObject({
      ok: false,
      reason: 'unparseable_strength',
    });
    expect(parseIngredient('Delta (lots)')).toMatchObject({
      ok: false,
      reason: 'unparseable_strength',
    });
    expect(parseIngredient('Megat (30.mg/5ml)')).toMatchObject({
      ok: false,
      reason: 'unparseable_strength',
      detail: 'strength "30.mg/5ml"',
    });
  });
});

describe('nameSignature and composition strings', () => {
  it('is order- and case-insensitive and ignores strengths', () => {
    expect(nameSignature(['Beta (20mg)', 'Alpha (10mg)'])).toBe(
      nameSignature(['alpha (1 mg)', 'BETA (2 mg)']),
    );
    expect(nameSignature(['Alpha (10mg)'])).not.toBe(
      nameSignature(['Alpha (10mg)', 'Beta (20mg)']),
    );
  });
  it('splits the " + " composition format of the cross-check files', () => {
    expect(splitCompositionString('A (1mg) + B (2mg) + C (3mg)')).toEqual([
      'A (1mg)',
      'B (2mg)',
      'C (3mg)',
    ]);
    expect(splitCompositionString('Single (5mg)')).toEqual(['Single (5mg)']);
    expect(splitCompositionString('')).toEqual([]);
  });
});

describe('joinStrengths', () => {
  it('joins in ingredient order, or null when none is known', () => {
    expect(
      joinStrengths([
        { name: 'a', strength: '500mg' },
        { name: 'b', strength: '125mg' },
      ]),
    ).toBe('500mg + 125mg');
    expect(joinStrengths([{ name: 'a', strength: null }])).toBeNull();
    expect(
      joinStrengths([
        { name: 'a', strength: null },
        { name: 'b', strength: '5mg' },
      ]),
    ).toBe('5mg');
  });
});

describe('deriveForm', () => {
  it.each([
    ['strip of 10 tablets', 'tablet'],
    ['strip of 10 tablet sr', 'tablet'],
    ['strip of 15 capsules', 'capsule'],
    ['strip of 10 soft gelatin capsules', 'capsule'],
    ['bottle of 100 ml syrup', 'syrup'],
    ['bottle of 100 ml dry syrup', 'syrup'],
    ['bottle of 60 ml oral suspension', 'suspension'],
    ['vial of 1 injection', 'injection'],
    ['vial of 1 powder for injection', 'injection'],
    ['bottle of 100 ml infusion', 'injection'],
    ['tube of 30 gm cream', 'cream'],
    ['tube of 20 gm ointment', 'ointment'],
    ['tube of 20 gm gel', 'gel'],
    ['bottle of 10 ml eye drop', 'eye drops'],
    ['bottle of 10 ml oral drops', 'drops'],
    ['bottle of 100 ml lotion', 'lotion'],
    ['bottle of 100 ml oral solution', 'solution'],
    ['packet of 5 sachets', 'sachet'],
  ])('%s -> %s', (label, expected) => {
    expect(deriveForm(label)).toBe(expected);
  });
  it('returns null when nothing matches', () => {
    expect(deriveForm('box of 1 kit')).toBeNull();
    expect(deriveForm('')).toBeNull();
  });
});
