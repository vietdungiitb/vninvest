# packages/web — VNInvest Frontend (SaaS Native)

Shared frontend package for **Community**, **SaaS**, and **VIP** build targets.  
Owns human-facing UI shells, route catalogs, and adapter seams.

---

## 🚀 Quick Start (Standalone Development)

```bash
# From repository root
cd packages/web

# Install dependencies (includes tailwindcss, postcss, autoprefixer)
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

> **Note**: This package now builds **independently** — no dependency on repo root config.

---

## 📦 Architecture

```
packages/web/
├── src/
│   ├── components/          # Shared UI components
│   │   ├── ui/              # Design system primitives (VninvestInput, etc.)
│   │   ├── alert-center/    # Alert Center feature components
│   │   ├── vninvestcharts/  # Chart engine & panels
│   │   └── ...
│   ├── pages/               # Page-level components (routes)
│   ├── features/            # Feature modules (community, saas, vip)
│   ├── hooks/               # Shared React hooks
│   ├── adapters/            # API adapter layer
│   ├── context/             # React context providers
│   ├── index.css            # Global styles + design tokens (CSS variables)
│   └── main.jsx             # App entry point
├── tailwind.config.js       # Tailwind config mapping design tokens
├── postcss.config.js        # PostCSS plugins (tailwind + autoprefixer)
├── vite.config.js           # Vite configuration
└── package.json
```

---

## 🎨 Design System

### CSS Variables (Design Tokens)
Defined in `src/index.css`:
- **Spacing**: `--space-1` through `--space-12`
- **Border Radius**: `--radius-xs` (8px) → `--radius-lg` (20px), `--radius-pill` (999px)
- **Colors**: `--bg-*`, `--text-*`, `--accent-*`, `--border-*`, `--terminal-*`
- **Shadows**: `--shadow-panel`, `--shadow-focus`
- **Typography**: `--font-sans`, `--font-mono`
- **Transitions**: `--spring-smooth`, `--spring-bouncy`

### Tailwind Integration
`tailwind.config.js` maps **1:1** to CSS variables:
```js
colors: {
  bg: { app: 'var(--bg-app)', panel: 'var(--bg-panel)', ... },
  text: { primary: 'var(--text-primary)', ... },
  accent: { cyan: 'var(--accent-cyan)', ... },
  // ...
}
spacing: { '1': 'var(--space-1)', ... },
borderRadius: { sm: 'var(--radius-sm)', ... },
```

### Standardized Components
- **`VninvestInput`** (`src/components/ui/VninvestInput.jsx`) — Unified form input with 12px border radius, focus states, error handling, dark mode support.

---

## 🔧 CSS Architecture (Post-Refactor 2026-06-16)

### Before (Technical Debt)
- 5 conflicting styling methods: Global Tailwind, global `index.css`, page-specific CSS (global scope), dynamic JS injection, inline React styles
- Specificity wars, `!important` abuse, mobile layout breaks, FOUC

### After (Standardized)
1. **CSS Modules** for component-scoped styles (`*.module.css`)
2. **Global tokens** in `index.css` (CSS variables)
3. **Tailwind utilities** mapped to tokens via `tailwind.config.js`
4. **Zero dynamic injection** — all styles via static imports
5. **Zero inline styles** — replaced with Tailwind / CSS Modules

### Migration Rules
- ✅ New components: Use CSS Modules + Tailwind utilities
- ✅ Forms: Use `<VninvestInput />` component
- ❌ No `useEffect` injecting `<style>` tags
- ❌ No `style={{ ... }}` in JSX
- ❌ No global page CSS files (use CSS Modules)

---

## 🧪 Testing

```bash
# Unit/Integration tests
npm test

# Visual regression (requires baseline)
# TODO: Configure Playwright + Chromatic
```

---

## 📋 Build Targets

Controlled via `src/config/buildTarget.js`:
- `community` — Public features
- `saas` — Full SaaS platform (default)
- `vip` — VIP/Enterprise features

---

## 🔗 Key Exports

```js
// Main entry
import './src/index.js'

// Route catalog
import { routeCatalog } from './src/app/routeCatalog.js'

// Navigation catalog
import { navigationCatalog } from './src/app/navigationCatalog.js'

// Auth runtime
import { authRuntime } from './src/context/authRuntime.js'

// Core API adapter
import { coreApiAdapter } from './src/adapters/coreApiAdapter.js'
```

---

## 📝 Changelog (Recent)

| Date | Change |
|------|--------|
| 2026-06-16 | **Major CSS Architecture Refactor**: CSS Modules, Tailwind config, VninvestInput, layout bug fixes (Triad Lane, Mobile Chart, CVD panes) |
| 2026-06-16 | Standalone build support: `tailwind.config.js`, `postcss.config.js`, devDependencies |

---

## 🤝 Contributing

1. Follow CSS Modules + Tailwind pattern for new components
2. Use design tokens (CSS variables) — avoid hardcoded values
3. Run `npm run build` before PR to verify standalone build
4. Add visual regression tests for UI changes
