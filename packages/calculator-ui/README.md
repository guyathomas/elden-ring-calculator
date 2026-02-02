# @elden-ring-calculator/calculator-ui

React web interface for the Elden Ring Weapon Calculator.

## Features

- Weapon list with filtering by type, affinity, and scaling grade
- Sortable columns and search
- Weapon detail panel with full damage breakdown
- Scaling curves and affinity comparison charts
- Stat optimizer (brute-force and solver-based)
- Ash of War damage tables and scaling curves
- Attack combos, DPS tables, and animation timelines
- Status effect and catalyst spell scaling curves
- Build management with localStorage persistence and URL sharing
- Responsive mobile layout

## Development

```bash
yarn dev          # Start dev server (generates precomputed data if missing)
yarn build        # Production build
yarn test         # Run unit and integration tests
yarn test:e2e     # Run Playwright e2e tests
```

## Architecture

The UI consumes precomputed data generated from `@elden-ring-calculator/calculator-core` at build time. AR calculations run client-side using the core package's browser-safe `client` export. Stat optimization runs in a Web Worker to avoid blocking the UI thread.

```
Build time:
  generate-precomputed.ts → precomputed.msgpack.gz, aow-precomputed.msgpack.gz, ...

Runtime:
  App.tsx → useScalingData / useSolverWorker → calculator-core/client → UI components
```

## Tech Stack

- React 18, Vite, TypeScript
- Tailwind CSS 4, shadcn/ui (Radix primitives)
- Recharts for data visualization
- Comlink for Web Worker communication
- Playwright for e2e testing, Vitest for unit/integration
