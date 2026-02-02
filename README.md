# Elden Ring Calculator

A game-accurate weapon damage calculator for Elden Ring, built as a monorepo with a calculation engine and React web UI.

## Packages

| Package | Description |
|---------|-------------|
| [`@elden-ring-calculator/calculator-core`](packages/calculator-core) | AR, Ash of War, combo, and enemy damage calculators using game param files |
| [`@elden-ring-calculator/calculator-ui`](packages/calculator-ui) | React web interface with weapon comparison, stat optimization, and build management |

## Quick Start

```bash
yarn install
yarn build
yarn dev        # Start the UI dev server
```

## Development

```bash
yarn build       # Build all packages
yarn test        # Run all tests
yarn lint        # Lint with Biome
yarn format      # Format with Biome
```

## Project Structure

```
packages/
├── calculator-core/           # Calculation engine
│   ├── param-files/           # 194 Elden Ring game param XML files
│   ├── data/                  # Weapon, animation, and enemy data
│   ├── src/
│   │   ├── paramParser.ts     # XML param file parsing
│   │   ├── paramBuilder.ts    # Build-time precomputed data generation
│   │   ├── calculator.ts      # AR calculation with curve interpolation
│   │   ├── client.ts          # Browser-safe exports (no fs)
│   │   ├── aowCalculator.ts   # Ash of War damage calculator
│   │   ├── comboCalculator.ts # Attack combo and DPS calculator
│   │   └── enemyDamageCalculator.ts
│   └── test/                  # Validation against 2600+ game-verified test cases
│
├── calculator-ui/             # React web interface
│   ├── src/
│   │   ├── components/        # Weapon list, charts, stat optimizer, build manager
│   │   ├── data/              # Precomputed data files (generated at build time)
│   │   ├── hooks/             # React hooks for scaling, solver, builds
│   │   ├── utils/             # Solver, damage calculator, optimizer
│   │   └── workers/           # Web Worker for stat optimization
│   ├── scripts/               # Data generation scripts
│   └── test/                  # Unit, integration, and e2e tests
│
└── scripts/                   # Monorepo-level utilities
```

## How It Works

The calculator uses Elden Ring's actual game param files (XML exports from the game's `.param` tables) to replicate the exact damage formulas. At build time, these are parsed into a compact precomputed format. At runtime, the browser calculates AR, AoW damage, and enemy damage using the same curve interpolation and scaling logic the game uses.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full data flow, and [docs/DAMAGE_MECHANICS.md](docs/DAMAGE_MECHANICS.md) for the damage formulas.

## License

ISC
