/**
 * Sidebar loading diagnostics utility.
 *
 * Timing data is ALWAYS recorded (negligible overhead — just performance.now()
 * calls and a handful of array pushes during page load). Console output is only
 * produced when diagnostics are enabled.
 *
 * Enable diagnostics:
 *   1. Add ?diagnostics to the URL before loading, OR
 *   2. Run  __diag.print()  in the console at any time (works retroactively)
 *
 * Console helpers (available on window):
 *   __diag.print()   — print the timing table
 *   __diag.reset()   — clear collected timings
 *   __diag.timings   — raw timing entries array
 */

declare global {
  interface Window {
    __SIDEBAR_DIAGNOSTICS?: boolean;
    __diag: {
      print: () => void;
      reset: () => void;
      timings: TimingEntry[];
    };
  }
}

type TimingCategory = "data-load" | "parse" | "render" | "memo" | "mount";

interface TimingEntry {
  label: string;
  duration: number;
  category: TimingCategory;
}

/** All collected timing entries — always populated regardless of flag */
const timings: TimingEntry[] = [];

/** Whether verbose console output (per-event logs) is active */
function isVerbose(): boolean {
  if (typeof window === "undefined") return false;
  if (window.__SIDEBAR_DIAGNOSTICS) return true;
  try {
    return new URL(window.location.href).searchParams.has("diagnostics");
  } catch {
    return false;
  }
}

// Expose console helpers on window immediately
if (typeof window !== "undefined") {
  window.__diag = {
    print: printDiagnostics,
    reset: resetDiagnostics,
    timings,
  };
}

/**
 * Start a named timing span. Returns a function to call when done.
 * Always records timing data. Console output only when verbose.
 */
export function startTiming(
  label: string,
  category: TimingCategory,
): () => void {
  const start = performance.now();

  return () => {
    const duration = performance.now() - start;
    timings.push({ label, duration, category });
  };
}

/**
 * Wrap a synchronous function with timing diagnostics.
 * Always records timing data.
 */
export function timeSync<T>(
  label: string,
  category: TimingCategory,
  fn: () => T,
): T {
  const done = startTiming(label, category);
  const result = fn();
  done();
  return result;
}

/**
 * React Profiler onRender callback.
 * Always records timing data. Logs to console only when verbose.
 */
export function onRenderCallback(
  id: string,
  phase: "mount" | "update" | "nested-update",
  actualDuration: number,
  baseDuration: number,
  startTime: number,
  commitTime: number,
) {
  const category: TimingCategory = phase === "mount" ? "mount" : "render";
  timings.push({
    label: `<${id}> ${phase}`,
    duration: actualDuration,
    category,
  });

  if (isVerbose()) {
    console.log(
      `%c[Profiler] %c<${id}> %c${phase}%c actual=${actualDuration.toFixed(2)}ms base=${baseDuration.toFixed(2)}ms commit=${(commitTime - startTime).toFixed(2)}ms`,
      "color: #d4af37",
      "color: #e8e6e3; font-weight: bold",
      `color: ${phase === "mount" ? "#4ade80" : "#60a5fa"}`,
      "color: #8b8b8b",
    );
  }
}

/** Print all collected timings to the console as a grouped table */
export function printDiagnostics() {
  if (timings.length === 0) {
    console.log(
      "%c[Sidebar Diagnostics]%c No timing data collected yet.",
      "color: #d4af37; font-weight: bold",
      "color: #8b8b8b",
    );
    return;
  }

  const categories: TimingCategory[] = [
    "data-load",
    "parse",
    "memo",
    "render",
    "mount",
  ];

  console.group(
    "%c[Sidebar Diagnostics]",
    "color: #d4af37; font-weight: bold; font-size: 14px",
  );

  for (const cat of categories) {
    const entries = timings.filter((t) => t.category === cat);
    if (entries.length === 0) continue;

    console.group(`%c${cat}`, "color: #8b8b8b; font-weight: bold");
    console.table(
      entries.map((e) => ({
        Label: e.label,
        "Duration (ms)": Math.round(e.duration * 100) / 100,
      })),
    );
    console.groupEnd();
  }

  const total = timings.reduce((sum, t) => sum + t.duration, 0);
  console.log(
    `%cTotal measured: ${Math.round(total * 100) / 100}ms`,
    "color: #d4af37; font-weight: bold",
  );
  console.log("%cTip: raw data available at  __diag.timings", "color: #6a6a6a");
  console.groupEnd();
}

/** Check whether verbose console output is enabled (for loadData size logs) */
export function isDiagnosticsEnabled(): boolean {
  return isVerbose();
}

/** Reset all collected timings */
export function resetDiagnostics() {
  timings.length = 0;
}
