import {
  SUFFIX_TOKENS,
  normalizeBrand,
  normalizeIngredientName,
  productKey,
} from '../../tools/normalize-build';

describe('normalizeBrand', () => {
  it.each([
    ['Dolo 650 Tablet', 'dolo 650'],
    ['DOLO-650', 'dolo 650'],
    ['  Dolo   650  ', 'dolo 650'],
    ['Pan 40 Tablet', 'pan 40'],
    ['Azithral 500 Tablet', 'azithral 500'],
    ['Allegra 120mg Tablet', 'allegra'],
    ['Allegra 120 mg Tablet', 'allegra'],
    ['Crocin Advance Tablet', 'crocin advance'],
    ['Glycomet 500 SR Tablet', 'glycomet 500'],
    ['Glycomet-GP 1 Tablet PR', 'glycomet gp 1 pr'],
    ['Telma-H Tablet', 'telma h'],
    ['Zerodol-SP', 'zerodol sp'],
    ['Omez 20 Capsule', 'omez 20'],
    ['Omez 20 Capsules', 'omez 20'],
    ['Omez Cap', 'omez'],
    ['Combiflam Tab', 'combiflam'],
    ['Pantocid DSR Capsule', 'pantocid'],
    ['Shelcal 500 XL', 'shelcal 500'],
    ['Metformin ER Forte', 'metformin'],
    ['Calpol Plus IP', 'calpol'],
    ['Becosules Z Capsule', 'becosules z'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizeBrand(input)).toBe(expected);
  });

  describe('strengths and units', () => {
    it.each([
      ['Paracetamol 500mg', 'paracetamol'],
      ['Paracetamol 500 MG', 'paracetamol'],
      ['Folvite 5mcg', 'folvite'],
      ['Betadine 5% Ointment', 'betadine ointment'],
      ['Betadine 0.5 %', 'betadine'],
      ['Dexona 4 IU', 'dexona'],
      ['Ascoril 100ml', 'ascoril'],
      ['Ascoril LS 5mg/5ml', 'ascoril ls'],
      ['Drug 20 mg/500 mg Tablet', 'drug'],
      ['Paxiton Plus 12.5mg/.5mg Tablet', 'paxiton'],
      ['Drug .5mg', 'drug'],
      ['Sugar 5g Sachet', 'sugar sachet'],
    ])('%s -> %s', (input, expected) => {
      expect(normalizeBrand(input)).toBe(expected);
    });

    it('keeps a bare number: it is part of the brand', () => {
      expect(normalizeBrand('Dolo 650')).toBe('dolo 650');
      expect(normalizeBrand('Pan 40')).toBe('pan 40');
    });

    it('does not strip a unit that is the start of a longer word', () => {
      expect(normalizeBrand('Brand 5gum')).toBe('brand 5gum');
      expect(normalizeBrand('Brand 5mgx')).toBe('brand 5mgx');
    });
  });

  describe('suffix tokens', () => {
    it('removes whole tokens only, never part of a word', () => {
      expect(normalizeBrand('Xlcal')).toBe('xlcal');
      expect(normalizeBrand('Tablets4U')).toBe('tablets4u');
      expect(normalizeBrand('Forteo')).toBe('forteo');
      expect(normalizeBrand('Capex')).toBe('capex');
    });

    it('removes each token from the playbook list plus "capsule"', () => {
      const expected = [
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
        'capsules',
        'capsule',
      ];
      for (const token of expected) {
        expect(SUFFIX_TOKENS.has(token)).toBe(true);
        expect(normalizeBrand(`Brandx ${token}`)).toBe('brandx');
        expect(normalizeBrand(`Brandx ${token.toUpperCase()}`)).toBe('brandx');
      }
    });

    it('removes a suffix token anywhere in the name', () => {
      expect(normalizeBrand('Azithral Plus 500')).toBe('azithral 500');
    });

    it('returns an empty string when only suffix tokens or strengths remain', () => {
      expect(normalizeBrand('Forte Tablet')).toBe('');
      expect(normalizeBrand('Cap 250mg Capsule SR')).toBe('');
      expect(normalizeBrand('XL 200mg/500mg Tablet')).toBe('');
      expect(normalizeBrand('')).toBe('');
      expect(normalizeBrand('   ')).toBe('');
      expect(normalizeBrand('---')).toBe('');
    });
  });

  describe('punctuation and characters', () => {
    it('turns punctuation into spaces and collapses them', () => {
      expect(normalizeBrand("Dr. Reddy's (Special) / Brand!")).toBe('dr reddy s special brand');
      expect(normalizeBrand('A&B_C')).toBe('a b c');
    });

    it('keeps letters and digits from other scripts', () => {
      expect(normalizeBrand('डोलो 650')).toBe('डोलो 650');
    });

    it('folds compatibility characters (NFKC)', () => {
      expect(normalizeBrand('ＤＯＬＯ ６５０')).toBe('dolo 650');
    });
  });

  it('is idempotent', () => {
    const samples = [
      'Dolo 650 Tablet',
      'Glycomet-GP 1 Tablet PR',
      'Paxiton Plus 12.5mg/.5mg Tablet',
      "Dr. Reddy's Brand 5% Cream",
      'Forte Tablet',
      'Omez 20 Capsule',
      'डोलो 650',
    ];
    for (const sample of samples) {
      const once = normalizeBrand(sample);
      expect(normalizeBrand(once)).toBe(once);
    }
  });

  it('only ever outputs letters, digits and single spaces', () => {
    const out = normalizeBrand("A.B-C/D (E) 5mg, F's  G");
    expect(out).toMatch(/^[\p{L}\p{M}\p{N}]+(?: [\p{L}\p{M}\p{N}]+)*$/u);
  });
});

describe('normalizeIngredientName', () => {
  it('lowercases and collapses spaces but keeps salts and brackets', () => {
    expect(normalizeIngredientName('  Chlorpheniramine   Maleate ')).toBe(
      'chlorpheniramine maleate',
    );
    expect(normalizeIngredientName('Vitamin B6 (Pyridoxine)')).toBe('vitamin b6 (pyridoxine)');
  });
});

describe('productKey', () => {
  it('matches the same product across files regardless of case and spacing', () => {
    expect(productKey('Augmentin  625 DUO Tablet')).toBe(productKey(' augmentin 625 duo tablet '));
  });
  it('keeps strengths and forms, so different packs never collide', () => {
    expect(productKey('Dolo 650 Tablet')).not.toBe(productKey('Dolo 500 Tablet'));
  });
});
