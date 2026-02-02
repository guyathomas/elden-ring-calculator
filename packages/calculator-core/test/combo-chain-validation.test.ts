import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  calculateCombosForWeapon,
  ATTACK_TYPE_MAP,
  getChainInfo,
  getCoreBaseType,
  isValidChainSequence,
  type RawAttack,
  type ComboAnimation,
  type AttackTypeInfo,
} from '../src/comboCalculator.js';

// Helper to create AttackTypeInfo for testing
function mockAttackInfo(shortName: string): AttackTypeInfo {
  return {
    name: shortName,
    shortName,
    category: 'light',
    oneHanded: true,
    twoHanded: false,
  };
}

// Load real data for integration tests
const dataPath = join(__dirname, '../data');
const attacks: Record<string, RawAttack> = JSON.parse(
  readFileSync(join(dataPath, 'attacks.json'), 'utf-8')
);
const animations: Record<string, ComboAnimation> = JSON.parse(
  readFileSync(join(dataPath, 'combo-animations.json'), 'utf-8')
);
const weapons: Record<string, { wepmotionCategory: number }> = JSON.parse(
  readFileSync(join(dataPath, 'weapons.json'), 'utf-8')
);

describe('Chain Info Extraction', () => {
  it('should extract chain info from numbered attacks', () => {
    expect(getChainInfo('1H R1 [1]')).toEqual({ baseType: '1H R1', sequence: 1 });
    expect(getChainInfo('1H R1 [2]')).toEqual({ baseType: '1H R1', sequence: 2 });
    expect(getChainInfo('2H R2 [3]')).toEqual({ baseType: '2H R2', sequence: 3 });
    expect(getChainInfo('Paired L1 [5]')).toEqual({ baseType: 'Paired L1', sequence: 5 });
  });

  it('should handle charged attacks with chain numbers', () => {
    expect(getChainInfo('1H R2 (charged) [1]')).toEqual({ baseType: '1H R2 (charged)', sequence: 1 });
    expect(getChainInfo('1H R2 (charged) [2]')).toEqual({ baseType: '1H R2 (charged)', sequence: 2 });
  });

  it('should return null sequence for non-chain attacks', () => {
    expect(getChainInfo('1H Running R1')).toEqual({ baseType: '1H Running R1', sequence: null });
    expect(getChainInfo('1H Crouch R1')).toEqual({ baseType: '1H Crouch R1', sequence: null });
    expect(getChainInfo('1H R1 (charged)')).toEqual({ baseType: '1H R1 (charged)', sequence: null });
  });
});

describe('getCoreBaseType', () => {
  it('should strip "(charged)" modifier from base type', () => {
    expect(getCoreBaseType('1H R2 (charged)')).toBe('1H R2');
    expect(getCoreBaseType('2H R2 (charged)')).toBe('2H R2');
    expect(getCoreBaseType('1H R1 (charged)')).toBe('1H R1');
  });

  it('should return unchanged base type when no "(charged)" modifier', () => {
    expect(getCoreBaseType('1H R2')).toBe('1H R2');
    expect(getCoreBaseType('1H R1')).toBe('1H R1');
    expect(getCoreBaseType('2H R2')).toBe('2H R2');
    expect(getCoreBaseType('1H Running R1')).toBe('1H Running R1');
  });
});

describe('isValidChainSequence Unit Tests', () => {
  // Valid sequences
  it('should allow sequential attacks in same chain', () => {
    expect(isValidChainSequence(mockAttackInfo('1H R1 [1]'), mockAttackInfo('1H R1 [2]'))).toBe(true);
    expect(isValidChainSequence(mockAttackInfo('1H R1 [2]'), mockAttackInfo('1H R1 [3]'))).toBe(true);
    expect(isValidChainSequence(mockAttackInfo('1H R2 [1]'), mockAttackInfo('1H R2 [2]'))).toBe(true);
  });

  it('should allow [1] attacks to follow DIFFERENT chain types', () => {
    expect(isValidChainSequence(mockAttackInfo('1H R1 [1]'), mockAttackInfo('1H R2 [1]'))).toBe(true);
    expect(isValidChainSequence(mockAttackInfo('1H R1 [3]'), mockAttackInfo('1H R2 [1]'))).toBe(true);
    expect(isValidChainSequence(mockAttackInfo('2H R1 [2]'), mockAttackInfo('1H R1 [1]'))).toBe(true);
  });

  it('should allow [1] attacks to follow non-chain attacks', () => {
    expect(isValidChainSequence(mockAttackInfo('1H Running R1'), mockAttackInfo('1H R1 [1]'))).toBe(true);
    expect(isValidChainSequence(mockAttackInfo('1H Crouch R1'), mockAttackInfo('1H R2 [1]'))).toBe(true);
  });

  it('should allow non-chain attacks to follow any attack', () => {
    expect(isValidChainSequence(mockAttackInfo('1H R1 [1]'), mockAttackInfo('1H Running R1'))).toBe(true);
    expect(isValidChainSequence(mockAttackInfo('1H R1 [3]'), mockAttackInfo('1H Crouch R1'))).toBe(true);
  });

  // Invalid sequences - same chain, same index
  it('should NOT allow same attack to chain into itself (same index)', () => {
    expect(isValidChainSequence(mockAttackInfo('1H R1 [1]'), mockAttackInfo('1H R1 [1]'))).toBe(false);
    expect(isValidChainSequence(mockAttackInfo('1H R2 [1]'), mockAttackInfo('1H R2 [1]'))).toBe(false);
    expect(isValidChainSequence(mockAttackInfo('1H R1 [2]'), mockAttackInfo('1H R1 [2]'))).toBe(false);
  });

  // Invalid sequences - same chain, going backwards
  it('should NOT allow same chain to restart (going to smaller index)', () => {
    expect(isValidChainSequence(mockAttackInfo('1H R1 [2]'), mockAttackInfo('1H R1 [1]'))).toBe(false);
    expect(isValidChainSequence(mockAttackInfo('1H R1 [3]'), mockAttackInfo('1H R1 [1]'))).toBe(false);
    expect(isValidChainSequence(mockAttackInfo('1H R2 [2]'), mockAttackInfo('1H R2 [1]'))).toBe(false);
  });

  // Invalid sequences - skipping in chain
  it('should NOT allow skipping attacks in a chain', () => {
    expect(isValidChainSequence(mockAttackInfo('1H R1 [1]'), mockAttackInfo('1H R1 [3]'))).toBe(false);
    expect(isValidChainSequence(mockAttackInfo('1H R1 [1]'), mockAttackInfo('1H R1 [4]'))).toBe(false);
    expect(isValidChainSequence(mockAttackInfo('1H R1 [2]'), mockAttackInfo('1H R1 [4]'))).toBe(false);
  });

  // Invalid sequences - different chain [2]+ attacks
  it('should NOT allow [2]+ attacks from different chains', () => {
    expect(isValidChainSequence(mockAttackInfo('1H R1 [1]'), mockAttackInfo('1H R2 [2]'))).toBe(false);
    expect(isValidChainSequence(mockAttackInfo('1H R2 [1]'), mockAttackInfo('1H R1 [2]'))).toBe(false);
  });

  // Charged attack sequencing - charged and non-charged are same chain family
  it('should NOT allow charged [1] to sequence into non-charged [1] of same attack', () => {
    // Charged R2 [1] -> non-charged R2 [1] is invalid (same chain family, restarting)
    expect(isValidChainSequence(mockAttackInfo('1H R2 (charged) [1]'), mockAttackInfo('1H R2 [1]'))).toBe(false);
    expect(isValidChainSequence(mockAttackInfo('2H R2 (charged) [1]'), mockAttackInfo('2H R2 [1]'))).toBe(false);
  });

  it('should NOT allow non-charged to sequence into charged [1] of same attack', () => {
    // Non-charged R2 [1] -> charged R2 [1] is also invalid
    expect(isValidChainSequence(mockAttackInfo('1H R2 [1]'), mockAttackInfo('1H R2 (charged) [1]'))).toBe(false);
    expect(isValidChainSequence(mockAttackInfo('1H R2 [2]'), mockAttackInfo('1H R2 (charged) [1]'))).toBe(false);
  });

  it('should allow charged [1] to sequence into DIFFERENT chain type', () => {
    // Charged R2 [1] -> R1 [1] is valid (different chain families)
    expect(isValidChainSequence(mockAttackInfo('1H R2 (charged) [1]'), mockAttackInfo('1H R1 [1]'))).toBe(true);
    expect(isValidChainSequence(mockAttackInfo('1H R1 [3]'), mockAttackInfo('1H R2 (charged) [1]'))).toBe(true);
  });
});

describe('Attack Chain Validation', () => {
  it('should not produce combos that skip chain sequences', () => {
    // Test with multiple weapons
    const testWeapons = ['Uchigatana', 'Claymore', 'Longsword', 'Greataxe'];

    for (const weaponName of testWeapons) {
      const weaponInfo = weapons[weaponName];
      if (!weaponInfo) continue;

      const combos = calculateCombosForWeapon(
        weaponName,
        weaponInfo.wepmotionCategory,
        new Map(Object.entries(attacks)),
        animations
      );

      for (const combo of combos) {
        const chainA = getChainInfo(combo.attackAName);
        const chainB = getChainInfo(combo.attackBName);

        // If B is [2] or higher, A must be the previous in the same chain
        // Use core base types to handle charged/non-charged variants
        if (chainB.sequence !== null && chainB.sequence > 1) {
          expect(getCoreBaseType(chainA.baseType)).toBe(getCoreBaseType(chainB.baseType));
          expect(chainA.sequence).toBe(chainB.sequence - 1);
        }
      }
    }
  });

  it('should allow [1] attacks to follow any valid attack', () => {
    const weaponInfo = weapons['Claymore'];
    expect(weaponInfo).toBeDefined();

    const combos = calculateCombosForWeapon(
      'Claymore',
      weaponInfo.wepmotionCategory,
      new Map(Object.entries(attacks)),
      animations
    );

    // Find combos where B is [1]
    const combosToFirst = combos.filter(c => {
      const chainB = getChainInfo(c.attackBName);
      return chainB.sequence === 1;
    });

    // These should exist and can follow various attacks
    expect(combosToFirst.length).toBeGreaterThan(0);

    // Verify they can follow attacks from different chains
    const attackANames = new Set(combosToFirst.map(c => c.attackAName));
    expect(attackANames.size).toBeGreaterThan(0);
  });

  it('should validate all weapons have no invalid chain sequences', { timeout: 30000 }, () => {
    let totalCombos = 0;
    let invalidCombos = 0;

    for (const [weaponName, weaponInfo] of Object.entries(weapons)) {
      const combos = calculateCombosForWeapon(
        weaponName,
        weaponInfo.wepmotionCategory,
        new Map(Object.entries(attacks)),
        animations
      );

      for (const combo of combos) {
        totalCombos++;
        const chainA = getChainInfo(combo.attackAName);
        const chainB = getChainInfo(combo.attackBName);

        // Use core base types to handle charged/non-charged variants
        if (chainB.sequence !== null && chainB.sequence > 1) {
          if (getCoreBaseType(chainA.baseType) !== getCoreBaseType(chainB.baseType) || chainA.sequence !== chainB.sequence - 1) {
            invalidCombos++;
          }
        }
      }
    }

    expect(totalCombos).toBeGreaterThan(0);
    expect(invalidCombos).toBe(0);
  });
});

describe('Specific Chain Sequence Cases', () => {
  it('should allow 1H R2 [1] -> 1H R2 [2] for katanas', () => {
    const weaponInfo = weapons['Uchigatana'];
    expect(weaponInfo).toBeDefined();

    const combos = calculateCombosForWeapon(
      'Uchigatana',
      weaponInfo.wepmotionCategory,
      new Map(Object.entries(attacks)),
      animations
    );

    // Check for valid sequential combo (heavy attack chain)
    const hasValidSequence = combos.some(
      c => c.attackAName === '1H R2 [1]' && c.attackBName === '1H R2 [2]'
    );
    expect(hasValidSequence).toBe(true);
  });

  it('should NOT allow 1H R1 [1] -> 1H R1 [3] (skipping [2])', () => {
    // Test with a sample of weapons to avoid timeout
    const sampleWeapons = ['Uchigatana', 'Longsword', 'Claymore', 'Greataxe', 'Halberd'];

    for (const weaponName of sampleWeapons) {
      const weaponInfo = weapons[weaponName];
      if (!weaponInfo) continue;

      const combos = calculateCombosForWeapon(
        weaponName,
        weaponInfo.wepmotionCategory,
        new Map(Object.entries(attacks)),
        animations
      );

      const invalidSkip = combos.some(c => {
        const chainA = getChainInfo(c.attackAName);
        const chainB = getChainInfo(c.attackBName);
        return (
          chainA.baseType === chainB.baseType &&
          chainA.sequence === 1 &&
          chainB.sequence === 3
        );
      });

      expect(invalidSkip).toBe(false);
    }
  });

  it('should allow cross-chain transitions to [1]', () => {
    const weaponInfo = weapons['Longsword'];
    expect(weaponInfo).toBeDefined();

    const combos = calculateCombosForWeapon(
      'Longsword',
      weaponInfo.wepmotionCategory,
      new Map(Object.entries(attacks)),
      animations
    );

    // Look for combos from one chain type to [1] of another
    const crossChainToFirst = combos.filter(c => {
      const chainA = getChainInfo(c.attackAName);
      const chainB = getChainInfo(c.attackBName);
      return (
        chainA.baseType !== chainB.baseType &&
        chainB.sequence === 1
      );
    });

    // Should have cross-chain combos (e.g., R1 chain -> R2 [1])
    // Longsword should have combos like 1H R1 [X] -> 1H R2 [1]
    expect(crossChainToFirst.length).toBeGreaterThan(0);
  });
});
