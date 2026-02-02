/**
 * MobileWeaponCard Component Tests
 *
 * Tests for the MobileWeaponCard component that displays weapon information
 * in a card format for mobile devices.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MobileWeaponCard } from '../../../src/components/MobileWeaponCard.js';

// Helper to create a mock weapon with default values
function createMockWeapon(overrides = {}) {
  return {
    name: 'Test Weapon',
    categoryName: 'Straight Sword',
    affinity: 'Standard',
    totalAR: 350,
    spellScaling: 0,
    hasSorceryScaling: false,
    hasIncantationScaling: false,
    damageDisplay: {
      physical: 250,
      magic: 0,
      fire: 0,
      lightning: 0,
      holy: 0,
    },
    scaling: {
      str: 'C' as const,
      dex: 'C' as const,
      int: '-' as const,
      fai: '-' as const,
      arc: '-' as const,
    },
    requirements: {
      str: 10,
      dex: 10,
      int: 0,
      fai: 0,
      arc: 0,
    },
    bleed: 0,
    frost: 0,
    poison: 0,
    scarletRot: 0,
    sleep: 0,
    madness: 0,
    // Weapon stats
    weight: 4.0,
    damageType: 'Standard',
    criticalValue: 100,
    isBuffable: true,
    trueCombos: 0,
    hasUniqueAttacks: false,
    // Guard stats
    guardStats: {
      physical: 40,
      magic: 25,
      fire: 25,
      lightning: 25,
      holy: 25,
      guardBoost: 30,
    },
    // Efficiency
    damagePercent: 75.5,
    // Attribute investments
    strDeficit: 0,
    dexDeficit: 0,
    intDeficit: 0,
    faiDeficit: 0,
    arcDeficit: 0,
    totalDeficit: 0,
    minLevel: 1,
    pointsRequired: 0,
    ...overrides,
  };
}

describe('MobileWeaponCard', () => {
  describe('Header Display', () => {
    it('renders weapon name and category', () => {
      const weapon = createMockWeapon({ name: 'Moonveil', categoryName: 'Katana' });
      render(
        <MobileWeaponCard
          weapon={weapon}
          isSelected={false}
          meetsRequirements={true}
          onClick={() => {}}
        />
      );

      expect(screen.getByText('Moonveil')).toBeInTheDocument();
      expect(screen.getByText('Katana')).toBeInTheDocument();
    });

    it('displays affinity when not Standard or Unique', () => {
      const weapon = createMockWeapon({ affinity: 'Magic' });
      render(
        <MobileWeaponCard
          weapon={weapon}
          isSelected={false}
          meetsRequirements={true}
          onClick={() => {}}
        />
      );

      expect(screen.getByText('Magic')).toBeInTheDocument();
    });

    it('hides affinity when Standard', () => {
      const weapon = createMockWeapon({ affinity: 'Standard' });
      render(
        <MobileWeaponCard
          weapon={weapon}
          isSelected={false}
          meetsRequirements={true}
          onClick={() => {}}
        />
      );

      expect(screen.queryByText('Standard')).not.toBeInTheDocument();
    });

    it('hides affinity when Unique', () => {
      const weapon = createMockWeapon({ affinity: 'Unique' });
      render(
        <MobileWeaponCard
          weapon={weapon}
          isSelected={false}
          meetsRequirements={true}
          onClick={() => {}}
        />
      );

      expect(screen.queryByText('Unique')).not.toBeInTheDocument();
    });
  });

  describe('AP/SP Display', () => {
    it('displays AP for regular weapons', () => {
      const weapon = createMockWeapon({ totalAR: 350 });
      render(
        <MobileWeaponCard
          weapon={weapon}
          isSelected={false}
          meetsRequirements={true}
          onClick={() => {}}
        />
      );

      expect(screen.getByText('AP')).toBeInTheDocument();
      expect(screen.getByText('350')).toBeInTheDocument();
    });

    it('displays SP for sorcery catalysts', () => {
      const weapon = createMockWeapon({
        hasSorceryScaling: true,
        spellScaling: 280,
        totalAR: 100,
      });
      render(
        <MobileWeaponCard
          weapon={weapon}
          isSelected={false}
          meetsRequirements={true}
          onClick={() => {}}
        />
      );

      expect(screen.getByText('SP')).toBeInTheDocument();
      expect(screen.getByText('280')).toBeInTheDocument();
    });

    it('displays SP for incantation catalysts', () => {
      const weapon = createMockWeapon({
        hasIncantationScaling: true,
        spellScaling: 300,
        totalAR: 50,
      });
      render(
        <MobileWeaponCard
          weapon={weapon}
          isSelected={false}
          meetsRequirements={true}
          onClick={() => {}}
        />
      );

      expect(screen.getByText('SP')).toBeInTheDocument();
      expect(screen.getByText('300')).toBeInTheDocument();
    });

    it('floors AP values', () => {
      const weapon = createMockWeapon({ totalAR: 350.7 });
      render(
        <MobileWeaponCard
          weapon={weapon}
          isSelected={false}
          meetsRequirements={true}
          onClick={() => {}}
        />
      );

      expect(screen.getByText('350')).toBeInTheDocument();
    });
  });

  describe('Attack Power Section', () => {
    it('displays attack power values when present', () => {
      const weapon = createMockWeapon({
        damageDisplay: {
          physical: 200,
          magic: 150,
          fire: 0,
          lightning: 0,
          holy: 0,
        },
      });
      render(
        <MobileWeaponCard
          weapon={weapon}
          isSelected={false}
          meetsRequirements={true}
          onClick={() => {}}
        />
      );

      expect(screen.getByText('Attack Power')).toBeInTheDocument();
      expect(screen.getByText('200')).toBeInTheDocument();
      expect(screen.getByText('150')).toBeInTheDocument();
    });

    it('hides attack power section when all values are zero', () => {
      const weapon = createMockWeapon({
        damageDisplay: {
          physical: 0,
          magic: 0,
          fire: 0,
          lightning: 0,
          holy: 0,
        },
      });
      render(
        <MobileWeaponCard
          weapon={weapon}
          isSelected={false}
          meetsRequirements={true}
          onClick={() => {}}
        />
      );

      expect(screen.queryByText('Attack Power')).not.toBeInTheDocument();
    });
  });

  describe('Attributes Section', () => {
    it('displays combined scaling and requirements', () => {
      const weapon = createMockWeapon({
        scaling: {
          str: 'C' as const,
          dex: 'D' as const,
          int: '-' as const,
          fai: '-' as const,
          arc: '-' as const,
        },
        requirements: {
          str: 12,
          dex: 10,
          int: 0,
          fai: 0,
          arc: 0,
        },
      });
      render(
        <MobileWeaponCard
          weapon={weapon}
          isSelected={false}
          meetsRequirements={true}
          onClick={() => {}}
        />
      );

      expect(screen.getByText('Attributes')).toBeInTheDocument();
      expect(screen.getByText('C')).toBeInTheDocument();
      expect(screen.getByText('D')).toBeInTheDocument();
      expect(screen.getByText('12')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument();
    });

    it('hides attributes section when all scaling is "-" and requirements are 0', () => {
      const weapon = createMockWeapon({
        scaling: {
          str: '-' as const,
          dex: '-' as const,
          int: '-' as const,
          fai: '-' as const,
          arc: '-' as const,
        },
        requirements: {
          str: 0,
          dex: 0,
          int: 0,
          fai: 0,
          arc: 0,
        },
      });
      render(
        <MobileWeaponCard
          weapon={weapon}
          isSelected={false}
          meetsRequirements={true}
          onClick={() => {}}
        />
      );

      expect(screen.queryByText('Attributes')).not.toBeInTheDocument();
    });
  });

  describe('Status Effects Section', () => {
    it('displays bleed when present', () => {
      const weapon = createMockWeapon({ bleed: 50 });
      render(
        <MobileWeaponCard
          weapon={weapon}
          isSelected={false}
          meetsRequirements={true}
          onClick={() => {}}
        />
      );

      expect(screen.getByText('Status Effects')).toBeInTheDocument();
      expect(screen.getByText('Bleed')).toBeInTheDocument();
      expect(screen.getByText('50')).toBeInTheDocument();
    });

    it('displays frost when present', () => {
      const weapon = createMockWeapon({ frost: 55 });
      render(
        <MobileWeaponCard
          weapon={weapon}
          isSelected={false}
          meetsRequirements={true}
          onClick={() => {}}
        />
      );

      expect(screen.getByText('Frost')).toBeInTheDocument();
      expect(screen.getByText('55')).toBeInTheDocument();
    });

    it('displays multiple status effects', () => {
      const weapon = createMockWeapon({ bleed: 45, poison: 60 });
      render(
        <MobileWeaponCard
          weapon={weapon}
          isSelected={false}
          meetsRequirements={true}
          onClick={() => {}}
        />
      );

      expect(screen.getByText('Bleed')).toBeInTheDocument();
      expect(screen.getByText('45')).toBeInTheDocument();
      expect(screen.getByText('Poison')).toBeInTheDocument();
      expect(screen.getByText('60')).toBeInTheDocument();
    });

    it('hides status effects section when none present', () => {
      const weapon = createMockWeapon();
      render(
        <MobileWeaponCard
          weapon={weapon}
          isSelected={false}
          meetsRequirements={true}
          onClick={() => {}}
        />
      );

      expect(screen.queryByText('Status Effects')).not.toBeInTheDocument();
    });
  });

  describe('Selection State', () => {
    it('applies selected styling when isSelected is true', () => {
      const weapon = createMockWeapon();
      const { container } = render(
        <MobileWeaponCard
          weapon={weapon}
          isSelected={true}
          meetsRequirements={true}
          onClick={() => {}}
        />
      );

      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass('border-[#d4af37]');
    });

    it('applies default styling when not selected', () => {
      const weapon = createMockWeapon();
      const { container } = render(
        <MobileWeaponCard
          weapon={weapon}
          isSelected={false}
          meetsRequirements={true}
          onClick={() => {}}
        />
      );

      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass('border-[#2a2a2a]');
    });
  });

  describe('Requirements State', () => {
    it('applies opacity when requirements not met', () => {
      const weapon = createMockWeapon();
      const { container } = render(
        <MobileWeaponCard
          weapon={weapon}
          isSelected={false}
          meetsRequirements={false}
          onClick={() => {}}
        />
      );

      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass('opacity-50');
    });

    it('applies red color to name when requirements not met', () => {
      const weapon = createMockWeapon({ name: 'Heavy Weapon' });
      render(
        <MobileWeaponCard
          weapon={weapon}
          isSelected={false}
          meetsRequirements={false}
          onClick={() => {}}
        />
      );

      const nameElement = screen.getByText('Heavy Weapon');
      expect(nameElement).toHaveClass('text-[#c9302c]');
    });

    it('does not apply opacity when requirements met', () => {
      const weapon = createMockWeapon();
      const { container } = render(
        <MobileWeaponCard
          weapon={weapon}
          isSelected={false}
          meetsRequirements={true}
          onClick={() => {}}
        />
      );

      const card = container.firstChild as HTMLElement;
      expect(card).not.toHaveClass('opacity-50');
    });
  });

  describe('Click Handler', () => {
    it('calls onClick when card is clicked', () => {
      const onClick = vi.fn();
      const weapon = createMockWeapon();
      const { container } = render(
        <MobileWeaponCard
          weapon={weapon}
          isSelected={false}
          meetsRequirements={true}
          onClick={onClick}
        />
      );

      fireEvent.click(container.firstChild as HTMLElement);
      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('Keyboard Accessibility', () => {
    it('has role="button" for screen readers', () => {
      const weapon = createMockWeapon();
      const { container } = render(
        <MobileWeaponCard
          weapon={weapon}
          isSelected={false}
          meetsRequirements={true}
          onClick={() => {}}
        />
      );

      const card = container.firstChild as HTMLElement;
      expect(card).toHaveAttribute('role', 'button');
    });

    it('is focusable with tabIndex={0}', () => {
      const weapon = createMockWeapon();
      const { container } = render(
        <MobileWeaponCard
          weapon={weapon}
          isSelected={false}
          meetsRequirements={true}
          onClick={() => {}}
        />
      );

      const card = container.firstChild as HTMLElement;
      expect(card).toHaveAttribute('tabIndex', '0');
    });

    it('calls onClick when Enter key is pressed', () => {
      const onClick = vi.fn();
      const weapon = createMockWeapon();
      const { container } = render(
        <MobileWeaponCard
          weapon={weapon}
          isSelected={false}
          meetsRequirements={true}
          onClick={onClick}
        />
      );

      const card = container.firstChild as HTMLElement;
      fireEvent.keyDown(card, { key: 'Enter' });
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('calls onClick when Space key is pressed', () => {
      const onClick = vi.fn();
      const weapon = createMockWeapon();
      const { container } = render(
        <MobileWeaponCard
          weapon={weapon}
          isSelected={false}
          meetsRequirements={true}
          onClick={onClick}
        />
      );

      const card = container.firstChild as HTMLElement;
      fireEvent.keyDown(card, { key: ' ' });
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('has aria-pressed attribute reflecting selection state', () => {
      const weapon = createMockWeapon();
      const { container, rerender } = render(
        <MobileWeaponCard
          weapon={weapon}
          isSelected={false}
          meetsRequirements={true}
          onClick={() => {}}
        />
      );

      const card = container.firstChild as HTMLElement;
      expect(card).toHaveAttribute('aria-pressed', 'false');

      rerender(
        <MobileWeaponCard
          weapon={weapon}
          isSelected={true}
          meetsRequirements={true}
          onClick={() => {}}
        />
      );

      expect(card).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe('Scaling Grade Colors', () => {
    it('displays S grade with gold color', () => {
      const weapon = createMockWeapon({
        scaling: {
          str: 'S' as const,
          dex: '-' as const,
          int: '-' as const,
          fai: '-' as const,
          arc: '-' as const,
        },
      });
      render(
        <MobileWeaponCard
          weapon={weapon}
          isSelected={false}
          meetsRequirements={true}
          onClick={() => {}}
        />
      );

      const sGrade = screen.getByText('S');
      expect(sGrade).toHaveClass('text-[#d4af37]');
    });

    it('displays A grade with green color', () => {
      const weapon = createMockWeapon({
        scaling: {
          str: 'A' as const,
          dex: '-' as const,
          int: '-' as const,
          fai: '-' as const,
          arc: '-' as const,
        },
      });
      render(
        <MobileWeaponCard
          weapon={weapon}
          isSelected={false}
          meetsRequirements={true}
          onClick={() => {}}
        />
      );

      const aGrade = screen.getByText('A');
      expect(aGrade).toHaveClass('text-[#7bc96f]');
    });
  });

  describe('Optimal Stats Section', () => {
    it('displays optimal stats when showOptimalStats is true and stats exist', () => {
      const weapon = createMockWeapon({
        optimalStats: {
          str: 40,
          dex: 30,
          int: 0,
          fai: 0,
          arc: 0,
        },
      });
      render(
        <MobileWeaponCard
          weapon={weapon}
          isSelected={false}
          meetsRequirements={true}
          showOptimalStats={true}
          onClick={() => {}}
        />
      );

      expect(screen.getByText('Optimal Stats')).toBeInTheDocument();
      expect(screen.getByText('40')).toBeInTheDocument();
      expect(screen.getByText('30')).toBeInTheDocument();
    });

    it('hides optimal stats when showOptimalStats is false', () => {
      const weapon = createMockWeapon({
        optimalStats: {
          str: 40,
          dex: 30,
          int: 0,
          fai: 0,
          arc: 0,
        },
      });
      render(
        <MobileWeaponCard
          weapon={weapon}
          isSelected={false}
          meetsRequirements={true}
          showOptimalStats={false}
          onClick={() => {}}
        />
      );

      expect(screen.queryByText('Optimal Stats')).not.toBeInTheDocument();
    });

    it('hides optimal stats when showOptimalStats is true but no stats exist', () => {
      const weapon = createMockWeapon({
        optimalStats: undefined,
      });
      render(
        <MobileWeaponCard
          weapon={weapon}
          isSelected={false}
          meetsRequirements={true}
          showOptimalStats={true}
          onClick={() => {}}
        />
      );

      expect(screen.queryByText('Optimal Stats')).not.toBeInTheDocument();
    });

    it('hides optimal stats when all values are zero', () => {
      const weapon = createMockWeapon({
        optimalStats: {
          str: 0,
          dex: 0,
          int: 0,
          fai: 0,
          arc: 0,
        },
      });
      render(
        <MobileWeaponCard
          weapon={weapon}
          isSelected={false}
          meetsRequirements={true}
          showOptimalStats={true}
          onClick={() => {}}
        />
      );

      expect(screen.queryByText('Optimal Stats')).not.toBeInTheDocument();
    });

  });

  describe('Weapon Stats Section (visibleSections.weaponStats)', () => {
    it('renders weapon stats when visibleSections.weaponStats is true', () => {
      const weapon = createMockWeapon({
        weight: 7.5,
        damageType: 'Slash',
        criticalValue: 110,
        isBuffable: true,
        trueCombos: 2,
        hasUniqueAttacks: true,
      });
      render(
        <MobileWeaponCard
          weapon={weapon}
          isSelected={false}
          meetsRequirements={true}
          visibleSections={{ weaponStats: true }}
          onClick={() => {}}
        />
      );

      expect(screen.getByText('Weapon Stats')).toBeInTheDocument();
      expect(screen.getByText('7.5')).toBeInTheDocument();
      expect(screen.getByText('Slash')).toBeInTheDocument();
      expect(screen.getByText('110')).toBeInTheDocument();
      expect(screen.getByText('Buff')).toBeInTheDocument();
      expect(screen.getByText('Unique')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument(); // Combos
    });

    it('hides weapon stats when visibleSections.weaponStats is false', () => {
      const weapon = createMockWeapon({ weight: 7.5 });
      render(
        <MobileWeaponCard
          weapon={weapon}
          isSelected={false}
          meetsRequirements={true}
          visibleSections={{ weaponStats: false }}
          onClick={() => {}}
        />
      );

      expect(screen.queryByText('Weapon Stats')).not.toBeInTheDocument();
    });

    it('hides weapon stats when visibleSections is empty', () => {
      const weapon = createMockWeapon();
      render(
        <MobileWeaponCard
          weapon={weapon}
          isSelected={false}
          meetsRequirements={true}
          visibleSections={{}}
          onClick={() => {}}
        />
      );

      expect(screen.queryByText('Weapon Stats')).not.toBeInTheDocument();
    });

    it('hides Buff tag when weapon is not buffable', () => {
      const weapon = createMockWeapon({ isBuffable: false });
      render(
        <MobileWeaponCard
          weapon={weapon}
          isSelected={false}
          meetsRequirements={true}
          visibleSections={{ weaponStats: true }}
          onClick={() => {}}
        />
      );

      expect(screen.getByText('Weapon Stats')).toBeInTheDocument();
      expect(screen.queryByText('Buff')).not.toBeInTheDocument();
    });

    it('hides Combos tag when trueCombos is 0', () => {
      const weapon = createMockWeapon({ trueCombos: 0 });
      render(
        <MobileWeaponCard
          weapon={weapon}
          isSelected={false}
          meetsRequirements={true}
          visibleSections={{ weaponStats: true }}
          onClick={() => {}}
        />
      );

      expect(screen.queryByText('Combos')).not.toBeInTheDocument();
    });

    it('hides Unique tag when hasUniqueAttacks is false', () => {
      const weapon = createMockWeapon({ hasUniqueAttacks: false });
      render(
        <MobileWeaponCard
          weapon={weapon}
          isSelected={false}
          meetsRequirements={true}
          visibleSections={{ weaponStats: true }}
          onClick={() => {}}
        />
      );

      expect(screen.queryByText('Unique')).not.toBeInTheDocument();
    });

    it('highlights critical value when above 100', () => {
      const weapon = createMockWeapon({ criticalValue: 130 });
      render(
        <MobileWeaponCard
          weapon={weapon}
          isSelected={false}
          meetsRequirements={true}
          visibleSections={{ weaponStats: true }}
          onClick={() => {}}
        />
      );

      const critTag = screen.getByText('130').closest('div');
      expect(critTag).toHaveClass('text-[#d4af37]');
    });

    it('does not highlight critical value at 100', () => {
      const weapon = createMockWeapon({ criticalValue: 100 });
      render(
        <MobileWeaponCard
          weapon={weapon}
          isSelected={false}
          meetsRequirements={true}
          visibleSections={{ weaponStats: true }}
          onClick={() => {}}
        />
      );

      const critTag = screen.getByText('100').closest('div');
      expect(critTag).toHaveClass('text-[#8b8b8b]');
    });
  });

  describe('Guard Stats Section (visibleSections.guardStats)', () => {
    it('renders guard stats when visibleSections.guardStats is true', () => {
      const weapon = createMockWeapon({
        guardStats: {
          physical: 55,
          magic: 35,
          fire: 30,
          lightning: 28,
          holy: 32,
          guardBoost: 42,
        },
      });
      render(
        <MobileWeaponCard
          weapon={weapon}
          isSelected={false}
          meetsRequirements={true}
          visibleSections={{ guardStats: true }}
          onClick={() => {}}
        />
      );

      expect(screen.getByText('Guard Stats')).toBeInTheDocument();
      expect(screen.getByText('55')).toBeInTheDocument();
      expect(screen.getByText('35')).toBeInTheDocument();
      expect(screen.getByText('30')).toBeInTheDocument();
      expect(screen.getByText('28')).toBeInTheDocument();
      expect(screen.getByText('32')).toBeInTheDocument();
      expect(screen.getByText('42')).toBeInTheDocument();
    });

    it('hides guard stats when visibleSections.guardStats is false', () => {
      const weapon = createMockWeapon();
      render(
        <MobileWeaponCard
          weapon={weapon}
          isSelected={false}
          meetsRequirements={true}
          visibleSections={{ guardStats: false }}
          onClick={() => {}}
        />
      );

      expect(screen.queryByText('Guard Stats')).not.toBeInTheDocument();
    });

    it('hides guard stats when visibleSections is not provided', () => {
      const weapon = createMockWeapon();
      render(
        <MobileWeaponCard
          weapon={weapon}
          isSelected={false}
          meetsRequirements={true}
          onClick={() => {}}
        />
      );

      expect(screen.queryByText('Guard Stats')).not.toBeInTheDocument();
    });
  });

  describe('Attribute Investments Section (visibleSections.attributeInvestments)', () => {
    it('renders deficit grid when visibleSections.attributeInvestments is true', () => {
      const weapon = createMockWeapon({
        strDeficit: 5,
        dexDeficit: 3,
        intDeficit: 0,
        faiDeficit: 0,
        arcDeficit: 0,
      });
      render(
        <MobileWeaponCard
          weapon={weapon}
          isSelected={false}
          meetsRequirements={true}
          visibleSections={{ attributeInvestments: true }}
          onClick={() => {}}
        />
      );

      expect(screen.getByText('Attribute Investments')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument(); // strDeficit
      expect(screen.getByText('3')).toBeInTheDocument(); // dexDeficit
    });

    it('hides attribute investments when visibleSections.attributeInvestments is false', () => {
      const weapon = createMockWeapon({ strDeficit: 5 });
      render(
        <MobileWeaponCard
          weapon={weapon}
          isSelected={false}
          meetsRequirements={true}
          visibleSections={{ attributeInvestments: false }}
          onClick={() => {}}
        />
      );

      expect(screen.queryByText('Attribute Investments')).not.toBeInTheDocument();
    });

    it('renders inactive stat cells for zero deficits', () => {
      const weapon = createMockWeapon({
        strDeficit: 5,
        dexDeficit: 0,
        intDeficit: 0,
        faiDeficit: 0,
        arcDeficit: 0,
      });
      render(
        <MobileWeaponCard
          weapon={weapon}
          isSelected={false}
          meetsRequirements={true}
          visibleSections={{ attributeInvestments: true }}
          onClick={() => {}}
        />
      );

      // Str should show value 5 (active)
      expect(screen.getByText('5')).toBeInTheDocument();
      // The "—" character is rendered for inactive cells
      const dashes = screen.getAllByText('—');
      expect(dashes.length).toBeGreaterThanOrEqual(4); // dex, int, fai, arc are all 0
    });
  });

  describe('Multiple visible sections', () => {
    it('renders all sections when all are enabled', () => {
      const weapon = createMockWeapon({
        weight: 5.0,
        strDeficit: 3,
      });
      render(
        <MobileWeaponCard
          weapon={weapon}
          isSelected={false}
          meetsRequirements={true}
          visibleSections={{
            weaponStats: true,
            guardStats: true,
            attributeInvestments: true,
          }}
          onClick={() => {}}
        />
      );

      expect(screen.getByText('Weapon Stats')).toBeInTheDocument();
      expect(screen.getByText('Guard Stats')).toBeInTheDocument();
      expect(screen.getByText('Attribute Investments')).toBeInTheDocument();
    });

    it('renders only selected sections', () => {
      const weapon = createMockWeapon();
      render(
        <MobileWeaponCard
          weapon={weapon}
          isSelected={false}
          meetsRequirements={true}
          visibleSections={{
            weaponStats: true,
            guardStats: false,
            attributeInvestments: false,
          }}
          onClick={() => {}}
        />
      );

      expect(screen.getByText('Weapon Stats')).toBeInTheDocument();
      expect(screen.queryByText('Guard Stats')).not.toBeInTheDocument();
      expect(screen.queryByText('Attribute Investments')).not.toBeInTheDocument();
    });
  });
});
