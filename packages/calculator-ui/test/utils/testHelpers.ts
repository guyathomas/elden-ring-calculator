/**
 * Test Utilities for Calculator UI
 * 
 * Provides mock data factories and render helpers for component tests.
 */

import { render, RenderOptions } from '@testing-library/react';
import type { ReactElement } from 'react';
import type { StatConfig, StartingClass } from '../../src/types.js';

// ============================================================================
// Mock Data Factories
// ============================================================================

/**
 * Creates default stat configs for testing
 */
export function createMockStatConfigs(overrides?: Partial<Record<string, StatConfig>>): Record<string, StatConfig> {
  const defaults: Record<string, StatConfig> = {
    vig: { locked: true, value: 40 },
    mnd: { locked: true, value: 20 },
    end: { locked: true, value: 25 },
    str: { locked: true, value: 20 },
    dex: { locked: true, value: 20 },
    int: { locked: true, value: 10 },
    fai: { locked: true, value: 10 },
    arc: { locked: true, value: 10 },
  };
  
  if (overrides) {
    Object.entries(overrides).forEach(([key, value]) => {
      if (value !== undefined) {
        defaults[key] = value;
      }
    });
  }
  
  return defaults;
}

/**
 * Creates mock weapon type options
 */
export function createMockWeaponTypes() {
  return [
    { label: 'Dagger', value: 'Dagger' },
    { label: 'Straight Sword', value: 'Straight Sword' },
    { label: 'Greatsword', value: 'Greatsword' },
    { label: 'Katana', value: 'Katana' },
  ];
}

/**
 * Creates mock affinity options
 */
export function createMockAffinities() {
  return [
    { label: 'Standard', value: 'Standard' },
    { label: 'Heavy', value: 'Heavy' },
    { label: 'Keen', value: 'Keen' },
    { label: 'Quality', value: 'Quality' },
    { label: 'Fire', value: 'Fire' },
    { label: 'Magic', value: 'Magic' },
  ];
}

/**
 * Default starting class for tests
 */
export const DEFAULT_STARTING_CLASS: StartingClass = 'Vagabond';

// ============================================================================
// Render Helpers
// ============================================================================

/**
 * Custom render function that wraps components with necessary providers
 * Currently no providers needed, but this is the extension point
 */
export function customRender(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, { ...options });
}

// Re-export everything from testing-library
export * from '@testing-library/react';

// Override render with our custom render
export { customRender as render };

// ============================================================================
// Test Matchers / Assertions
// ============================================================================

/**
 * Helper to check if an element has specific CSS classes
 */
export function hasClasses(element: HTMLElement, ...classNames: string[]): boolean {
  return classNames.every(cls => element.classList.contains(cls));
}

/**
 * Helper to find input by label text
 */
export function getInputByLabel(container: HTMLElement, labelText: string): HTMLInputElement | null {
  const label = container.querySelector(`label:has-text("${labelText}")`);
  if (!label) return null;
  const input = label.querySelector('input');
  return input as HTMLInputElement | null;
}
