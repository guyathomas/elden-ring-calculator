/**
 * StatInputPanel Component Tests
 *
 * Tests for the stat input validation behavior in the StatInputPanel component.
 * Damage stats (STR, DEX, INT, FAI, ARC) always use RangeStatInput (min/max).
 * Resource stats (VIG, MND, END) always use FixedStatInput (min === max).
 *
 * Specifically tests:
 * - Multi-digit number entry (users can type "20" without "2" being replaced)
 * - onBlur validation and clamping
 * - Error display for values below class minimum
 * - Range input behavior (changing min preserves max and vice versa)
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StatInputPanel } from '../../../src/components/StatInputPanel.js';
import type { StatConfig, StartingClass } from '../../../src/types.js';

describe('StatInputPanel', () => {
  // Default props for rendering the component
  const createDefaultProps = () => ({
    level: 150,
    setLevel: vi.fn(),
    startingClass: 'Vagabond' as StartingClass,
    setStartingClass: vi.fn(),
    statConfigs: {
      vig: { min: 40, max: 40 },
      mnd: { min: 20, max: 20 },
      end: { min: 25, max: 25 },
      str: { min: 30, max: 30 },
      dex: { min: 25, max: 25 },
      int: { min: 10, max: 10 },
      fai: { min: 10, max: 10 },
      arc: { min: 10, max: 10 },
    } as Record<string, StatConfig>,
    onStatConfigChange: vi.fn(),
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('RangeStatInput - Multi-digit Number Entry', () => {
    it('allows typing multi-digit numbers in min field without immediate replacement', () => {
      const props = createDefaultProps();
      render(<StatInputPanel {...props} />);

      // STR is a range input; inputs[0] is the STR min field
      const inputs = screen.getAllByRole('spinbutton');
      const strMinInput = inputs[0];

      // Simulate typing "2" - should allow it without replacing with minimum
      fireEvent.change(strMinInput, { target: { value: '2' } });

      // Should call with min: 2, preserving the existing max of 30
      expect(props.onStatConfigChange).toHaveBeenCalledWith('str', { min: 2, max: 30 });
    });

    it('allows clearing the min field and typing a new value', () => {
      const props = createDefaultProps();
      render(<StatInputPanel {...props} />);

      const inputs = screen.getAllByRole('spinbutton');
      const strMinInput = inputs[0];

      // Clear the input - empty value is NaN, so onValueChange is not called
      fireEvent.change(strMinInput, { target: { value: '' } });
      expect(props.onStatConfigChange).not.toHaveBeenCalled();

      // Type a new value - should preserve the existing max of 30
      fireEvent.change(strMinInput, { target: { value: '25' } });
      expect(props.onStatConfigChange).toHaveBeenCalledWith('str', { min: 25, max: 30 });
    });

    it('parses valid integer values correctly for min field', () => {
      const props = createDefaultProps();
      render(<StatInputPanel {...props} />);

      const inputs = screen.getAllByRole('spinbutton');
      const strMinInput = inputs[0];

      fireEvent.change(strMinInput, { target: { value: '45' } });

      // Should preserve the existing max of 30
      expect(props.onStatConfigChange).toHaveBeenCalledWith('str', { min: 45, max: 30 });
    });

    it('handles number input browser behavior for non-numeric values', () => {
      const props = createDefaultProps();
      render(<StatInputPanel {...props} />);

      const inputs = screen.getAllByRole('spinbutton');
      const strMinInput = inputs[0];

      // For type="number" inputs, browsers convert non-numeric text to empty string
      // Empty string parses to NaN, so onValueChange is not called
      fireEvent.change(strMinInput, { target: { value: '' } });

      expect(props.onStatConfigChange).not.toHaveBeenCalled();
    });
  });

  describe('RangeStatInput - onBlur Validation', () => {
    it('clamps min value to 1 on blur when value is 0', () => {
      // Start with a low value that should be clamped
      const props = createDefaultProps();
      props.statConfigs.str = { min: 0, max: 0 };

      render(<StatInputPanel {...props} />);

      const inputs = screen.getAllByRole('spinbutton');
      const strMinInput = inputs[0];

      // Blur should clamp min to 1 (NumericInput clamps 0 -> max(1, min(99, 0)) = 1)
      // The max field is preserved from the config
      fireEvent.blur(strMinInput);

      expect(props.onStatConfigChange).toHaveBeenCalledWith('str', { min: 1, max: 0 });
    });

    it('clamps min value to 99 on blur when value exceeds 99', () => {
      const props = createDefaultProps();
      props.statConfigs.str = { min: 150, max: 150 };

      render(<StatInputPanel {...props} />);

      const inputs = screen.getAllByRole('spinbutton');
      const strMinInput = inputs[0];

      // Blur should clamp min to 99, preserving the existing max
      fireEvent.blur(strMinInput);

      expect(props.onStatConfigChange).toHaveBeenCalledWith('str', { min: 99, max: 150 });
    });

    it('preserves valid values within range on blur', () => {
      const props = createDefaultProps();
      props.statConfigs.str = { min: 50, max: 50 };

      render(<StatInputPanel {...props} />);

      const inputs = screen.getAllByRole('spinbutton');
      const strMinInput = inputs[0];

      // Blur should preserve 50 for min, max stays the same
      fireEvent.blur(strMinInput);

      expect(props.onStatConfigChange).toHaveBeenCalledWith('str', { min: 50, max: 50 });
    });
  });

  describe('Error Display', () => {
    it('shows error when value is below class minimum', () => {
      // Vagabond has STR minimum of 14
      const props = createDefaultProps();
      props.statConfigs.str = { min: 5, max: 5 }; // Below Vagabond's STR min of 14

      render(<StatInputPanel {...props} />);

      // Should show "Min: 14" error message for Vagabond's STR
      // Use getAllByText since both mobile and desktop layouts render
      const errorMessages = screen.getAllByText('Min: 14');
      expect(errorMessages.length).toBeGreaterThan(0);
    });

    it('does not show error when value meets class minimum', () => {
      // Vagabond has STR minimum of 14
      const props = createDefaultProps();
      props.statConfigs.str = { min: 20, max: 20 }; // Above Vagabond's STR min of 14

      render(<StatInputPanel {...props} />);

      // Should not show any error message
      expect(screen.queryByText(/Min:/)).not.toBeInTheDocument();
    });

    it('shows error for multiple stats below their class minimums', () => {
      const props = createDefaultProps();
      // Set multiple stats below their Vagabond minimums
      props.statConfigs.str = { min: 5, max: 5 };  // Min 14
      props.statConfigs.dex = { min: 5, max: 5 };  // Min 13

      render(<StatInputPanel {...props} />);

      // Should show errors for both
      expect(screen.getAllByText('Min: 14').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Min: 13').length).toBeGreaterThan(0);
    });
  });

  describe('RangeStatInput - Solver Mode', () => {
    const createSolverProps = () => ({
      ...createDefaultProps(),
      statConfigs: {
        vig: { min: 40, max: 40 },
        mnd: { min: 20, max: 20 },
        end: { min: 25, max: 25 },
        str: { min: 14, max: 40 },
        dex: { min: 13, max: 35 },
        int: { min: 9, max: 30 },
        fai: { min: 9, max: 25 },
        arc: { min: 7, max: 20 },
      } as Record<string, StatConfig>,
    });

    it('allows typing multi-digit numbers in min field', () => {
      const props = createSolverProps();
      render(<StatInputPanel {...props} />);

      // In solver mode, find the STR range inputs
      const inputs = screen.getAllByRole('spinbutton');
      // First input in solver mode should be STR min
      const strMinInput = inputs[0];

      fireEvent.change(strMinInput, { target: { value: '2' } });

      // Should allow value 2 without immediate clamping
      expect(props.onStatConfigChange).toHaveBeenCalledWith('str', expect.objectContaining({ min: 2 }));
    });

    it('allows typing multi-digit numbers in max field', () => {
      const props = createSolverProps();
      render(<StatInputPanel {...props} />);

      const inputs = screen.getAllByRole('spinbutton');
      // Second input should be STR max
      const strMaxInput = inputs[1];

      fireEvent.change(strMaxInput, { target: { value: '5' } });

      // Should allow value 5 without immediate clamping
      expect(props.onStatConfigChange).toHaveBeenCalledWith('str', expect.objectContaining({ max: 5 }));
    });

    it('clamps min value on blur when below 1', () => {
      const props = createSolverProps();
      props.statConfigs.str = { min: 0, max: 40 };

      render(<StatInputPanel {...props} />);

      const inputs = screen.getAllByRole('spinbutton');
      const strMinInput = inputs[0];

      // Blur should clamp min to 1 (NumericInput clamps 0 -> max(1, min(99, 0)) = 1)
      // Max is preserved from config
      fireEvent.blur(strMinInput);

      expect(props.onStatConfigChange).toHaveBeenCalledWith('str', { min: 1, max: 40 });
    });

    it('clamps max value on blur when exceeds 99', () => {
      const props = createSolverProps();
      props.statConfigs.str = { min: 14, max: 150 };

      render(<StatInputPanel {...props} />);

      const inputs = screen.getAllByRole('spinbutton');
      const strMaxInput = inputs[1];

      // Blur should clamp to 99
      fireEvent.blur(strMaxInput);

      expect(props.onStatConfigChange).toHaveBeenCalledWith('str', expect.objectContaining({ max: 99 }));
    });

    it('shows error when min is below class minimum', () => {
      const props = createSolverProps();
      props.statConfigs.str = { min: 5, max: 40 }; // Below Vagabond's STR min of 14

      render(<StatInputPanel {...props} />);

      // Should show "Min: 14" error message
      const errorMessages = screen.getAllByText('Min: 14');
      expect(errorMessages.length).toBeGreaterThan(0);
    });
  });

  describe('Integration - Typing Behavior', () => {
    it('allows sequential digit entry in range min field without interference', () => {
      const props = createDefaultProps();
      render(<StatInputPanel {...props} />);

      const inputs = screen.getAllByRole('spinbutton');
      const strMinInput = inputs[0];

      // Step 1: Type first digit "2" - preserves existing max of 30
      fireEvent.change(strMinInput, { target: { value: '2' } });
      expect(props.onStatConfigChange).toHaveBeenLastCalledWith('str', { min: 2, max: 30 });

      // Step 2: Type second digit to make "25" - still preserves max of 30
      fireEvent.change(strMinInput, { target: { value: '25' } });
      expect(props.onStatConfigChange).toHaveBeenLastCalledWith('str', { min: 25, max: 30 });
    });

    it('does not clamp values during typing, only on blur', () => {
      const props = createDefaultProps();
      render(<StatInputPanel {...props} />);

      const inputs = screen.getAllByRole('spinbutton');
      const strMinInput = inputs[0];

      // Type "1" - a low value that might be below class min
      fireEvent.change(strMinInput, { target: { value: '1' } });

      // During typing, min should be 1 (not clamped), max preserved at 30
      expect(props.onStatConfigChange).toHaveBeenLastCalledWith('str', { min: 1, max: 30 });

      // User continues typing to "15"
      fireEvent.change(strMinInput, { target: { value: '15' } });
      expect(props.onStatConfigChange).toHaveBeenLastCalledWith('str', { min: 15, max: 30 });
    });

    it('allows typing values above 99 during input', () => {
      const props = createDefaultProps();
      render(<StatInputPanel {...props} />);

      const inputs = screen.getAllByRole('spinbutton');
      const strMinInput = inputs[0];

      // Type "100" - above the max of 99
      fireEvent.change(strMinInput, { target: { value: '100' } });

      // During typing, min should be 100 (clamping happens on blur), max preserved at 30
      expect(props.onStatConfigChange).toHaveBeenLastCalledWith('str', { min: 100, max: 30 });
    });
  });
});
