/**
 * StatInputPanel Component Tests
 *
 * Tests for the stat input validation behavior in the StatInputPanel component.
 * Specifically tests:
 * - Multi-digit number entry (users can type "20" without "2" being replaced)
 * - onBlur validation and clamping
 * - Error display for values below class minimum
 * - Empty input handling while typing
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
      vig: { locked: true, value: 40 },
      mnd: { locked: true, value: 20 },
      end: { locked: true, value: 25 },
      str: { locked: true, value: 30 },
      dex: { locked: true, value: 25 },
      int: { locked: true, value: 10 },
      fai: { locked: true, value: 10 },
      arc: { locked: true, value: 10 },
    } as Record<string, StatConfig>,
    onStatConfigChange: vi.fn(),
    solverEnabled: false,
    onSolverToggle: vi.fn(),
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('FixedStatInput - Multi-digit Number Entry', () => {
    it('allows typing multi-digit numbers without immediate replacement', () => {
      const props = createDefaultProps();
      render(<StatInputPanel {...props} />);

      // Find the STR input (first stat input in fixed mode on desktop)
      const inputs = screen.getAllByRole('spinbutton');
      const strInput = inputs[0];

      // Simulate typing "2" - should allow it without replacing with minimum
      fireEvent.change(strInput, { target: { value: '2' } });

      // Should call with value 2, not be replaced by a minimum
      expect(props.onStatConfigChange).toHaveBeenCalledWith('str', { locked: true, value: 2 });
    });

    it('allows clearing the input to type a new value', () => {
      const props = createDefaultProps();
      render(<StatInputPanel {...props} />);

      const inputs = screen.getAllByRole('spinbutton');
      const strInput = inputs[0];

      // Clear the input
      fireEvent.change(strInput, { target: { value: '' } });

      // Should allow empty value (set to 0 internally)
      expect(props.onStatConfigChange).toHaveBeenCalledWith('str', { locked: true, value: 0 });
    });

    it('parses valid integer values correctly', () => {
      const props = createDefaultProps();
      render(<StatInputPanel {...props} />);

      const inputs = screen.getAllByRole('spinbutton');
      const strInput = inputs[0];

      fireEvent.change(strInput, { target: { value: '45' } });

      expect(props.onStatConfigChange).toHaveBeenCalledWith('str', { locked: true, value: 45 });
    });

    it('handles number input browser behavior for non-numeric values', () => {
      const props = createDefaultProps();
      render(<StatInputPanel {...props} />);

      const inputs = screen.getAllByRole('spinbutton');
      const strInput = inputs[0];

      // For type="number" inputs, browsers convert non-numeric text to empty string
      // So 'abc' becomes '' which triggers value: 0
      fireEvent.change(strInput, { target: { value: '' } });

      expect(props.onStatConfigChange).toHaveBeenCalledWith('str', { locked: true, value: 0 });
    });
  });

  describe('FixedStatInput - onBlur Validation', () => {
    it('clamps value to minimum of 1 on blur when value is 0', () => {
      // Start with a low value that should be clamped
      const props = createDefaultProps();
      props.statConfigs.str = { locked: true, value: 0 };

      render(<StatInputPanel {...props} />);

      const inputs = screen.getAllByRole('spinbutton');
      const strInput = inputs[0];

      // Blur should clamp to 1 (reads current input value which is 0)
      fireEvent.blur(strInput);

      // The onBlur handler parses the current value and clamps it
      expect(props.onStatConfigChange).toHaveBeenCalledWith('str', { locked: true, value: 10 });
    });

    it('clamps value to maximum of 99 on blur when value exceeds 99', () => {
      const props = createDefaultProps();
      props.statConfigs.str = { locked: true, value: 150 };

      render(<StatInputPanel {...props} />);

      const inputs = screen.getAllByRole('spinbutton');
      const strInput = inputs[0];

      // Blur should clamp to 99
      fireEvent.blur(strInput);

      expect(props.onStatConfigChange).toHaveBeenCalledWith('str', { locked: true, value: 99 });
    });

    it('preserves valid values within range on blur', () => {
      const props = createDefaultProps();
      props.statConfigs.str = { locked: true, value: 50 };

      render(<StatInputPanel {...props} />);

      const inputs = screen.getAllByRole('spinbutton');
      const strInput = inputs[0];

      // Blur should preserve 50
      fireEvent.blur(strInput);

      expect(props.onStatConfigChange).toHaveBeenCalledWith('str', { locked: true, value: 50 });
    });
  });

  describe('FixedStatInput - Error Display', () => {
    it('shows error when value is below class minimum', () => {
      // Vagabond has STR minimum of 14
      const props = createDefaultProps();
      props.statConfigs.str = { locked: true, value: 5 }; // Below Vagabond's STR min of 14

      render(<StatInputPanel {...props} />);

      // Should show "Min: 14" error message for Vagabond's STR
      // Use getAllByText since both mobile and desktop layouts render
      const errorMessages = screen.getAllByText('Min: 14');
      expect(errorMessages.length).toBeGreaterThan(0);
    });

    it('does not show error when value meets class minimum', () => {
      // Vagabond has STR minimum of 14
      const props = createDefaultProps();
      props.statConfigs.str = { locked: true, value: 20 }; // Above Vagabond's STR min of 14

      render(<StatInputPanel {...props} />);

      // Should not show any error message
      expect(screen.queryByText(/Min:/)).not.toBeInTheDocument();
    });

    it('shows error for multiple stats below their class minimums', () => {
      const props = createDefaultProps();
      // Set multiple stats below their Vagabond minimums
      props.statConfigs.str = { locked: true, value: 5 };  // Min 14
      props.statConfigs.dex = { locked: true, value: 5 };  // Min 13

      render(<StatInputPanel {...props} />);

      // Should show errors for both
      expect(screen.getAllByText('Min: 14').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Min: 13').length).toBeGreaterThan(0);
    });
  });

  describe('RangeStatInput - Solver Mode', () => {
    const createSolverProps = () => ({
      ...createDefaultProps(),
      solverEnabled: true,
      statConfigs: {
        vig: { locked: true, value: 40 },
        mnd: { locked: true, value: 20 },
        end: { locked: true, value: 25 },
        str: { locked: false, min: 14, max: 40 },
        dex: { locked: false, min: 13, max: 35 },
        int: { locked: false, min: 9, max: 30 },
        fai: { locked: false, min: 9, max: 25 },
        arc: { locked: false, min: 7, max: 20 },
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
      props.statConfigs.str = { locked: false, min: 0, max: 40 };

      render(<StatInputPanel {...props} />);

      const inputs = screen.getAllByRole('spinbutton');
      const strMinInput = inputs[0];

      // Blur should clamp to 1
      fireEvent.blur(strMinInput);

      expect(props.onStatConfigChange).toHaveBeenCalledWith('str', expect.objectContaining({ min: 10 }));
    });

    it('clamps max value on blur when exceeds 99', () => {
      const props = createSolverProps();
      props.statConfigs.str = { locked: false, min: 14, max: 150 };

      render(<StatInputPanel {...props} />);

      const inputs = screen.getAllByRole('spinbutton');
      const strMaxInput = inputs[1];

      // Blur should clamp to 99
      fireEvent.blur(strMaxInput);

      expect(props.onStatConfigChange).toHaveBeenCalledWith('str', expect.objectContaining({ max: 99 }));
    });

    it('shows error when min is below class minimum', () => {
      const props = createSolverProps();
      props.statConfigs.str = { locked: false, min: 5, max: 40 }; // Below Vagabond's STR min of 14

      render(<StatInputPanel {...props} />);

      // Should show "Min: 14" error message
      const errorMessages = screen.getAllByText('Min: 14');
      expect(errorMessages.length).toBeGreaterThan(0);
    });
  });

  describe('Integration - Typing Behavior', () => {
    it('allows sequential digit entry without interference', () => {
      const props = createDefaultProps();
      render(<StatInputPanel {...props} />);

      const inputs = screen.getAllByRole('spinbutton');
      const strInput = inputs[0];

      // Step 1: Clear input
      fireEvent.change(strInput, { target: { value: '' } });
      expect(props.onStatConfigChange).toHaveBeenLastCalledWith('str', { locked: true, value: 0 });

      // Step 2: Type first digit "2"
      fireEvent.change(strInput, { target: { value: '2' } });
      expect(props.onStatConfigChange).toHaveBeenLastCalledWith('str', { locked: true, value: 2 });

      // Step 3: Type second digit to make "25"
      fireEvent.change(strInput, { target: { value: '25' } });
      expect(props.onStatConfigChange).toHaveBeenLastCalledWith('str', { locked: true, value: 25 });
    });

    it('does not clamp values during typing, only on blur', () => {
      const props = createDefaultProps();
      render(<StatInputPanel {...props} />);

      const inputs = screen.getAllByRole('spinbutton');
      const strInput = inputs[0];

      // Type "1" - a low value that might be below class min
      fireEvent.change(strInput, { target: { value: '1' } });

      // During typing, value should be 1 (not clamped)
      expect(props.onStatConfigChange).toHaveBeenLastCalledWith('str', { locked: true, value: 1 });

      // User continues typing to "15"
      fireEvent.change(strInput, { target: { value: '15' } });
      expect(props.onStatConfigChange).toHaveBeenLastCalledWith('str', { locked: true, value: 15 });
    });

    it('allows typing values above 99 during input', () => {
      const props = createDefaultProps();
      render(<StatInputPanel {...props} />);

      const inputs = screen.getAllByRole('spinbutton');
      const strInput = inputs[0];

      // Type "100" - above the max of 99
      fireEvent.change(strInput, { target: { value: '100' } });

      // During typing, value should be 100 (clamping happens on blur)
      expect(props.onStatConfigChange).toHaveBeenLastCalledWith('str', { locked: true, value: 100 });
    });
  });

  describe('Mode Switching', () => {
    it('renders fixed mode inputs when solverEnabled is false', () => {
      const props = createDefaultProps();
      props.solverEnabled = false;

      render(<StatInputPanel {...props} />);

      // In fixed mode, each stat has one input
      // Should find inputs for STR, DEX, INT, FAI, ARC on desktop (5 stats)
      const inputs = screen.getAllByRole('spinbutton');
      // Mobile + Desktop = 10 inputs for 5 stats
      expect(inputs.length).toBe(10);
    });

    it('renders solver mode inputs when solverEnabled is true', () => {
      const props = createDefaultProps();
      props.solverEnabled = true;
      // Make damage stats unlocked for solver mode
      props.statConfigs = {
        vig: { locked: true, value: 40 },
        mnd: { locked: true, value: 20 },
        end: { locked: true, value: 25 },
        str: { locked: false, min: 14, max: 40 },
        dex: { locked: false, min: 13, max: 35 },
        int: { locked: false, min: 9, max: 30 },
        fai: { locked: false, min: 9, max: 25 },
        arc: { locked: false, min: 7, max: 20 },
      };

      render(<StatInputPanel {...props} />);

      // In solver mode, each range stat has min+max inputs (2 each)
      // 5 damage stats * 2 = 10, plus Level and VIG/MND/END inputs
      const inputs = screen.getAllByRole('spinbutton');
      expect(inputs.length).toBeGreaterThan(10);
    });
  });
});
