/**
 * Hook for managing the solver web worker lifecycle.
 *
 * Provides an async interface to the solver that runs off the main thread,
 * keeping the UI responsive during expensive optimizations.
 *
 * Falls back to main thread execution if Web Workers are unavailable.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import * as Comlink from 'comlink';
import type { SolverWorkerApi, FindOptimalStatsParams } from '../workers/solver.worker';
import type { PrecomputedDataV2, OptimalStats } from '../types';
import type { PrecomputedAowData } from '../data/index';
import { findOptimalStats as findOptimalStatsSync } from '../utils/damageCalculator';

// Vite's worker import syntax - creates an inline worker
import SolverWorker from '../workers/solver.worker?worker';

export interface UseSolverWorkerOptions {
  /** Precomputed weapon data to initialize the worker with */
  precomputed: PrecomputedDataV2;
  /** Precomputed AoW data for AoW optimization mode */
  aowData: PrecomputedAowData | null;
}

export interface UseSolverWorkerResult {
  /** Whether the solver is ready (worker or fallback) */
  isReady: boolean;
  /** Whether a solve operation is currently in progress */
  isCalculating: boolean;
  /** Find optimal stats (async, runs in worker or main thread fallback) */
  findOptimalStats: (params: FindOptimalStatsParams) => Promise<OptimalStats | null>;
  /** Any error that occurred */
  error: Error | null;
  /** Whether using main thread fallback (for debugging/UI) */
  isUsingFallback: boolean;
}

/**
 * Check if Web Workers are supported in current environment
 */
function supportsWebWorkers(): boolean {
  return typeof Worker !== 'undefined';
}

/**
 * Hook that manages a solver web worker instance.
 *
 * The worker is initialized once with precomputed data, then reused
 * for all solver requests during the component's lifetime.
 *
 * If Web Workers are unavailable or fail to initialize, automatically
 * falls back to running the solver on the main thread.
 *
 * @example
 * ```tsx
 * const { isReady, isCalculating, findOptimalStats } = useSolverWorker({ precomputed });
 *
 * useEffect(() => {
 *   if (!isReady) return;
 *   findOptimalStats({ weaponName, affinity, ... }).then(setOptimalStats);
 * }, [isReady, weaponName, ...]);
 * ```
 */
export function useSolverWorker({ precomputed, aowData }: UseSolverWorkerOptions): UseSolverWorkerResult {
  const workerRef = useRef<Worker | null>(null);
  const apiRef = useRef<Comlink.Remote<SolverWorkerApi> | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isUsingFallback, setIsUsingFallback] = useState(false);

  // Track the current request to handle race conditions
  const currentRequestId = useRef(0);

  // Store refs for fallback mode
  const precomputedRef = useRef(precomputed);
  const aowDataRef = useRef(aowData);
  useEffect(() => {
    precomputedRef.current = precomputed;
    aowDataRef.current = aowData;
  }, [precomputed, aowData]);

  // Initialize worker on mount (or enable fallback if unavailable)
  useEffect(() => {
    let mounted = true;

    const initWorker = async () => {
      // Check if Web Workers are supported
      if (!supportsWebWorkers()) {
        console.warn('Web Workers not supported, using main thread fallback');
        if (mounted) {
          setIsUsingFallback(true);
          setIsReady(true);
        }
        return;
      }

      try {
        // Create worker instance
        const worker = new SolverWorker();
        workerRef.current = worker;

        // Wrap with Comlink for typed async API
        const api = Comlink.wrap<SolverWorkerApi>(worker);
        apiRef.current = api;

        // Initialize with precomputed weapon and AoW data
        await api.initialize(precomputed, aowData);

        if (mounted) {
          setIsReady(true);
          setIsUsingFallback(false);
          setError(null);
        }
      } catch (err) {
        console.warn('Worker initialization failed, using main thread fallback:', err);
        if (mounted) {
          // Fall back to main thread instead of failing
          setIsUsingFallback(true);
          setIsReady(true);
          setError(null); // Don't report error since fallback is working
        }
      }
    };

    initWorker();

    // Cleanup on unmount
    return () => {
      mounted = false;
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
      apiRef.current = null;
    };
  }, [precomputed, aowData]);

  // Async function to run solver (in worker or main thread)
  const findOptimalStats = useCallback(
    async (params: FindOptimalStatsParams): Promise<OptimalStats | null> => {
      if (!isReady) {
        return null;
      }

      // Increment request ID to track the latest request
      const requestId = ++currentRequestId.current;
      setIsCalculating(true);
      setError(null);

      try {
        let result: OptimalStats;

        if (isUsingFallback) {
          // Main thread fallback - run synchronously but wrap in Promise for consistent API
          result = findOptimalStatsSync(
            precomputedRef.current,
            params.weaponName,
            params.affinity,
            params.upgradeLevel,
            params.statConfigs,
            {
              ...params.options,
              aowData: aowDataRef.current,
            }
          );
        } else if (apiRef.current) {
          // Worker path
          result = await apiRef.current.findOptimalStats(params);
        } else {
          throw new Error('No solver available');
        }

        // Only update if this is still the latest request
        if (requestId === currentRequestId.current) {
          setIsCalculating(false);
          return result;
        }
        return null;
      } catch (err) {
        // Only update error if this is still the latest request
        if (requestId === currentRequestId.current) {
          setError(err instanceof Error ? err : new Error('Solver failed'));
          setIsCalculating(false);
        }
        return null;
      }
    },
    [isReady, isUsingFallback]
  );

  return {
    isReady,
    isCalculating,
    findOptimalStats,
    error,
    isUsingFallback,
  };
}
