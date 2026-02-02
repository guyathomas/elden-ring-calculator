/**
 * Critical Value Tests
 *
 * Tests that the criticalValue field is correctly generated from game data.
 * Formula: criticalValue = 100 + throwAtkRate
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { buildPrecomputedDataV2, type PrecomputedDataV2 } from '../src/paramBuilder.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PARAM_FILES_DIR = join(__dirname, '..', 'param-files');

let precomputedData: PrecomputedDataV2;

describe('Critical Value Generation', () => {
  beforeAll(() => {
    // Build precomputed data with a subset of weapons for testing
    precomputedData = buildPrecomputedDataV2(PARAM_FILES_DIR, {
      weaponFilter: [
        'Dagger',           // Should have 130 crit (throwAtkRate=30)
        'Misericorde',      // Should have 140 crit (throwAtkRate=40)
        'Reduvia',          // Should have 110 crit (throwAtkRate=10)
        'Longsword',        // Should have 100 crit (throwAtkRate=0)
        'Uchigatana',       // Should have 100 crit (throwAtkRate=0)
        'Black Knife',      // Should have 110 crit (throwAtkRate=10)
      ],
    });
  }, 30000); // 30 second timeout for data loading in CI

  describe('criticalValue field exists', () => {
    it('should have criticalValue on all weapons', () => {
      for (const [name, weapon] of Object.entries(precomputedData.weapons)) {
        expect(weapon).toHaveProperty('criticalValue');
        expect(typeof weapon.criticalValue).toBe('number');
        expect(weapon.criticalValue).toBeGreaterThanOrEqual(100);
      }
    });
  });

  describe('weapons with enhanced critical values', () => {
    it('should have Misericorde at 140 (highest crit weapon)', () => {
      const weapon = precomputedData.weapons['Misericorde'];
      expect(weapon).toBeDefined();
      expect(weapon?.criticalValue).toBe(140);
    });

    it('should have Dagger at 130', () => {
      const weapon = precomputedData.weapons['Dagger'];
      expect(weapon).toBeDefined();
      expect(weapon?.criticalValue).toBe(130);
    });

    it('should have Reduvia at 110', () => {
      const weapon = precomputedData.weapons['Reduvia'];
      expect(weapon).toBeDefined();
      expect(weapon?.criticalValue).toBe(110);
    });

    it('should have Black Knife at 110', () => {
      const weapon = precomputedData.weapons['Black Knife'];
      expect(weapon).toBeDefined();
      expect(weapon?.criticalValue).toBe(110);
    });
  });

  describe('weapons with base critical value', () => {
    it('should have Longsword at 100 (base crit)', () => {
      const weapon = precomputedData.weapons['Longsword'];
      expect(weapon).toBeDefined();
      expect(weapon?.criticalValue).toBe(100);
    });

    it('should have Uchigatana at 100 (base crit)', () => {
      const weapon = precomputedData.weapons['Uchigatana'];
      expect(weapon).toBeDefined();
      expect(weapon?.criticalValue).toBe(100);
    });
  });

  describe('criticalValue formula validation', () => {
    it('criticalValue should equal 100 + throwAtkRate', () => {
      // Misericorde: throwAtkRate = 40, so criticalValue = 140
      expect(precomputedData.weapons['Misericorde']?.criticalValue).toBe(100 + 40);

      // Dagger: throwAtkRate = 30, so criticalValue = 130
      expect(precomputedData.weapons['Dagger']?.criticalValue).toBe(100 + 30);

      // Reduvia: throwAtkRate = 10, so criticalValue = 110
      expect(precomputedData.weapons['Reduvia']?.criticalValue).toBe(100 + 10);

      // Longsword: throwAtkRate = 0, so criticalValue = 100
      expect(precomputedData.weapons['Longsword']?.criticalValue).toBe(100 + 0);
    });
  });
});

describe('Critical Value - Full Data Build', () => {
  let fullData: PrecomputedDataV2;

  beforeAll(() => {
    // Build full precomputed data
    fullData = buildPrecomputedDataV2(PARAM_FILES_DIR);
  }, 30000); // 30 second timeout for data loading in CI

  it('should include daggers in weapon data (wepType 1)', () => {
    // After fixing the filter to use wepType instead of weaponCategory,
    // daggers should be included
    const daggers = Object.entries(fullData.weapons).filter(
      ([_, weapon]) => weapon.wepType === 1
    );
    expect(daggers.length).toBeGreaterThan(0);
  });

  it('all daggers should have criticalValue >= 100', () => {
    const daggers = Object.entries(fullData.weapons).filter(
      ([_, weapon]) => weapon.wepType === 1
    );

    for (const [name, weapon] of daggers) {
      expect(weapon.criticalValue).toBeGreaterThanOrEqual(100);
    }
  });

  it('no weapon should have criticalValue below 100', () => {
    for (const [name, weapon] of Object.entries(fullData.weapons)) {
      expect(weapon.criticalValue).toBeGreaterThanOrEqual(100);
    }
  });

  it('should have variety of critical values across weapons', () => {
    const critValues = new Set<number>();
    for (const weapon of Object.values(fullData.weapons)) {
      critValues.add(weapon.criticalValue);
    }

    // Should have at least base (100) and some enhanced values
    expect(critValues.has(100)).toBe(true);
    // Should have more than just 100
    expect(critValues.size).toBeGreaterThan(1);
  });
});
