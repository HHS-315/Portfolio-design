# shadcn structure

This repo has two surfaces:

1. **The live portfolio** — a self-contained static page (`index.html` + inline
   CSS + vanilla JS in `assets/js/`). This is what gets deployed. Its animated
   background is `assets/js/shader-bg.js`, a **dependency-free vanilla port** of
   the same "Neuro Noise" shader (recoloured gray-on-black, pointer-reactive).
2. **A shadcn/React surface** — added so the project *supports the shadcn
   structure* and the original `blue-noise.tsx` component can live where the
   shadcn CLI expects it. Entry is `app.html` (never touches `index.html`).

## Why `/components/ui`

shadcn resolves generated components at the `ui` alias — here `@/components/ui`
(see `components.json` → `aliases.ui`). Keeping the folder exactly there is what
lets `npx shadcn@latest add <component>` write files to the right place and lets
every import resolve as `@/components/ui/...`. The `@` alias maps to the repo
root in both `tsconfig.json` (`paths`) and `vite.config.ts` (`resolve.alias`).

## Layout

```
components.json            # shadcn config (style, aliases, tailwind, icon lib)
tsconfig.json              # "@/*" -> "./*"
tsconfig.node.json
vite.config.ts             # React + "@" alias; entry = app.html, out = dist-app/
postcss.config.js          # tailwindcss + autoprefixer
tailwind.config.js         # shadcn theme (CSS variables, neutral base)
app/
  globals.css              # @tailwind + shadcn CSS variables (light/.dark)
  main.tsx                 # React entry
  App.tsx                  # renders the demo
app.html                   # Vite HTML entry (separate from index.html)
lib/utils.ts               # cn() helper (clsx + tailwind-merge)
components/
  ui/blue-noise.tsx        # the ShaderBackground component (verbatim)
  blue-noise-demo.tsx      # demo usage
```

## Run

```bash
npm install          # installs React, Vite, Tailwind, shadcn deps
npm run app:dev      # Vite dev server → open the printed URL (app.html)
npm run app:build    # production build → dist-app/  (the canonical typecheck+build)
npm run app:preview  # preview the built app
```

The static site is still `npm start` (serves `index.html` on :8000).

## Adding more shadcn components

Already configured — just run, e.g.:

```bash
npx shadcn@latest add button card
```

They land in `components/ui/` and import via `@/components/ui/...`.

## If you were starting from scratch

This project already has Tailwind + TypeScript + the shadcn structure wired up.
For a brand-new project you would instead:

```bash
npm create vite@latest my-app -- --template react-ts
cd my-app
npm i -D tailwindcss postcss autoprefixer && npx tailwindcss init -p
# add the "@/*" path alias to tsconfig.json + vite.config.ts, then:
npx shadcn@latest init
npx shadcn@latest add <component>
```

> Note: `blue-noise.tsx` is kept byte-for-byte as delivered. It uses hoisted
> inner functions, so a strict standalone `tsc --noEmit` can't narrow the
> `if (!canvas/!gl) return` guards into them — a known TS false positive. The
> Vite/esbuild build (`npm run app:build`) compiles it cleanly, so that is the
> build gate.
