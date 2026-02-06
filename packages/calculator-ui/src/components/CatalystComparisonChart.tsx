/**
 * Catalyst Spell Scaling Comparison Chart
 *
 * Compares optimal spell power investment paths across all catalysts
 * of the same type (staffs or seals). Uses precomputed SP curves
 * generated at build time (from a fixed all-stats-at-1 baseline).
 */

import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import catalystSPCurvesData from "../data/catalyst-sp-curves.json";
import type {
  CharacterStats,
  PrecomputedDataV2,
  WeaponListItem,
} from "../types";
import { computeYAxisWidth } from "../utils/axisWidth";

// ============================================================================
// Constants
// ============================================================================

const CHART_COLORS = {
  grid: "#2a2a2a",
  axis: "#6a6a6a",
  axisLabel: "#8b8b8b",
  currentStatMarker: "#d4af37",
  currentWeapon: "#4ade80",
} as const;

/** Color palette for comparison lines (distinct from currentWeapon green) */
const LINE_PALETTE = [
  "#3b82f6",
  "#f59e0b",
  "#ef4444",
  "#a855f7",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
  "#f97316",
  "#8b5cf6",
  "#14b8a6",
  "#e11d48",
  "#0ea5e9",
  "#eab308",
  "#6366f1",
  "#10b981",
  "#f43f5e",
  "#22d3ee",
  "#a3e635",
  "#d946ef",
  "#0891b2",
  "#dc2626",
  "#65a30d",
  "#7c3aed",
  "#db2777",
  "#0d9488",
  "#ea580c",
  "#4f46e5",
  "#16a34a",
  "#be185d",
] as const;

/** Sample interval for chart data points (every Nth budget point) */
const SAMPLE_INTERVAL = 2;

const catalystSPCurves = catalystSPCurvesData as Record<string, number[]>;

// ============================================================================
// Types
// ============================================================================

export interface CatalystComparisonChartProps {
  precomputed: PrecomputedDataV2;
  weapon: WeaponListItem;
  currentStats: CharacterStats;
  allWeapons: WeaponListItem[];
}

interface CatalystPathInfo {
  name: string;
  path: number[];
  maxSP: number;
  isCurrent: boolean;
  color: string;
}

// ============================================================================
// Custom Tooltip
// ============================================================================

interface ComparisonTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  label?: number;
  currentWeaponName: string;
}

function ComparisonTooltip({
  active,
  payload,
  label,
  currentWeaponName,
}: ComparisonTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  const sorted = [...payload]
    .filter((p) => p.value !== undefined && p.value !== null)
    .sort((a, b) => (b.value as number) - (a.value as number));

  const MAX_SHOWN = 10;
  const shown = sorted.slice(0, MAX_SHOWN);
  const currentEntry = sorted.find((e) => e.name === currentWeaponName);
  const currentInShown = shown.some((e) => e.name === currentWeaponName);
  const remaining = sorted.length - MAX_SHOWN;

  return (
    <div className="bg-[#1a1a1a] border border-[#3a3a3a] rounded-lg p-3 text-xs">
      <div className="text-[#d4af37] font-medium mb-2 text-sm">
        {label} Points Invested
      </div>
      <div className="space-y-0.5">
        {shown.map((entry) => {
          const isCurrent = entry.name === currentWeaponName;
          return (
            <div
              key={entry.name}
              className={`flex justify-between gap-3 ${isCurrent ? "font-bold" : ""}`}
            >
              <span
                className="truncate"
                style={{ color: entry.color, maxWidth: "180px" }}
              >
                {isCurrent ? "\u25B8 " : ""}
                {entry.name}
              </span>
              <span className="text-[#c8c8c8] font-mono tabular-nums">
                {Math.round(entry.value)}
              </span>
            </div>
          );
        })}
        {!currentInShown && currentEntry && remaining > 0 && (
          <>
            <div className="text-[#4a4a4a] text-center">&hellip;</div>
            <div className="flex justify-between gap-3 font-bold">
              <span
                className="truncate"
                style={{ color: currentEntry.color, maxWidth: "180px" }}
              >
                {"\u25B8 "}
                {currentEntry.name}
              </span>
              <span className="text-[#c8c8c8] font-mono tabular-nums">
                {Math.round(currentEntry.value)}
              </span>
            </div>
          </>
        )}
        {remaining > 0 && (
          <div className="text-[#4a4a4a] text-center pt-1">
            +{remaining} more
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function CatalystComparisonChart({
  precomputed,
  weapon,
  currentStats,
  allWeapons,
}: CatalystComparisonChartProps) {
  // Find all same-category catalysts with precomputed curves, deduplicated by name
  const catalystPaths = useMemo((): CatalystPathInfo[] => {
    const seen = new Set<string>();
    const paths: CatalystPathInfo[] = [];

    for (const w of allWeapons) {
      if (w.categoryName !== weapon.categoryName) continue;
      if (!w.hasSorceryScaling && !w.hasIncantationScaling) continue;
      if (seen.has(w.name)) continue;
      seen.add(w.name);

      const path = catalystSPCurves[w.name];
      if (!path || path.length === 0) continue;

      paths.push({
        name: w.name,
        path,
        maxSP: path[path.length - 1],
        isCurrent: w.name === weapon.name,
        color: "",
      });
    }

    // Ensure current weapon is included
    if (!seen.has(weapon.name)) {
      const path = catalystSPCurves[weapon.name];
      if (path && path.length > 0) {
        paths.push({
          name: weapon.name,
          path,
          maxSP: path[path.length - 1],
          isCurrent: true,
          color: "",
        });
      }
    }

    // Sort: current weapon first, then by max SP descending
    paths.sort((a, b) => {
      if (a.isCurrent) return -1;
      if (b.isCurrent) return 1;
      return b.maxSP - a.maxSP;
    });

    // Assign colors
    let colorIdx = 0;
    for (const p of paths) {
      if (p.isCurrent) {
        p.color = CHART_COLORS.currentWeapon;
      } else {
        p.color = LINE_PALETTE[colorIdx % LINE_PALETTE.length];
        colorIdx++;
      }
    }

    return paths;
  }, [allWeapons, weapon]);

  // Merge paths into Recharts data format (sampled for performance)
  const chartData = useMemo(() => {
    if (catalystPaths.length === 0) return [];

    const maxBudget = Math.max(...catalystPaths.map((p) => p.path.length - 1));
    if (maxBudget <= 0) return [];

    const data: Record<string, number>[] = [];
    for (let budget = 0; budget <= maxBudget; budget += SAMPLE_INTERVAL) {
      const point: Record<string, number> = { pointsInvested: budget };
      for (const cat of catalystPaths) {
        const idx = Math.min(budget, cat.path.length - 1);
        point[cat.name] = cat.path[idx];
      }
      data.push(point);
    }

    // Ensure last point is included
    if (maxBudget % SAMPLE_INTERVAL !== 0) {
      const point: Record<string, number> = { pointsInvested: maxBudget };
      for (const cat of catalystPaths) {
        point[cat.name] = cat.path[cat.path.length - 1];
      }
      data.push(point);
    }

    return data;
  }, [catalystPaths]);

  // Calculate current stat investment for reference line (relative to baseline of 1)
  const currentInvestment = useMemo(() => {
    // Get spell scaling stats for the current weapon
    const weaponData = precomputed.weapons[weapon.name];
    const affinityData = weaponData?.affinities[weapon.affinity];
    if (!affinityData) return 0;

    const spellScaling =
      affinityData.sorceryScaling ?? affinityData.incantationScaling;
    if (!spellScaling) return 0;

    const statMap = {
      str: "strength",
      dex: "dexterity",
      int: "intelligence",
      fai: "faith",
      arc: "arcane",
    } as const;

    let total = 0;
    for (const [short, long] of Object.entries(statMap)) {
      if ((spellScaling as unknown as Record<string, unknown>)[long] !== null) {
        total += Math.max(0, currentStats[short as keyof CharacterStats] - 1);
      }
    }
    return total;
  }, [precomputed, weapon, currentStats]);

  const yAxisWidth = useMemo(() => {
    if (chartData.length === 0) return 60;
    const dataKeys = catalystPaths.map(c => c.name);
    return computeYAxisWidth(chartData, dataKeys);
  }, [chartData, catalystPaths]);

  // Don't render if fewer than 2 catalysts to compare
  if (catalystPaths.length < 2) return null;

  const maxBudget =
    chartData.length > 0 ? chartData[chartData.length - 1].pointsInvested : 0;

  // Render order: non-current catalysts first, then current weapon on top
  const otherPaths = catalystPaths.filter((c) => !c.isCurrent);
  const currentPath = catalystPaths.find((c) => c.isCurrent);

  return (
    <div>
      <h3 className="text-[#8b8b8b] uppercase tracking-wider text-xs mb-3">
        Catalyst Comparison
      </h3>
      <p className="text-[#6a6a6a] text-xs mb-4">
        Optimal spell scaling for each {weapon.categoryName.toLowerCase()} at
        each investment level
      </p>

      <ResponsiveContainer width="100%" height={350}>
        <LineChart
          data={chartData}
          margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
          <XAxis
            dataKey="pointsInvested"
            type="number"
            interval={0}
            domain={[0, "dataMax"]}
            tickCount={10}
            stroke={CHART_COLORS.axis}
            tick={{ fill: CHART_COLORS.axis, fontSize: 12 }}
            label={{
              value: "Points Invested",
              position: "insideBottom",
              offset: -5,
              fill: CHART_COLORS.axisLabel,
              fontSize: 11,
            }}
          />
          <YAxis
            width={yAxisWidth}
            interval={0}
            stroke={CHART_COLORS.axis}
            tick={{ fill: CHART_COLORS.axis, fontSize: 12 }}
            label={{
              value: "Spell Power",
              angle: -90,
              position: "insideLeft",
              fill: CHART_COLORS.axisLabel,
              fontSize: 11,
            }}
          />
          <Tooltip
            content={<ComparisonTooltip currentWeaponName={weapon.name} />}
          />
          {/* Non-current catalysts rendered first (behind) */}
          {otherPaths.map((cat) => (
            <Line
              key={cat.name}
              type="monotone"
              dataKey={cat.name}
              name={cat.name}
              stroke={cat.color}
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3 }}
              opacity={0.7}
            />
          ))}
          {/* Current weapon rendered last (on top) */}
          {currentPath && (
            <Line
              type="monotone"
              dataKey={currentPath.name}
              name={currentPath.name}
              stroke={currentPath.color}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4 }}
            />
          )}
          {currentInvestment > 0 && currentInvestment <= maxBudget && (
            <ReferenceLine
              x={currentInvestment}
              stroke={CHART_COLORS.currentStatMarker}
              strokeDasharray="5 5"
              label={{
                value: "Current",
                position: "top",
                fill: CHART_COLORS.currentStatMarker,
                fontSize: 10,
              }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
