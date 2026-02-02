/**
 * WeaponAttacksTable Component Tests
 *
 * Tests for attack filtering by grip (1H/2H) and category (R1/R2/etc.)
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { WeaponAttacksTable } from '../../../src/components/WeaponAttacksTable.js';
import { ATTACK_TYPE_MAP, filterAttacksByGrip, type WeaponAttack } from '../../../src/data/weaponAttacks.js';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Creates a mock attack based on the ATTACK_TYPE_MAP
 */
function createMockAttack(type: number, overrides: Partial<WeaponAttack> = {}): WeaponAttack {
  const typeInfo = ATTACK_TYPE_MAP[type];
  if (!typeInfo) {
    throw new Error(`Invalid attack type: ${type}`);
  }

  return {
    type,
    name: typeInfo.name,
    shortName: typeInfo.shortName,
    category: typeInfo.category,
    motionValue: 100,
    staminaCost: 20,
    attackAttribute: 'Standard',
    oneHanded: typeInfo.oneHanded,
    twoHanded: typeInfo.twoHanded,
    physicalMV: 100,
    magicMV: 0,
    fireMV: 0,
    lightningMV: 0,
    holyMV: 0,
    poiseDamage: 50,
    damageLevel: 2,
    ...overrides,
  };
}

/**
 * Creates a full set of test attacks for a typical weapon
 */
function createMockAttacksSet(): WeaponAttack[] {
  return [
    // 1H Light Attacks (R1)
    createMockAttack(0),   // 1H R1 [1]
    createMockAttack(10),  // 1H R1 [2]
    createMockAttack(20),  // 1H R1 [3]

    // 1H Heavy Attacks (R2)
    createMockAttack(100), // 1H R2 [1]
    createMockAttack(105), // 1H R2 (charged) [1]

    // 1H Running
    createMockAttack(120), // 1H Running R1
    createMockAttack(125), // 1H Running R2

    // 1H Crouch
    createMockAttack(130), // 1H Crouch R1

    // 1H Rolling
    createMockAttack(150), // 1H Rolling R1

    // 1H Jumping
    createMockAttack(170), // 1H Jump R1
    createMockAttack(175), // 1H Jump R2

    // 2H Light Attacks (R1)
    createMockAttack(200), // 2H R1 [1]
    createMockAttack(210), // 2H R1 [2]
    createMockAttack(220), // 2H R1 [3]

    // 2H Heavy Attacks (R2)
    createMockAttack(300), // 2H R2 [1]
    createMockAttack(305), // 2H R2 (charged) [1]

    // 2H Running
    createMockAttack(320), // 2H Running R1
    createMockAttack(325), // 2H Running R2

    // 2H Crouch
    createMockAttack(330), // 2H Crouch R1

    // 2H Rolling
    createMockAttack(350), // 2H Rolling R1

    // 2H Jumping
    createMockAttack(370), // 2H Jump R1
    createMockAttack(380), // 2H Jump R2

    // Guard Counter (shared between 1H and 2H)
    createMockAttack(500), // Guard Counter [1]
  ];
}

// ============================================================================
// ATTACK_TYPE_MAP Consistency Tests
// ============================================================================

describe('ATTACK_TYPE_MAP', () => {
  it('should have consistent oneHanded/twoHanded flags for 1H attacks', () => {
    // 1H attacks should have oneHanded: true, twoHanded: false
    const oneHandedTypes = [0, 10, 20, 30, 40, 50, 100, 105, 110, 115, 120, 125, 130, 140, 150, 160, 170, 175];

    for (const type of oneHandedTypes) {
      const info = ATTACK_TYPE_MAP[type];
      if (info) {
        expect(info.oneHanded).toBe(true);
        expect(info.twoHanded).toBe(false);
        expect(info.shortName).toContain('1H');
      }
    }
  });

  it('should have consistent oneHanded/twoHanded flags for 2H attacks', () => {
    // 2H attacks should have oneHanded: false, twoHanded: true
    const twoHandedTypes = [200, 210, 220, 230, 240, 300, 305, 310, 315, 320, 325, 330, 340, 350, 360, 370, 380];

    for (const type of twoHandedTypes) {
      const info = ATTACK_TYPE_MAP[type];
      if (info) {
        expect(info.oneHanded).toBe(false);
        expect(info.twoHanded).toBe(true);
        expect(info.shortName).toContain('2H');
      }
    }
  });

  it('should have light category for R1 attacks', () => {
    // Regular R1 attacks should be category: 'light'
    const lightTypes = [0, 10, 20, 30, 40, 50, 200, 210, 220, 230, 240];

    for (const type of lightTypes) {
      const info = ATTACK_TYPE_MAP[type];
      if (info) {
        expect(info.category).toBe('light');
      }
    }
  });

  it('should have heavy category for R2 attacks', () => {
    // Regular R2 attacks should be category: 'heavy'
    const heavyTypes = [100, 105, 110, 115, 300, 305, 310, 315];

    for (const type of heavyTypes) {
      const info = ATTACK_TYPE_MAP[type];
      if (info) {
        expect(info.category).toBe('heavy');
      }
    }
  });

  it('should have running category for running attacks', () => {
    const runningTypes = [120, 125, 320, 325, 450];

    for (const type of runningTypes) {
      const info = ATTACK_TYPE_MAP[type];
      if (info) {
        expect(info.category).toBe('running');
      }
    }
  });

  it('should have crouch category for crouch attacks', () => {
    const crouchTypes = [130, 330];

    for (const type of crouchTypes) {
      const info = ATTACK_TYPE_MAP[type];
      if (info) {
        expect(info.category).toBe('crouch');
      }
    }
  });

  it('should have rolling category for rolling attacks', () => {
    const rollingTypes = [150, 160, 350, 360];

    for (const type of rollingTypes) {
      const info = ATTACK_TYPE_MAP[type];
      if (info) {
        expect(info.category).toBe('rolling');
      }
    }
  });

  it('should have jumping category for jumping attacks', () => {
    const jumpingTypes = [170, 175, 370, 380];

    for (const type of jumpingTypes) {
      const info = ATTACK_TYPE_MAP[type];
      if (info) {
        expect(info.category).toBe('jumping');
      }
    }
  });
});

// ============================================================================
// filterAttacksByGrip Function Tests
// ============================================================================

describe('filterAttacksByGrip', () => {
  const attacks = createMockAttacksSet();

  it('should return only 1H attacks when twoHanding is false', () => {
    const filtered = filterAttacksByGrip(attacks, false);

    // All filtered attacks should have oneHanded: true
    filtered.forEach(attack => {
      expect(attack.oneHanded).toBe(true);
    });

    // Should not include any 2H-only attacks
    const has2HOnly = filtered.some(
      attack => !attack.oneHanded && attack.twoHanded
    );
    expect(has2HOnly).toBe(false);

    // Verify we have the expected 1H attacks
    const shortNames = filtered.map(a => a.shortName);
    expect(shortNames).toContain('1H R1 [1]');
    expect(shortNames).toContain('1H R2 [1]');
    expect(shortNames).not.toContain('2H R1 [1]');
    expect(shortNames).not.toContain('2H R2 [1]');
  });

  it('should return only 2H attacks when twoHanding is true', () => {
    const filtered = filterAttacksByGrip(attacks, true);

    // All filtered attacks should have twoHanded: true
    filtered.forEach(attack => {
      expect(attack.twoHanded).toBe(true);
    });

    // Should not include any 1H-only attacks
    const has1HOnly = filtered.some(
      attack => attack.oneHanded && !attack.twoHanded
    );
    expect(has1HOnly).toBe(false);

    // Verify we have the expected 2H attacks
    const shortNames = filtered.map(a => a.shortName);
    expect(shortNames).toContain('2H R1 [1]');
    expect(shortNames).toContain('2H R2 [1]');
    expect(shortNames).not.toContain('1H R1 [1]');
    expect(shortNames).not.toContain('1H R2 [1]');
  });

  it('should include shared attacks (like Guard Counter) in both modes', () => {
    const filtered1H = filterAttacksByGrip(attacks, false);
    const filtered2H = filterAttacksByGrip(attacks, true);

    // Guard Counter has both oneHanded and twoHanded true
    const guardCounter1H = filtered1H.find(a => a.shortName === 'Guard Counter [1]');
    const guardCounter2H = filtered2H.find(a => a.shortName === 'Guard Counter [1]');

    expect(guardCounter1H).toBeDefined();
    expect(guardCounter2H).toBeDefined();
  });
});

// ============================================================================
// WeaponAttacksTable Component Tests
// ============================================================================

describe('WeaponAttacksTable', () => {
  const defaultProps = {
    attacks: createMockAttacksSet(),
    twoHanding: false,
    selectedEnemy: null,
    weaponAR: null,
  };

  describe('Grip Filtering (1H/2H)', () => {
    it('should only display 1H attacks when twoHanding is false', () => {
      render(<WeaponAttacksTable {...defaultProps} twoHanding={false} />);

      // Should show 1H R1 attacks
      expect(screen.getByText('1H R1 [1]')).toBeInTheDocument();
      expect(screen.getByText('1H R1 [2]')).toBeInTheDocument();

      // Should NOT show 2H R1 attacks
      expect(screen.queryByText('2H R1 [1]')).not.toBeInTheDocument();
      expect(screen.queryByText('2H R1 [2]')).not.toBeInTheDocument();
    });

    it('should only display 2H attacks when twoHanding is true', () => {
      render(<WeaponAttacksTable {...defaultProps} twoHanding={true} />);

      // Should show 2H R1 attacks
      expect(screen.getByText('2H R1 [1]')).toBeInTheDocument();
      expect(screen.getByText('2H R1 [2]')).toBeInTheDocument();

      // Should NOT show 1H R1 attacks
      expect(screen.queryByText('1H R1 [1]')).not.toBeInTheDocument();
      expect(screen.queryByText('1H R1 [2]')).not.toBeInTheDocument();
    });

    it('should show Guard Counter in both 1H and 2H mode', () => {
      const { rerender } = render(
        <WeaponAttacksTable {...defaultProps} twoHanding={false} />
      );

      // Click "All" category filter to see Guard Counter (first "All" button is category filter)
      const allButtons = screen.getAllByRole('button', { name: 'All' });
      fireEvent.click(allButtons[0]); // Category filter "All"

      expect(screen.getByText('Guard Counter [1]')).toBeInTheDocument();

      // Switch to 2H mode
      rerender(<WeaponAttacksTable {...defaultProps} twoHanding={true} />);

      // Click "All" again
      const allButtonsRerendered = screen.getAllByRole('button', { name: 'All' });
      fireEvent.click(allButtonsRerendered[0]);

      expect(screen.getByText('Guard Counter [1]')).toBeInTheDocument();
    });
  });

  describe('Category Filtering (R1/R2/etc.)', () => {
    it('should show only light (R1) attacks when Light filter is selected', () => {
      render(<WeaponAttacksTable {...defaultProps} twoHanding={false} />);

      // Light (R1) should be selected by default
      const lightButton = screen.getByRole('button', { name: 'Light (R1)' });
      expect(lightButton).toHaveClass('bg-[#d4af37]');

      // Should show 1H R1 attacks
      expect(screen.getByText('1H R1 [1]')).toBeInTheDocument();

      // Should NOT show R2 attacks
      expect(screen.queryByText('1H R2 [1]')).not.toBeInTheDocument();
    });

    it('should show only heavy (R2) attacks when Heavy filter is selected', () => {
      render(<WeaponAttacksTable {...defaultProps} twoHanding={false} />);

      // Click Heavy (R2) filter
      const heavyButton = screen.getByRole('button', { name: 'Heavy (R2)' });
      fireEvent.click(heavyButton);

      // Should show 1H R2 attacks
      expect(screen.getByText('1H R2 [1]')).toBeInTheDocument();

      // Should NOT show R1 attacks
      expect(screen.queryByText('1H R1 [1]')).not.toBeInTheDocument();
    });

    it('should show running attacks when Running filter is selected', () => {
      render(<WeaponAttacksTable {...defaultProps} twoHanding={false} />);

      // Click Running filter
      const runningButton = screen.getByRole('button', { name: 'Running' });
      fireEvent.click(runningButton);

      // Should show running attacks
      expect(screen.getByText('1H Running R1')).toBeInTheDocument();
      expect(screen.getByText('1H Running R2')).toBeInTheDocument();

      // Should NOT show regular R1/R2 attacks
      expect(screen.queryByText('1H R1 [1]')).not.toBeInTheDocument();
      expect(screen.queryByText('1H R2 [1]')).not.toBeInTheDocument();
    });

    it('should show crouch attacks when Crouch filter is selected', () => {
      render(<WeaponAttacksTable {...defaultProps} twoHanding={false} />);

      // Click Crouch filter
      const crouchButton = screen.getByRole('button', { name: 'Crouch' });
      fireEvent.click(crouchButton);

      // Should show crouch attack
      expect(screen.getByText('1H Crouch R1')).toBeInTheDocument();

      // Should NOT show other attacks
      expect(screen.queryByText('1H R1 [1]')).not.toBeInTheDocument();
    });

    it('should show rolling attacks when Rolling filter is selected', () => {
      render(<WeaponAttacksTable {...defaultProps} twoHanding={false} />);

      // Click Rolling filter
      const rollingButton = screen.getByRole('button', { name: 'Rolling' });
      fireEvent.click(rollingButton);

      // Should show rolling attack
      expect(screen.getByText('1H Rolling R1')).toBeInTheDocument();

      // Should NOT show other attacks
      expect(screen.queryByText('1H R1 [1]')).not.toBeInTheDocument();
    });

    it('should show jumping attacks when Jumping filter is selected', () => {
      render(<WeaponAttacksTable {...defaultProps} twoHanding={false} />);

      // Click Jumping filter
      const jumpingButton = screen.getByRole('button', { name: 'Jumping' });
      fireEvent.click(jumpingButton);

      // Should show jumping attacks
      expect(screen.getByText('1H Jump R1')).toBeInTheDocument();
      expect(screen.getByText('1H Jump R2')).toBeInTheDocument();

      // Should NOT show other attacks
      expect(screen.queryByText('1H R1 [1]')).not.toBeInTheDocument();
    });

    it('should show all attacks when All filter is selected', () => {
      render(<WeaponAttacksTable {...defaultProps} twoHanding={false} />);

      // Click All category filter (first "All" button is category filter)
      const allButtons = screen.getAllByRole('button', { name: 'All' });
      fireEvent.click(allButtons[0]);

      // Should show attacks from multiple categories
      expect(screen.getByText('1H R1 [1]')).toBeInTheDocument();
      expect(screen.getByText('1H R2 [1]')).toBeInTheDocument();
      expect(screen.getByText('1H Running R1')).toBeInTheDocument();
      expect(screen.getByText('1H Crouch R1')).toBeInTheDocument();
    });
  });

  describe('Combined Grip + Category Filtering', () => {
    it('should show only 1H R1 attacks when 1H mode + Light filter', () => {
      render(<WeaponAttacksTable {...defaultProps} twoHanding={false} />);

      // Light (R1) should be selected by default
      expect(screen.getByText('1H R1 [1]')).toBeInTheDocument();
      expect(screen.getByText('1H R1 [2]')).toBeInTheDocument();
      expect(screen.queryByText('2H R1 [1]')).not.toBeInTheDocument();
      expect(screen.queryByText('1H R2 [1]')).not.toBeInTheDocument();
    });

    it('should show only 2H R1 attacks when 2H mode + Light filter', () => {
      render(<WeaponAttacksTable {...defaultProps} twoHanding={true} />);

      // Light (R1) should be selected by default
      expect(screen.getByText('2H R1 [1]')).toBeInTheDocument();
      expect(screen.getByText('2H R1 [2]')).toBeInTheDocument();
      expect(screen.queryByText('1H R1 [1]')).not.toBeInTheDocument();
      expect(screen.queryByText('2H R2 [1]')).not.toBeInTheDocument();
    });

    it('should show only 1H R2 attacks when 1H mode + Heavy filter', () => {
      render(<WeaponAttacksTable {...defaultProps} twoHanding={false} />);

      // Click Heavy (R2) filter
      fireEvent.click(screen.getByRole('button', { name: 'Heavy (R2)' }));

      expect(screen.getByText('1H R2 [1]')).toBeInTheDocument();
      expect(screen.queryByText('2H R2 [1]')).not.toBeInTheDocument();
      expect(screen.queryByText('1H R1 [1]')).not.toBeInTheDocument();
    });

    it('should show only 2H R2 attacks when 2H mode + Heavy filter', () => {
      render(<WeaponAttacksTable {...defaultProps} twoHanding={true} />);

      // Click Heavy (R2) filter
      fireEvent.click(screen.getByRole('button', { name: 'Heavy (R2)' }));

      expect(screen.getByText('2H R2 [1]')).toBeInTheDocument();
      expect(screen.queryByText('1H R2 [1]')).not.toBeInTheDocument();
      expect(screen.queryByText('2H R1 [1]')).not.toBeInTheDocument();
    });
  });
});
