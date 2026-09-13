# Adaptive Layout Engine for Multi-Surface Ads

A declarative, constraint-driven layout engine built with TypeScript that dynamically resolves a single ad specification into optimal layouts across wildly different surface profiles (Mobile Portrait, Mobile Landscape, Broadcast Lower-Third, Retail Kiosk, and custom surfaces) without per-surface hardcoded layout rules or CSS media query hacks.

Deployed Website : https://flam-ad-engine.vercel.app/

---

## Key Features

1. **Declarative Ad Spec Model (`defineAd`)**: Define ad content, element roles, and priority levels once independent of rendering surface constraints.
2. **Pure Constraint-Based Resolution**: Computes macro layout topologies (Vertical Stack, Horizontal Band, Split Columns, Balanced Card Grid) dynamically based on surface aspect ratio, safe areas, viewing distance (`minTextSize`), and touch constraints (`minTapTarget`).
3. **Iterative Priority Degradation Engine**: Under restricted spatial bounds, elements are shrunk or dropped strictly according to priority hierarchy (P3 Branding/Accent $\rightarrow$ P2 Price $\rightarrow$ P1 Headline/Hero/CTA preserved).
4. **Text-Measurement Aware**: Integrates Canvas 2D `measureText` bounding-box and word-wrapping engine for exact text dimension calculations.
5. **Dual Rendering Backend**: Framework-agnostic resolver powering both a **DOM/CSS Renderer** (with smooth Framer Motion layout transitions) and an independent **HTML5 Canvas 2D Renderer**.
6. **Interactive Demo Dashboard**: Switch between 4 standard surfaces, test dynamic spatial height shrinker slider live, add 5th custom surfaces on the fly, inspect real-time solver execution logs, and tweak element priorities.

---

## Resolution Pipeline Flow

```
┌─────────────────┐      ┌────────────────────┐
│   AdSpec AST    │  +   │   SurfaceProfile   │
└────────┬────────┘      └─────────┬──────────┘
         │                         │
         └───────────┬─────────────┘
                     ▼
       ┌───────────────────────────┐
       │ Constraint Resolver Engine│
       │  - Topology Classifier    │
       │  - Priority Degradation   │
       │  - Text Measurement       │
       └─────────────┬─────────────┘
                     ▼
           ┌──────────────────┐
           │  ResolvedLayout  │
           │  (Rects & Meta)  │
           └─────────┬────────┘
                     │
         ┌───────────┴───────────┐
         ▼                       ▼
┌──────────────────┐   ┌──────────────────┐
│   DOM Renderer   │   │  Canvas 2D Back  │
└──────────────────┘   └──────────────────┘
```

---

## Setup & Running Instructions

### Prerequisites
- Node.js (v18+)
- npm

### Installation & Quickstart

```bash
# Install dependencies
npm install

# Start local development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Type Check & Build

```bash
# Run TypeScript type safety check
npm run lint

# Build production bundle
npm run build
```

---

## Layout Resolution Algorithm: Step-by-Step

The constraint resolution engine operates in four distinct phases:

### Phase 1: Effective Workspace Computation
1. Subtract safe area insets (`top`, `right`, `bottom`, `left`) from raw surface width and height to establish the usable bounding box.
2. Compute the usable aspect ratio $AR = \text{usableWidth} / \text{usableHeight}$.

### Phase 2: Macro Topology Classification
Rather than branching on surface string IDs (`if (surface === 'mobile')`), the engine classifies the optimal layout structure strictly from geometric aspect ratio and spatial dimensions:

- **`HORIZONTAL_BAND` ($AR \ge 2.2$)**: e.g., Broadcast Lower-Third (1920x250). Positions elements in a horizontal sequence ([Branding] $\rightarrow$ [Headline Substack] $\rightarrow$ [Price] $\rightarrow$ [CTA Button]).
- **`VERTICAL_STACK` ($AR \le 0.75$)**: e.g., Mobile Interstitial Portrait (320x480). Positions elements in a vertical stack ([Top Branding] $\rightarrow$ [Hero Image] $\rightarrow$ [Headline] $\rightarrow$ [Price/Secondary] $\rightarrow$ [Bottom CTA]).
- **`SPLIT_COLUMNS` ($1.1 < AR < 2.2$)**: e.g., Mobile Landscape (480x320). Allocates a 2-column layout with Left Column (Hero Image) and Right Column (Branding, Headline, Price, CTA).
- **`BALANCED_CARD` ($0.75 < AR \le 1.1$)**: e.g., Retail Kiosk (1080x1080). Creates a generous card layout with prominent visual hierarchy.

### Phase 3: Priority & Degradation Loop
When usable space is restricted (e.g. dragging the spatial height slider):
1. **Pass 1**: Test layout with 100% active elements at full scale.
2. **Pass 2**: If overflow is detected, shrink Priority 3 (optional branding/accents) elements.
3. **Pass 3**: If overflow persists, drop Priority 3 elements entirely (`isVisible: false`) and shrink Priority 2 (price/secondary text) elements.
4. **Pass 4**: If space is severely restricted, drop Priority 2 elements to guarantee Priority 1 elements (Headline, Product Image, CTA) remain legible, non-overlapping, and fully inside bounds.

---

## TypeScript Architecture

- **`spec.ts`**: Defines `AdSpec`, `AdElement`, `ElementType`, `ElementRole`, and `PriorityLevel`. Includes `defineAd()` factory which enforces unique element IDs and valid priority levels (1, 2, 3) at compile/runtime.
- **`surfaces.ts`**: Defines `SurfaceProfile` (`width`, `height`, `safeArea`, `minTapTarget`, `minTextSize`, `viewingDistance`, `touchOnly`). `createCustomSurface()` provides dynamic surface validation.
- **`resolver.ts`**: Pure framework-agnostic function `resolveLayout(spec, surface)` returning `ResolvedLayout` containing array of `ResolvedElementRect` coordinates.

---

## Known Limitations

1. **Fixed Element Type Set**: Supports `text`, `image`, `button`, and `badge` element types.
2. **Image Aspect Ratio Assumptions**: Hero product image bounds use aspect ratio estimates unless explicit `preferredAspectRatio` is provided in `styleIntent`.
3. **Non-persisted Custom Surfaces**: Dynamically added 5th surfaces are stored in browser memory during session.

---


