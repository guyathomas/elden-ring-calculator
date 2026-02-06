/**
 * Pre-compute Y-axis width from data so recharts skips DOM-based text measurement.
 *
 * Recharts' default behaviour: for every tick label it creates a hidden <span>,
 * inserts it into the DOM, calls getBoundingClientRect(), then removes it.
 * With multiple charts this causes hundreds of forced synchronous reflows.
 *
 * By providing an explicit `width` prop on <YAxis>, recharts skips that measurement.
 * We use CanvasRenderingContext2D.measureText() instead — zero reflow cost.
 */

let _ctx: CanvasRenderingContext2D | null = null;

function getCtx(): CanvasRenderingContext2D {
  if (!_ctx) {
    const canvas = document.createElement('canvas');
    _ctx = canvas.getContext('2d')!;
  }
  return _ctx;
}

function measureText(text: string, fontSize: number): number {
  const ctx = getCtx();
  // Match the default browser font stack used in the charts
  ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;
  return ctx.measureText(text).width;
}

/**
 * Resolve a potentially dot-separated path like "stats.str" or "statContributions.dex"
 */
function resolveValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/**
 * Generate "nice" tick values similar to what recharts/d3 would produce.
 * Returns the set of ticks that would appear on the axis.
 */
function niceTickValues(min: number, max: number, tickCount = 5): number[] {
  if (min === max) return [min];

  const range = max - min;
  const roughStep = range / tickCount;
  const exp = Math.floor(Math.log10(roughStep));
  const pow = Math.pow(10, exp);
  const frac = roughStep / pow;

  let niceStep: number;
  if (frac <= 1.5) niceStep = 1 * pow;
  else if (frac <= 3) niceStep = 2 * pow;
  else if (frac <= 7) niceStep = 5 * pow;
  else niceStep = 10 * pow;

  const niceMin = Math.floor(min / niceStep) * niceStep;
  const niceMax = Math.ceil(max / niceStep) * niceStep;

  const ticks: number[] = [];
  for (let v = niceMin; v <= niceMax + niceStep * 0.01; v += niceStep) {
    ticks.push(parseFloat(v.toPrecision(12)));
  }
  return ticks;
}

/**
 * Format a tick value the same way recharts does by default.
 */
function formatTick(value: number): string {
  // Recharts uses the raw number toString, but rounds for display
  // For integers or near-integers, show as integer
  if (Number.isInteger(value) || Math.abs(value - Math.round(value)) < 0.001) {
    return Math.round(value).toString();
  }
  // For decimals, show with reasonable precision
  return parseFloat(value.toPrecision(4)).toString();
}

export interface ComputeAxisWidthOptions {
  fontSize?: number;
  /** Extra padding in px (accounts for tick mark + spacing) */
  padding?: number;
  /** Custom tick formatter (if using tickFormatter on the axis) */
  tickFormatter?: (value: number) => string;
  /** Fixed domain [min, max] - skips scanning data */
  domain?: [number, number];
}

/**
 * Compute the pixel width needed for a Y-axis given the chart data.
 *
 * Scans data values, generates nice ticks, formats them, and measures with canvas.
 * Returns the width in px to pass as `<YAxis width={...} />`.
 */
export function computeYAxisWidth(
  data: readonly Record<string, any>[],
  dataKeys: string[],
  options: ComputeAxisWidthOptions = {},
): number {
  const { fontSize = 12, padding = 12, tickFormatter: formatter, domain } = options;

  let min: number;
  let max: number;

  if (domain) {
    [min, max] = domain;
  } else {
    min = Infinity;
    max = -Infinity;
    for (const point of data) {
      for (const key of dataKeys) {
        const val = resolveValue(point, key);
        if (typeof val === 'number' && isFinite(val)) {
          if (val < min) min = val;
          if (val > max) max = val;
        }
      }
    }
    // Fallback for empty data
    if (!isFinite(min)) return 60;
  }

  const ticks = niceTickValues(min, max);
  const format = formatter ?? formatTick;

  let maxWidth = 0;
  for (const tick of ticks) {
    const text = format(tick);
    const width = measureText(text, fontSize);
    if (width > maxWidth) maxWidth = width;
  }

  return Math.ceil(maxWidth) + padding;
}
