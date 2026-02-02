/**
 * Tests for Square Off AoW damage calculation
 *
 * Square Off attacks have isDisableBothHandsAtkBonus=1, which means
 * the 2H STR bonus should NOT be applied to these attacks.
 *
 * Bug: When 2-handing, the calculator was applying the 1.5x STR bonus
 * to Square Off damage even though the attack data has isDisableBothHandsAtkBonus=1.
 *
 * Test Configuration:
 * - Weapon: Lordsworn's Straight Sword (+12), Standard affinity
 * - Stats: 49 STR, 18 DEX, 10 INT, 15 FAI, 8 ARC
 * - Grip: 2-handed (effective STR = floor(49 * 1.5) = 73)
 * - AoW: Square Off
 * - Enemy: Omen Monstrosity (Physical Defense: 117, Slash Negation: -10%)
 *
 * Expected Behavior:
 * - When isDisableBothHandsAtkBonus=1, the attack should use 1H effective STR
 *   even when the player is 2-handing the weapon.
 * - This means 1H and 2H damage should be the same for Square Off attacks.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { buildPrecomputedAowData } from '../src/aowParamBuilder.js';
import { calculateAowDamage } from '../src/aowCalculator.js';
import { buildPrecomputedDataV2 } from '../src/paramBuilder.js';
import type { PrecomputedAowData, AowCalculatorInput } from '../src/aowTypes.js';
import type { PrecomputedDataV2 } from '../src/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PARAM_FILES_DIR = join(__dirname, '..', 'param-files');

// Global test data
let aowData: PrecomputedAowData;
let weaponData: PrecomputedDataV2;

describe('Square Off isDisableBothHandsAtkBonus Tests', () => {
  beforeAll(() => {
    // Build weapon data for test weapon
    weaponData = buildPrecomputedDataV2(PARAM_FILES_DIR, {
      weaponFilter: ["Lordsworn's Straight Sword"],
    });

    // Build AoW data
    aowData = buildPrecomputedAowData(PARAM_FILES_DIR);
  }, 30000);

  describe('isDisableBothHandsAtkBonus flag presence', () => {
    it('should have isDisableBothHandsAtkBonus in PrecomputedAowAttack', () => {
      // Get Square Off sword art
      const swordArtsId = aowData.swordArtsByName['Square Off'];
      expect(swordArtsId).toBeDefined();

      const squareOff = aowData.swordArts[swordArtsId];
      expect(squareOff).toBeDefined();
      expect(squareOff.attacks.length).toBeGreaterThan(0);

      // Check if the isDisableBothHandsAtkBonus field exists
      const firstAttack = squareOff.attacks[0];
      expect(firstAttack).toHaveProperty('isDisableBothHandsAtkBonus');
    });

    it('Square Off R1 should have isDisableBothHandsAtkBonus=true', () => {
      const swordArtsId = aowData.swordArtsByName['Square Off'];
      const squareOff = aowData.swordArts[swordArtsId];

      // Find Square Off R1 (Upward Slash)
      const r1Attack = squareOff.attacks.find(a => a.name.includes('R1') || a.name.includes('Upward'));
      expect(r1Attack).toBeDefined();
      expect(r1Attack!.isDisableBothHandsAtkBonus).toBe(true);
    });

    it('Square Off R2 should have isDisableBothHandsAtkBonus=true', () => {
      const swordArtsId = aowData.swordArtsByName['Square Off'];
      const squareOff = aowData.swordArts[swordArtsId];

      // Find Square Off R2 (Thrust)
      const r2Attack = squareOff.attacks.find(a => a.name.includes('R2') || a.name.includes('Thrust'));
      expect(r2Attack).toBeDefined();
      expect(r2Attack!.isDisableBothHandsAtkBonus).toBe(true);
    });
  });

  describe('2H bonus should NOT be applied when isDisableBothHandsAtkBonus=true', () => {
    const stats = {
      strength: 49,
      dexterity: 18,
      intelligence: 10,
      faith: 15,
      arcane: 8,
    };

    it('should calculate SAME physical damage for 1H and 2H when isDisableBothHandsAtkBonus=true', () => {
      const baseInput: Omit<AowCalculatorInput, 'twoHanding'> = {
        weaponName: "Lordsworn's Straight Sword",
        affinity: 'Standard',
        upgradeLevel: 12,
        weaponClass: 'Straight Sword',
        ...stats,
        ignoreRequirements: false,
        pvpMode: false,
        showLackingFp: false,
        aowName: 'Square Off',
      };

      // Calculate with 1H
      const result1H = calculateAowDamage(aowData, weaponData, {
        ...baseInput,
        twoHanding: false,
      });

      // Calculate with 2H
      const result2H = calculateAowDamage(aowData, weaponData, {
        ...baseInput,
        twoHanding: true,
      });

      // Both should succeed
      expect(result1H.error).toBeUndefined();
      expect(result2H.error).toBeUndefined();
      expect(result1H.attacks.length).toBeGreaterThan(0);
      expect(result2H.attacks.length).toBeGreaterThan(0);

      // Log the results for debugging
      console.log('Square Off 1H results:');
      for (const atk of result1H.attacks) {
        console.log(`  ${atk.name}: Physical=${atk.physical}`);
      }

      console.log('Square Off 2H results:');
      for (const atk of result2H.attacks) {
        console.log(`  ${atk.name}: Physical=${atk.physical}`);
      }

      // For each attack with isDisableBothHandsAtkBonus=true, 1H and 2H damage should be equal
      for (let i = 0; i < result1H.attacks.length; i++) {
        const atk1H = result1H.attacks[i];
        const atk2H = result2H.attacks[i];

        // Only check if both have physical damage
        if (atk1H.physical !== '-' && atk2H.physical !== '-') {
          expect(atk2H.physical).toBe(atk1H.physical);
        }
      }
    });

    it('should produce ~25% LESS damage than before the fix (with 2H)', () => {
      // Before fix: 2H was producing inflated damage due to incorrect STR bonus
      // After fix: 2H should produce same damage as 1H for Square Off
      //
      // Pre-fix values (buggy): Physical ~581, which produced enemy damage ~626
      // Post-fix values: Physical ~547, which produces enemy damage closer to in-game ~500
      //
      // The fix correctly excludes the 2H STR bonus when isDisableBothHandsAtkBonus=true

      const input: AowCalculatorInput = {
        weaponName: "Lordsworn's Straight Sword",
        affinity: 'Standard',
        upgradeLevel: 12,
        weaponClass: 'Straight Sword',
        ...stats,
        twoHanding: true,
        ignoreRequirements: false,
        pvpMode: false,
        showLackingFp: false,
        aowName: 'Square Off',
      };

      const result = calculateAowDamage(aowData, weaponData, input);
      expect(result.error).toBeUndefined();

      // Find R1 attack - assert it exists rather than silently skipping
      const r1 = result.attacks.find(a => a.name.includes('R1') || a.name.includes('Upward'));
      expect(r1).toBeDefined();
      expect(r1!.physical).not.toBe('-');

      const r1Physical = r1!.physical as number;

      // After fix, the physical value should be around 546.77
      // (down from buggy value of ~581 with 2H bonus incorrectly applied)
      // Using a tolerance of ±5 to account for minor floating point variations
      expect(r1Physical).toBeGreaterThan(540);
      expect(r1Physical).toBeLessThan(555);
    });
  });

  describe('All AoW attacks have isDisableBothHandsAtkBonus=true', () => {
    it("Lion's Claw also has isDisableBothHandsAtkBonus=true (like most AoW attacks)", () => {
      // Most/all AoW attacks have isDisableBothHandsAtkBonus=true
      // This is intended game behavior - the 2H bonus only applies to normal attacks (R1/R2),
      // not to special skills/AoWs which have fixed damage calculations regardless of grip style.

      const swordArtsId = aowData.swordArtsByName["Lion's Claw"];
      expect(swordArtsId).toBeDefined();

      const lionsClaw = aowData.swordArts[swordArtsId];
      expect(lionsClaw).toBeDefined();

      // Lion's Claw should have isDisableBothHandsAtkBonus=true for all attacks
      for (const attack of lionsClaw.attacks) {
        expect(attack.isDisableBothHandsAtkBonus).toBe(true);
      }
    });

    it("should calculate SAME damage for 1H and 2H for Lion's Claw (because isDisableBothHandsAtkBonus=true)", () => {
      // Build weapon data for Claymore
      const claymoreData = buildPrecomputedDataV2(PARAM_FILES_DIR, {
        weaponFilter: ['Claymore'],
      });

      const baseInput: Omit<AowCalculatorInput, 'twoHanding'> = {
        weaponName: 'Claymore',
        affinity: 'Standard',
        upgradeLevel: 12,
        weaponClass: 'Greatsword',
        strength: 49,
        dexterity: 18,
        intelligence: 10,
        faith: 15,
        arcane: 8,
        ignoreRequirements: false,
        pvpMode: false,
        showLackingFp: false,
        aowName: "Lion's Claw",
      };

      // Calculate with 1H
      const result1H = calculateAowDamage(aowData, claymoreData, {
        ...baseInput,
        twoHanding: false,
      });

      // Calculate with 2H
      const result2H = calculateAowDamage(aowData, claymoreData, {
        ...baseInput,
        twoHanding: true,
      });

      // Both should succeed
      expect(result1H.error).toBeUndefined();
      expect(result2H.error).toBeUndefined();

      // Assert attacks exist rather than silently skipping
      expect(result1H.attacks.length).toBeGreaterThan(0);
      expect(result2H.attacks.length).toBeGreaterThan(0);

      const atk1H = result1H.attacks[0];
      const atk2H = result2H.attacks[0];

      // Assert physical damage values exist
      expect(atk1H.physical).not.toBe('-');
      expect(atk2H.physical).not.toBe('-');

      // Lion's Claw should have SAME damage for 1H vs 2H
      // because isDisableBothHandsAtkBonus=true (like most AoW attacks)
      expect(atk2H.physical).toBe(atk1H.physical);
    });

    it("Lion's Claw Heavy Claymore +12, 50 STR, 18 DEX, 2H vs Omen Monstrosity should be 817", () => {
      // In-game test configuration:
      // - Weapon: Heavy Claymore +12
      // - Stats: 50 STR, 18 DEX
      // - Grip: 2-handed
      // - AoW: Lion's Claw
      // - Enemy: Omen Monstrosity (Defense: 110, Slash Neg: -10%)
      // - In-game damage: 817
      //
      // Calculation breakdown:
      // - AR: 215 + 162 = 377 (matches in-game)
      // - Pre-defense: 377 * 2.4 = 908.2
      // - After defense (Tier 5: 0.9 * atk): 817.4 → 817
      //
      // NOTE: Calculator shows attackAttribute="Slash" (via atkAttribute=253 → weapon's atkAttribute2=2),
      // but in-game the damage (817) matches Standard (0% negation), not Slash (-10% vulnerability → 899).
      // This suggests Lion's Claw may actually use Standard attack type regardless of weapon attributes.

      const claymoreData = buildPrecomputedDataV2(PARAM_FILES_DIR, {
        weaponFilter: ['Claymore'],
      });

      const input: AowCalculatorInput = {
        weaponName: 'Claymore',
        affinity: 'Heavy',
        upgradeLevel: 12,
        weaponClass: 'Greatsword',
        strength: 50,
        dexterity: 18,
        intelligence: 10,
        faith: 10,
        arcane: 10,
        twoHanding: true,
        ignoreRequirements: false,
        pvpMode: false,
        showLackingFp: false,
        aowName: "Lion's Claw",
      };

      const result = calculateAowDamage(aowData, claymoreData, input);

      expect(result.error).toBeUndefined();
      expect(result.attacks.length).toBeGreaterThan(0);

      const lionsClaw = result.attacks.find(a => !a.name.includes('Lacking FP'));
      expect(lionsClaw).toBeDefined();
      expect(lionsClaw!.physical).not.toBe('-');

      const physical = lionsClaw!.physical as number;
      console.log(`Lion's Claw Heavy Claymore +12, 50 STR, 18 DEX, 2H: Physical=${physical}`);

      // Pre-defense physical should be ~908 (377 AR * 2.4 MV)
      expect(physical).toBeCloseTo(908, 0);

      // After defense against Omen Monstrosity (defense 110):
      // Tier 5 formula: 0.9 * 908 = 817.4 → 817
      // This matches user's in-game value of 817
      const afterDefense = Math.floor(0.9 * physical);
      expect(afterDefense).toBe(817);
    });
  });

  describe('atkAttribute 252/253 resolution', () => {
    /**
     * atkAttribute resolution rules:
     * - 252: Use weapon's atkAttribute field (e.g., 3 = Pierce for Claymore)
     * - 253: Use weapon's is*AttackType flags (first enabled one)
     *
     * For Claymore:
     * - atkAttribute = 3 (Pierce)
     * - isNormalAttackType = 1, isThrustAttackType = 1
     * - So atkAttribute=253 resolves to Standard (isNormalAttackType is checked first)
     *
     * For Uchigatana:
     * - atkAttribute = 1 (Slash)
     * - isSlashAttackType = 1 (no isNormalAttackType)
     * - So atkAttribute=253 resolves to Slash
     */

    it('Claymore with atkAttribute=253 should resolve to Standard (isNormalAttackType=1)', () => {
      const claymoreData = buildPrecomputedDataV2(PARAM_FILES_DIR, {
        weaponFilter: ['Claymore'],
      });

      const input: AowCalculatorInput = {
        weaponName: 'Claymore',
        affinity: 'Standard',
        upgradeLevel: 12,
        weaponClass: 'Greatsword',
        strength: 50,
        dexterity: 18,
        intelligence: 10,
        faith: 10,
        arcane: 10,
        twoHanding: true,
        ignoreRequirements: false,
        pvpMode: false,
        showLackingFp: false,
        aowName: "Lion's Claw",  // atkAttribute=253
      };

      const result = calculateAowDamage(aowData, claymoreData, input);
      expect(result.error).toBeUndefined();

      const lionsClaw = result.attacks.find(a => !a.name.includes('Lacking FP'));
      expect(lionsClaw).toBeDefined();

      // Lion's Claw has atkAttribute=253, which should resolve to Standard for Claymore
      // because Claymore has isNormalAttackType=1 (checked before isSlashAttackType)
      expect(lionsClaw!.attackAttribute).toBe('Standard');
    });

    it('Uchigatana with atkAttribute=253 should resolve to Slash (isSlashAttackType=1)', () => {
      const uchigatanaData = buildPrecomputedDataV2(PARAM_FILES_DIR, {
        weaponFilter: ['Uchigatana'],
      });

      const input: AowCalculatorInput = {
        weaponName: 'Uchigatana',
        affinity: 'Heavy',
        upgradeLevel: 12,
        weaponClass: 'Katana',
        strength: 50,
        dexterity: 18,
        intelligence: 10,
        faith: 10,
        arcane: 10,
        twoHanding: true,
        ignoreRequirements: false,
        pvpMode: false,
        showLackingFp: false,
        aowName: "Lion's Claw",  // atkAttribute=253
      };

      const result = calculateAowDamage(aowData, uchigatanaData, input);
      expect(result.error).toBeUndefined();

      const lionsClaw = result.attacks.find(a => !a.name.includes('Lacking FP'));
      expect(lionsClaw).toBeDefined();

      // Lion's Claw has atkAttribute=253, which should resolve to Slash for Uchigatana
      // because Uchigatana has isSlashAttackType=1 (and isNormalAttackType=0)
      expect(lionsClaw!.attackAttribute).toBe('Slash');
    });

    it('Impaling Thrust (atkAttribute=252) should use weapon atkAttribute (Pierce for Claymore)', () => {
      const claymoreData = buildPrecomputedDataV2(PARAM_FILES_DIR, {
        weaponFilter: ['Claymore'],
      });

      const input: AowCalculatorInput = {
        weaponName: 'Claymore',
        affinity: 'Standard',
        upgradeLevel: 12,
        weaponClass: 'Greatsword',
        strength: 50,
        dexterity: 18,
        intelligence: 10,
        faith: 10,
        arcane: 10,
        twoHanding: true,
        ignoreRequirements: false,
        pvpMode: false,
        showLackingFp: false,
        aowName: 'Impaling Thrust',  // atkAttribute=252
      };

      const result = calculateAowDamage(aowData, claymoreData, input);
      expect(result.error).toBeUndefined();

      const impalingThrust = result.attacks.find(a => !a.name.includes('Lacking FP'));
      expect(impalingThrust).toBeDefined();

      // Impaling Thrust has atkAttribute=252, which uses weapon's atkAttribute field
      // Claymore has atkAttribute=3 (Pierce)
      expect(impalingThrust!.attackAttribute).toBe('Pierce');
    });

    it('Club with atkAttribute=253 should resolve to Strike (isBlowAttackType=1)', () => {
      // Club has: isNormalAttackType=0, isSlashAttackType=0, isBlowAttackType=1, isThrustAttackType=0
      // So atkAttribute=253 should resolve to Strike
      const clubData = buildPrecomputedDataV2(PARAM_FILES_DIR, {
        weaponFilter: ['Club'],
      });

      const input: AowCalculatorInput = {
        weaponName: 'Club',
        affinity: 'Standard',
        upgradeLevel: 12,
        weaponClass: 'Hammer',
        strength: 50,
        dexterity: 18,
        intelligence: 10,
        faith: 10,
        arcane: 10,
        twoHanding: true,
        ignoreRequirements: false,
        pvpMode: false,
        showLackingFp: false,
        aowName: "Lion's Claw",  // atkAttribute=253
      };

      const result = calculateAowDamage(aowData, clubData, input);
      expect(result.error).toBeUndefined();

      const lionsClaw = result.attacks.find(a => !a.name.includes('Lacking FP'));
      expect(lionsClaw).toBeDefined();

      // Lion's Claw has atkAttribute=253, which should resolve to Strike for Club
      // because Club has isBlowAttackType=1 (and isNormalAttackType=0, isSlashAttackType=0)
      expect(lionsClaw!.attackAttribute).toBe('Strike');
    });

    it('Warpick with atkAttribute=253 should resolve to Pierce (isThrustAttackType=1)', () => {
      // Warpick has: isNormalAttackType=0, isSlashAttackType=0, isBlowAttackType=0, isThrustAttackType=1
      // So atkAttribute=253 should resolve to Pierce
      const warpickData = buildPrecomputedDataV2(PARAM_FILES_DIR, {
        weaponFilter: ['Warpick'],
      });

      const input: AowCalculatorInput = {
        weaponName: 'Warpick',
        affinity: 'Standard',
        upgradeLevel: 12,
        weaponClass: 'Hammer',
        strength: 50,
        dexterity: 18,
        intelligence: 10,
        faith: 10,
        arcane: 10,
        twoHanding: true,
        ignoreRequirements: false,
        pvpMode: false,
        showLackingFp: false,
        aowName: "Lion's Claw",  // atkAttribute=253
      };

      const result = calculateAowDamage(aowData, warpickData, input);
      expect(result.error).toBeUndefined();

      const lionsClaw = result.attacks.find(a => !a.name.includes('Lacking FP'));
      expect(lionsClaw).toBeDefined();

      // Lion's Claw has atkAttribute=253, which should resolve to Pierce for Warpick
      // because Warpick has only isThrustAttackType=1 (all other flags are 0)
      expect(lionsClaw!.attackAttribute).toBe('Pierce');
    });
  });
});
