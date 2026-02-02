/**
 * Shared types for scaling curve components and hooks
 */

export interface ScalingDataPoint {
  level: number;
  [key: string]: number;
}

export interface ScalingStat {
  key: string;
  label: string;
  color: string;
}

export type ViewMode = 'total' | 'scaling' | 'perPoint';
