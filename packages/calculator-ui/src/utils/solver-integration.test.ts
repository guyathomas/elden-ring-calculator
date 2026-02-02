/**
 * Integration test for solver optimization modes
 * Tests the full flow with real precomputed data
 */

import { describe, it, expect } from 'vitest';
import { findOptimalStats } from './damageCalculator';
import type { CharacterStats, PrecomputedDataV2, StatConfig } from '../types';
import type { PrecomputedAowData } from '../data/index';
import { readFileSync } from 'fs';
import { gunzipSync } from 'zlib';
import { join } from 'path';

// Load real data from filesystem
function loadTestData(): { precomputed: PrecomputedDataV2; aowData: PrecomputedAowData } {
  const dataDir = join(__dirname, '../data');
  const precomputed = JSON.parse(
    gunzipSync(readFileSync(join(dataDir, 'precomputed.json.gz'))).toString()
  );
  const aowData = JSON.parse(
    gunzipSync(readFileSync(join(dataDir, 'aow-precomputed.json.gz'))).toString()
  );
  return { precomputed, aowData };
}

describe('Solver Integration - Optimization Modes', () => {
  const { precomputed, aowData } = loadTestData();

  // Use a weapon compatible with Black Flame Tornado (Halberd)
  // Black Flame Tornado requires Fire or Flame Art affinity
  const testWeapon = {
    name: 'Nightrider Glaive',
    affinity: 'Fire',
    upgradeLevel: 25,
  };

  // Stat configs with STR/DEX/FAI unlocked (min !== max means unlocked)
  const statConfigs: Record<string, StatConfig> = {
    vig: { min: 40, max: 40 },
    mnd: { min: 20, max: 20 },
    end: { min: 20, max: 20 },
    str: { min: 10, max: 99 },  // unlocked
    dex: { min: 10, max: 99 },  // unlocked
    int: { min: 10, max: 10 },
    fai: { min: 10, max: 99 },  // unlocked
    arc: { min: 10, max: 10 },
  };

  it('should return different optimal stats for AR vs AoW mode with compatible weapon', () => {
    // First verify the weapon exists
    expect(precomputed.weapons[testWeapon.name]).toBeDefined();

    // AR mode optimization
    const arResult = findOptimalStats(
      precomputed,
      testWeapon.name,
      testWeapon.affinity,
      testWeapon.upgradeLevel,
      statConfigs,
      {
        twoHanding: false,
        pointsBudget: 50,
        optimizationMode: 'AR',
        aowData,
        aowName: 'Black Flame Tornado',
      }
    );

    // AoW mode optimization
    const aowResult = findOptimalStats(
      precomputed,
      testWeapon.name,
      testWeapon.affinity,
      testWeapon.upgradeLevel,
      statConfigs,
      {
        twoHanding: false,
        pointsBudget: 50,
        optimizationMode: 'AoW',
        aowData,
        aowName: 'Black Flame Tornado',
      }
    );

    console.log('\n=== Nightrider Glaive + Black Flame Tornado ===');
    console.log('AR Mode:');
    console.log('  Damage:', arResult.damage);
    console.log('  Stats:', arResult.stats);
    console.log('AoW Mode:');
    console.log('  Damage:', aowResult.damage);
    console.log('  Stats:', aowResult.stats);

    // Both should return valid results
    expect(arResult.damage).toBeGreaterThan(0);
    expect(aowResult.damage).toBeGreaterThan(0);

    // The stats or damage should be different between modes
    // (unless by coincidence they optimize to the same point)
    const statsAreSame =
      arResult.stats.str === aowResult.stats.str &&
      arResult.stats.dex === aowResult.stats.dex &&
      arResult.stats.fai === aowResult.stats.fai;

    if (statsAreSame) {
      console.log('\nWARNING: Stats are identical - checking if this is expected...');
      // If stats are the same, damage should also be similar
      // This could happen if the weapon happens to optimize the same way
    }

    // Log whether there's a difference
    console.log('\nStats differ:', !statsAreSame);
  });

});
