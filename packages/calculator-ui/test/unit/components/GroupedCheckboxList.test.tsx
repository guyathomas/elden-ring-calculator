/**
 * GroupedCheckboxList Component Tests
 *
 * Tests for the GroupedCheckboxList component including:
 * - Alphabetical sorting within groups
 * - Group selection behavior
 * - Individual item selection
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GroupedCheckboxList } from '../../../src/components/ui/grouped-checkbox-list.js';

/**
 * Helper to get weapon names in DOM order from an expanded accordion group
 */
function getWeaponNamesInOrder(container: HTMLElement, expectedItems: string[]): string[] {
  // Get all buttons that match our expected weapon names
  const allButtons = container.querySelectorAll('button');
  const weaponNames: string[] = [];

  allButtons.forEach((btn) => {
    const text = btn.textContent?.trim();
    if (text && expectedItems.includes(text)) {
      weaponNames.push(text);
    }
  });

  return weaponNames;
}

describe('GroupedCheckboxList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Alphabetical Sorting', () => {
    it('sorts weapons alphabetically within the Melee group', async () => {
      const options = [
        { label: 'Straight Sword', value: 'Straight Sword' },
        { label: 'Dagger', value: 'Dagger' },
        { label: 'Katana', value: 'Katana' },
        { label: 'Axe', value: 'Axe' },
        { label: 'Greatsword', value: 'Greatsword' },
      ];

      const { container } = render(
        <GroupedCheckboxList
          options={options}
          selected={[]}
          onChange={vi.fn()}
        />
      );

      // Expand the Melee accordion by clicking on the trigger
      const meleeTrigger = screen.getByText('Melee');
      await userEvent.click(meleeTrigger);

      // Wait for the accordion content to be visible
      await waitFor(() => {
        expect(screen.getByText('Axe')).toBeVisible();
      });

      const weaponNames = getWeaponNamesInOrder(
        container,
        ['Axe', 'Dagger', 'Greatsword', 'Katana', 'Straight Sword']
      );

      // Verify alphabetical ordering
      expect(weaponNames).toEqual(['Axe', 'Dagger', 'Greatsword', 'Katana', 'Straight Sword']);
    });

    it('sorts weapons alphabetically within the Ranged group', async () => {
      const options = [
        { label: 'Greatbow', value: 'Greatbow' },
        { label: 'Bow', value: 'Bow' },
        { label: 'Crossbow', value: 'Crossbow' },
        { label: 'Light Bow', value: 'Light Bow' },
      ];

      const { container } = render(
        <GroupedCheckboxList
          options={options}
          selected={[]}
          onChange={vi.fn()}
        />
      );

      // Expand the Ranged accordion
      const rangedTrigger = screen.getByText('Ranged');
      await userEvent.click(rangedTrigger);

      // Wait for the accordion content to be visible
      await waitFor(() => {
        expect(screen.getByText('Bow')).toBeVisible();
      });

      const weaponNames = getWeaponNamesInOrder(
        container,
        ['Bow', 'Crossbow', 'Greatbow', 'Light Bow']
      );

      // Verify alphabetical ordering
      expect(weaponNames).toEqual(['Bow', 'Crossbow', 'Greatbow', 'Light Bow']);
    });

    it('sorts weapons alphabetically within the Catalysts group', async () => {
      const options = [
        { label: 'Sacred Seal', value: 'Sacred Seal' },
        { label: 'Glintstone Staff', value: 'Glintstone Staff' },
      ];

      const { container } = render(
        <GroupedCheckboxList
          options={options}
          selected={[]}
          onChange={vi.fn()}
        />
      );

      // Expand the Catalysts accordion
      const catalystsTrigger = screen.getByText('Catalysts');
      await userEvent.click(catalystsTrigger);

      // Wait for the accordion content to be visible
      await waitFor(() => {
        expect(screen.getByText('Glintstone Staff')).toBeVisible();
      });

      const weaponNames = getWeaponNamesInOrder(
        container,
        ['Glintstone Staff', 'Sacred Seal']
      );

      // Verify alphabetical ordering
      expect(weaponNames).toEqual(['Glintstone Staff', 'Sacred Seal']);
    });

    it('sorts weapons alphabetically within the Shields group', async () => {
      const options = [
        { label: 'Greatshield', value: 'Greatshield' },
        { label: 'Small Shield', value: 'Small Shield' },
        { label: 'Medium Shield', value: 'Medium Shield' },
        { label: 'Thrusting Shield', value: 'Thrusting Shield' },
      ];

      const { container } = render(
        <GroupedCheckboxList
          options={options}
          selected={[]}
          onChange={vi.fn()}
        />
      );

      // Expand the Shields accordion
      const shieldsTrigger = screen.getByText('Shields');
      await userEvent.click(shieldsTrigger);

      // Wait for the accordion content to be visible
      await waitFor(() => {
        expect(screen.getByText('Greatshield')).toBeVisible();
      });

      const weaponNames = getWeaponNamesInOrder(
        container,
        ['Greatshield', 'Medium Shield', 'Small Shield', 'Thrusting Shield']
      );

      // Verify alphabetical ordering
      expect(weaponNames).toEqual(['Greatshield', 'Medium Shield', 'Small Shield', 'Thrusting Shield']);
    });

    it('sorts weapons alphabetically within the Other group', async () => {
      // These are weapon types not in the predefined groups
      const options = [
        { label: 'Zebra Weapon', value: 'Zebra Weapon' },
        { label: 'Alpha Weapon', value: 'Alpha Weapon' },
        { label: 'Beta Weapon', value: 'Beta Weapon' },
      ];

      const { container } = render(
        <GroupedCheckboxList
          options={options}
          selected={[]}
          onChange={vi.fn()}
        />
      );

      // Expand the Other accordion
      const otherTrigger = screen.getByText('Other');
      await userEvent.click(otherTrigger);

      // Wait for the accordion content to be visible
      await waitFor(() => {
        expect(screen.getByText('Alpha Weapon')).toBeVisible();
      });

      const weaponNames = getWeaponNamesInOrder(
        container,
        ['Alpha Weapon', 'Beta Weapon', 'Zebra Weapon']
      );

      // Verify alphabetical ordering
      expect(weaponNames).toEqual(['Alpha Weapon', 'Beta Weapon', 'Zebra Weapon']);
    });
  });

  describe('Group Rendering', () => {
    it('renders groups with correct counts', () => {
      const options = [
        { label: 'Dagger', value: 'Dagger' },
        { label: 'Straight Sword', value: 'Straight Sword' },
        { label: 'Bow', value: 'Bow' },
      ];

      render(
        <GroupedCheckboxList
          options={options}
          selected={['Dagger']}
          onChange={vi.fn()}
        />
      );

      // Melee group should show 1/2 (Dagger selected out of Dagger and Straight Sword)
      expect(screen.getByText('1/2')).toBeInTheDocument();
      // Ranged group should show 0/1 (Bow not selected)
      expect(screen.getByText('0/1')).toBeInTheDocument();
    });

    it('only renders groups that have available options', () => {
      const options = [
        { label: 'Bow', value: 'Bow' },
        { label: 'Crossbow', value: 'Crossbow' },
      ];

      render(
        <GroupedCheckboxList
          options={options}
          selected={[]}
          onChange={vi.fn()}
        />
      );

      // Should render Ranged group
      expect(screen.getByText('Ranged')).toBeInTheDocument();
      // Should NOT render Melee group (no melee weapons in options)
      expect(screen.queryByText('Melee')).not.toBeInTheDocument();
    });
  });

  describe('Selection Behavior', () => {
    it('calls onChange when selecting an individual item', async () => {
      const onChange = vi.fn();
      const options = [
        { label: 'Dagger', value: 'Dagger' },
        { label: 'Straight Sword', value: 'Straight Sword' },
      ];

      render(
        <GroupedCheckboxList
          options={options}
          selected={[]}
          onChange={onChange}
        />
      );

      // Expand Melee group first
      const meleeTrigger = screen.getByText('Melee');
      await userEvent.click(meleeTrigger);

      // Wait for content to be visible
      await waitFor(() => {
        expect(screen.getByText('Dagger')).toBeVisible();
      });

      // Click on Dagger
      const daggerButton = screen.getByText('Dagger').closest('button');
      await userEvent.click(daggerButton!);

      expect(onChange).toHaveBeenCalledWith(['Dagger']);
    });

    it('calls onChange with deselected item when clicking selected item', async () => {
      const onChange = vi.fn();
      const options = [
        { label: 'Dagger', value: 'Dagger' },
        { label: 'Straight Sword', value: 'Straight Sword' },
      ];

      render(
        <GroupedCheckboxList
          options={options}
          selected={['Dagger']}
          onChange={onChange}
        />
      );

      // Expand Melee group first
      const meleeTrigger = screen.getByText('Melee');
      await userEvent.click(meleeTrigger);

      // Wait for content to be visible
      await waitFor(() => {
        expect(screen.getByText('Dagger')).toBeVisible();
      });

      // Click on Dagger to deselect
      const daggerButton = screen.getByText('Dagger').closest('button');
      await userEvent.click(daggerButton!);

      expect(onChange).toHaveBeenCalledWith([]);
    });

    it('selects all items in a group when clicking group checkbox', async () => {
      const onChange = vi.fn();
      const options = [
        { label: 'Bow', value: 'Bow' },
        { label: 'Crossbow', value: 'Crossbow' },
      ];

      render(
        <GroupedCheckboxList
          options={options}
          selected={[]}
          onChange={onChange}
        />
      );

      // Find and click the Ranged group checkbox (first button in group header)
      const rangedGroupCheckbox = screen.getByRole('button', { name: /Select all Ranged/i });
      await userEvent.click(rangedGroupCheckbox);

      // Should select both Bow and Crossbow
      expect(onChange).toHaveBeenCalledWith(expect.arrayContaining(['Bow', 'Crossbow']));
    });

    it('deselects all items in a group when all are selected and clicking group checkbox', async () => {
      const onChange = vi.fn();
      const options = [
        { label: 'Bow', value: 'Bow' },
        { label: 'Crossbow', value: 'Crossbow' },
      ];

      render(
        <GroupedCheckboxList
          options={options}
          selected={['Bow', 'Crossbow']}
          onChange={onChange}
        />
      );

      // Find and click the Ranged group checkbox
      const rangedGroupCheckbox = screen.getByRole('button', { name: /Select all Ranged/i });
      await userEvent.click(rangedGroupCheckbox);

      // Should deselect all
      expect(onChange).toHaveBeenCalledWith([]);
    });
  });
});
