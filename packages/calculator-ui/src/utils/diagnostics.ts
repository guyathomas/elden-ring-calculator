/**
 * Sidebar loading diagnostics utility.
 *
 * Measures and logs performance timings for data loading, parsing,
 * React component rendering, and expensive computations.
 *
 * Enable by adding ?diagnostics to the URL or setting
 * window.__SIDEBAR_DIAGNOSTICS = true in the console before load.
 *
 * Results are logged to the console as a grouped table and also
 * accessible via performance.getEntriesByType('measure').
 */

declare global {
  interface Window {
    __SIDEBAR_DIAGNOSTICS?: boolean;
  }
}

/** Check whether diagnostics are enabled */
export function isDiagnosticsEnabled(): boolean {
  if (typeof window === "undefined") return false;
  if (window.__SIDEBAR_DIAGNOSTICS) return true;
  try {
    return new URL(window.location.href).searchParams.has("diagnostics");
  } catch {
    return false;
  }
}

interface TimingEntry {
  label: string;
  duration: number;
  category: "data-load" | "parse" | "render" | "memo" | "mount";
}

const timings: TimingEntry[] = [];

/** Record a timing entry using the Performance API */
function record(
  label: string,
  category: TimingEntry["category"],
  startMark: string,
  endMark: string,
) {
  try {
    performance.measure(label, startMark, endMark);
    const entries = performance.getEntriesByName(label, "measure");
    const entry = entries[entries.length - 1];
    if (entry) {
      timings.push({ label, duration: entry.duration, category });
    }
  } catch {
    // Silently ignore if marks are missing
  }
}

/** Start a named timing span. Returns a function to call when done. */
export function startTiming(
  label: string,
  category: TimingEntry["category"],
): () => void {
  if (!isDiagnosticsEnabled()) return () => {};

  const markStart = `diag:${label}:start`;
  const markEnd = `diag:${label}:end`;
  performance.mark(markStart);

  return () => {
    performance.mark(markEnd);
    record(label, category, markStart, markEnd);
  };
}

/**
 * Wrap an async function with timing diagnostics.
 * Returns the same promise result with timing recorded.
 */
export function timeAsync<T>(
  label: string,
  category: TimingEntry["category"],
  fn: () => Promise<T>,
): Promise<T> {
  if (!isDiagnosticsEnabled()) return fn();

  const done = startTiming(label, category);
  return fn().then(
    (result) => {
      done();
      return result;
    },
    (err) => {
      done();
      throw err;
    },
  );
}

/**
 * Wrap a synchronous function with timing diagnostics.
 * Returns the same result with timing recorded.
 */
export function timeSync<T>(
  label: string,
  category: TimingEntry["category"],
  fn: () => T,
): T {
  if (!isDiagnosticsEnabled()) return fn();

  const done = startTiming(label, category);
  const result = fn();
  done();
  return result;
}

/** Print all collected timings to the console as a grouped table */
export function printDiagnostics() {
  if (!isDiagnosticsEnabled() || timings.length === 0) return;

  const categories = ["data-load", "parse", "memo", "render", "mount"] as const;

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
  console.groupEnd();
}

/**
 * React Profiler onRender callback for diagnostics.
 * Logs render timings for wrapped components.
 *
 * Usage:
 *   <Profiler id="Sidebar" onRender={onRenderCallback}>
 *     <SidebarBody ... />
 *   </Profiler>
 */
export function onRenderCallback(
  id: string,
  phase: "mount" | "update" | "nested-update",
  actualDuration: number,
  baseDuration: number,
  startTime: number,
  commitTime: number,
) {
  if (!isDiagnosticsEnabled()) return;

  const category: TimingEntry["category"] =
    phase === "mount" ? "mount" : "render";
  timings.push({
    label: `<${id}> ${phase}`,
    duration: actualDuration,
    category,
  });

  console.log(
    `%c[Profiler] %c<${id}> %c${phase}%c actual=${actualDuration.toFixed(2)}ms base=${baseDuration.toFixed(2)}ms commit=${(commitTime - startTime).toFixed(2)}ms`,
    "color: #d4af37",
    "color: #e8e6e3; font-weight: bold",
    `color: ${phase === "mount" ? "#4ade80" : "#60a5fa"}`,
    "color: #8b8b8b",
  );
}

/** Reset all collected timings (useful between navigations) */
export function resetDiagnostics() {
  timings.length = 0;
  // Clean up performance marks and measures
  try {
    for (const e of performance
      .getEntriesByType("mark")
      .filter((e) => e.name.startsWith("diag:"))) {
      performance.clearMarks(e.name);
    }
    for (const e of performance
      .getEntriesByType("measure")
      .filter((e) => timings.some((t) => t.label === e.name))) {
      performance.clearMeasures(e.name);
    }
  } catch {
    // Ignore cleanup errors
  }
}
