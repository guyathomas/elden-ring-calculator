/**
 * WeaponDetail panel loading diagnostics.
 *
 * Always active — logs a timing summary to the console every time the
 * weapon detail slideout opens.
 *
 * Console helpers:
 *   __diag.timings   — raw timing entries for the most recent open
 */

declare global {
  interface Window {
    __diag: {
      timings: TimingEntry[];
    };
  }
}

type TimingCategory = "data-load" | "compute" | "render";

interface TimingEntry {
  label: string;
  duration: number;
  category: TimingCategory;
}

let timings: TimingEntry[] = [];

// Expose on window for console inspection
if (typeof window !== "undefined") {
  window.__diag = { timings };
}

/** Start a named timing span. Returns a stop function. */
export function startTiming(
  label: string,
  category: TimingCategory,
): () => void {
  const start = performance.now();
  return () => {
    timings.push({ label, duration: performance.now() - start, category });
  };
}

/** Time a synchronous function. */
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

/** React Profiler onRender callback — records render timing. */
export function onRenderCallback(
  id: string,
  phase: "mount" | "update" | "nested-update",
  actualDuration: number,
) {
  timings.push({
    label: `<${id}> ${phase}`,
    duration: actualDuration,
    category: phase === "mount" ? "render" : "render",
  });
}

/** Clear timings (call when a new weapon detail opens). */
export function resetDiagnostics() {
  timings = [];
  if (typeof window !== "undefined") {
    window.__diag.timings = timings;
  }
}

/** Print the current timing summary to the console. */
export function printDiagnostics() {
  if (timings.length === 0) return;

  const categories: TimingCategory[] = ["data-load", "compute", "render"];
  const categoryLabels: Record<TimingCategory, string> = {
    "data-load": "Data Loading",
    compute: "Computation",
    render: "React Render",
  };

  console.group(
    "%c[WeaponDetail Diagnostics]",
    "color: #d4af37; font-weight: bold; font-size: 13px",
  );

  for (const cat of categories) {
    const entries = timings.filter((t) => t.category === cat);
    if (entries.length === 0) continue;

    console.group(
      `%c${categoryLabels[cat]}`,
      "color: #8b8b8b; font-weight: bold",
    );
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
    `%cTotal: ${Math.round(total * 100) / 100}ms`,
    "color: #d4af37; font-weight: bold",
  );
  console.groupEnd();
}
