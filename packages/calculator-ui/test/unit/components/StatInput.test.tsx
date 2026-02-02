/**
 * StatInput Component Tests
 * 
 * Tests for the StatInput component that handles locked/unlocked stat configuration
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StatInput } from '../../../src/components/StatInput.js';
import type { StatConfig } from '../../../src/types.js';

describe('StatInput', () => {
  const defaultLockedConfig: StatConfig = { min: 30, max: 30 };
  const defaultUnlockedConfig: StatConfig = { min: 20, max: 80 };

  describe('Locked Mode', () => {
    it('renders label correctly', () => {
      const onChange = vi.fn();
      render(
        <StatInput
          label="STR"
          stat="str"
          config={defaultLockedConfig}
          onChange={onChange}
          isDamageStat={true}
        />
      );
      
      expect(screen.getByText('STR')).toBeInTheDocument();
    });

    it('renders single input when locked', () => {
      const onChange = vi.fn();
      render(
        <StatInput
          label="STR"
          stat="str"
          config={defaultLockedConfig}
          onChange={onChange}
          isDamageStat={true}
        />
      );
      
      const inputs = screen.getAllByRole('spinbutton');
      expect(inputs).toHaveLength(1);
      expect(inputs[0]).toHaveValue(30);
    });

    it('calls onChange when value is changed', () => {
      const onChange = vi.fn();
      render(
        <StatInput
          label="STR"
          stat="str"
          config={defaultLockedConfig}
          onChange={onChange}
          isDamageStat={true}
        />
      );
      
      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '50' } });
      
      expect(onChange).toHaveBeenCalledWith({ min: 50, max: 50 });
    });

    it('shows lock icon when locked', () => {
      const onChange = vi.fn();
      render(
        <StatInput
          label="STR"
          stat="str"
          config={defaultLockedConfig}
          onChange={onChange}
          isDamageStat={true}
        />
      );
      
      const button = screen.getByTitle('Unlock (optimize)');
      expect(button).toBeInTheDocument();
    });
  });

  describe('Unlocked Mode', () => {
    it('renders min and max inputs when unlocked', () => {
      const onChange = vi.fn();
      render(
        <StatInput
          label="DEX"
          stat="dex"
          config={defaultUnlockedConfig}
          onChange={onChange}
          isDamageStat={true}
        />
      );
      
      const inputs = screen.getAllByRole('spinbutton');
      expect(inputs).toHaveLength(2);
      
      // Check min/max labels exist
      expect(screen.getByText('Min')).toBeInTheDocument();
      expect(screen.getByText('Max')).toBeInTheDocument();
    });

    it('displays correct min and max values', () => {
      const onChange = vi.fn();
      render(
        <StatInput
          label="DEX"
          stat="dex"
          config={defaultUnlockedConfig}
          onChange={onChange}
          isDamageStat={true}
        />
      );
      
      const inputs = screen.getAllByRole('spinbutton');
      expect(inputs[0]).toHaveValue(20); // min
      expect(inputs[1]).toHaveValue(80); // max
    });

    it('calls onChange when min is changed', () => {
      const onChange = vi.fn();
      render(
        <StatInput
          label="DEX"
          stat="dex"
          config={defaultUnlockedConfig}
          onChange={onChange}
          isDamageStat={true}
        />
      );
      
      const inputs = screen.getAllByRole('spinbutton');
      fireEvent.change(inputs[0], { target: { value: '15' } });
      
      expect(onChange).toHaveBeenCalledWith({ ...defaultUnlockedConfig, min: 15 });
    });

    it('calls onChange when max is changed', () => {
      const onChange = vi.fn();
      render(
        <StatInput
          label="DEX"
          stat="dex"
          config={defaultUnlockedConfig}
          onChange={onChange}
          isDamageStat={true}
        />
      );
      
      const inputs = screen.getAllByRole('spinbutton');
      fireEvent.change(inputs[1], { target: { value: '99' } });
      
      expect(onChange).toHaveBeenCalledWith({ ...defaultUnlockedConfig, max: 99 });
    });

    it('shows unlock icon when unlocked', () => {
      const onChange = vi.fn();
      render(
        <StatInput
          label="DEX"
          stat="dex"
          config={defaultUnlockedConfig}
          onChange={onChange}
          isDamageStat={true}
        />
      );
      
      const button = screen.getByTitle('Lock (fixed)');
      expect(button).toBeInTheDocument();
    });
  });

  describe('Lock Toggle', () => {
    it('converts to range when unlocking', async () => {
      const onChange = vi.fn();
      const config: StatConfig = { min: 40, max: 40 };
      
      render(
        <StatInput
          label="INT"
          stat="int"
          config={config}
          onChange={onChange}
          isDamageStat={true}
        />
      );
      
      const button = screen.getByTitle('Unlock (optimize)');
      fireEvent.click(button);
      
      // Should convert to range: min = value - 10, max = value + 10
      expect(onChange).toHaveBeenCalledWith({
        min: 30, // 40 - 10
        max: 50, // 40 + 10
      });
    });

    it('clamps min to 10 when unlocking low value', async () => {
      const onChange = vi.fn();
      const config: StatConfig = { min: 15, max: 15 };
      
      render(
        <StatInput
          label="INT"
          stat="int"
          config={config}
          onChange={onChange}
          isDamageStat={true}
        />
      );
      
      fireEvent.click(screen.getByTitle('Unlock (optimize)'));
      
      expect(onChange).toHaveBeenCalledWith({
        min: 10, // clamped to 10 (not 5)
        max: 25,
      });
    });

    it('clamps max to 99 when unlocking high value', async () => {
      const onChange = vi.fn();
      const config: StatConfig = { min: 95, max: 95 };
      
      render(
        <StatInput
          label="INT"
          stat="int"
          config={config}
          onChange={onChange}
          isDamageStat={true}
        />
      );
      
      fireEvent.click(screen.getByTitle('Unlock (optimize)'));
      
      expect(onChange).toHaveBeenCalledWith({
        min: 85,
        max: 99, // clamped to 99 (not 105)
      });
    });

    it('converts to locked value when locking', async () => {
      const onChange = vi.fn();
      const config: StatConfig = { min: 25, max: 75 };
      
      render(
        <StatInput
          label="INT"
          stat="int"
          config={config}
          onChange={onChange}
          isDamageStat={true}
        />
      );
      
      fireEvent.click(screen.getByTitle('Lock (fixed)'));
      
      // Should use min as the locked value
      expect(onChange).toHaveBeenCalledWith({
        min: 25,
        max: 25,
      });
    });
  });

  describe('Non-Damage Stats', () => {
    it('does not show lock/unlock button for non-damage stats', () => {
      const onChange = vi.fn();
      render(
        <StatInput
          label="VIG"
          stat="vig"
          config={defaultLockedConfig}
          onChange={onChange}
          isDamageStat={false}
        />
      );
      
      expect(screen.queryByTitle('Unlock (optimize)')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Lock (fixed)')).not.toBeInTheDocument();
    });
  });
});
