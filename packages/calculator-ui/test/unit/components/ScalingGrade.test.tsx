/**
 * ScalingGrade Component Tests
 * 
 * Tests for the ScalingGrade component that displays weapon scaling grades (S, A, B, C, D, E, -)
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScalingGrade } from '../../../src/components/ScalingGrade.js';

describe('ScalingGrade', () => {
  describe('Grade Rendering', () => {
    it('renders S grade with gold color', () => {
      render(<ScalingGrade grade="S" stat="STR" />);
      
      const container = screen.getByTitle('STR scaling: S');
      expect(container).toBeInTheDocument();
      expect(container).toHaveClass('text-[#d4af37]');
    });

    it('renders A grade with green color', () => {
      render(<ScalingGrade grade="A" stat="DEX" />);
      
      const container = screen.getByTitle('DEX scaling: A');
      expect(container).toHaveClass('text-[#7bc96f]');
    });

    it('renders B grade with blue color', () => {
      render(<ScalingGrade grade="B" stat="INT" />);
      
      const container = screen.getByTitle('INT scaling: B');
      expect(container).toHaveClass('text-[#5bc0de]');
    });

    it('renders C grade with purple-gray color', () => {
      render(<ScalingGrade grade="C" stat="FAI" />);
      
      const container = screen.getByTitle('FAI scaling: C');
      expect(container).toHaveClass('text-[#a8a8d8]');
    });

    it('renders D grade with gray color', () => {
      render(<ScalingGrade grade="D" stat="ARC" />);
      
      const container = screen.getByTitle('ARC scaling: D');
      expect(container).toHaveClass('text-[#8b8b8b]');
    });

    it('renders E grade with dark gray color', () => {
      render(<ScalingGrade grade="E" stat="STR" />);
      
      const container = screen.getByTitle('STR scaling: E');
      expect(container).toHaveClass('text-[#6a6a6a]');
    });

    it('renders - (no scaling) with very dark gray color', () => {
      render(<ScalingGrade grade="-" stat="INT" />);
      
      const container = screen.getByTitle('INT scaling: -');
      expect(container).toHaveClass('text-[#3a3a3a]');
    });
  });

  describe('Label Display', () => {
    it('shows stat label by default', () => {
      render(<ScalingGrade grade="A" stat="STR" />);
      
      expect(screen.getByText('STR')).toBeInTheDocument();
      expect(screen.getByText('A')).toBeInTheDocument();
    });

    it('hides stat label when showLabel is false', () => {
      render(<ScalingGrade grade="A" stat="STR" showLabel={false} />);
      
      expect(screen.queryByText('STR')).not.toBeInTheDocument();
      expect(screen.getByText('A')).toBeInTheDocument();
    });

    it('does not render title when showLabel is false', () => {
      render(<ScalingGrade grade="A" stat="STR" showLabel={false} />);
      
      // The title should be undefined when showLabel is false
      expect(screen.queryByTitle('STR scaling: A')).not.toBeInTheDocument();
    });
  });

  describe('Size Variants', () => {
    it('uses small size by default', () => {
      render(<ScalingGrade grade="S" stat="STR" />);
      
      const container = screen.getByTitle('STR scaling: S');
      expect(container).toHaveClass('text-xs');
      expect(container).toHaveClass('px-1.5');
    });

    it('uses large size when specified', () => {
      render(<ScalingGrade grade="S" stat="STR" size="lg" />);
      
      const container = screen.getByTitle('STR scaling: S');
      expect(container).toHaveClass('text-xl');
      expect(container).toHaveClass('px-2');
    });
  });

  describe('All Grade Types', () => {
    const grades = ['S', 'A', 'B', 'C', 'D', 'E', '-'] as const;
    
    grades.forEach(grade => {
      it(`renders grade "${grade}" correctly`, () => {
        render(<ScalingGrade grade={grade} stat="TEST" />);
        expect(screen.getByText(grade)).toBeInTheDocument();
      });
    });
  });
});
