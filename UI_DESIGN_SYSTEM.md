# WII Enterprise Suite — Global UI/UX Design System Specification
**Document Version:** 1.0.0 (Phase 1 Baseline)  
**Status:** Canonical Source of Truth for Phases 2, 3, and 4  
**Product:** Wildlife Institute of India Enterprise Suite (WII-ERP)  
**Core Modules:** LAMS 2.0 (Leave & Attendance), WII-PMS (Project Management), WII-SIMS (Stock Inventory), WII-FMS (Facility Management), WII-FinPay (Finance & TA/DA), Enterprise Suite Lobby & Authentication.

---

## 1. Executive Summary & Philosophy

This Design System establishes a single, cohesive, institutional visual language for the Wildlife Institute of India (WII) Enterprise Suite. As a premier autonomous research and statutory institution under the Ministry of Environment, Forest and Climate Change (MoEFCC), Government of India, the interface must convey **authority, precision, legibility, and high operational reliability**.

### Core Tenets
1. **Institutional Dignity**: Rooted in WII’s signature garnet/maroon (`#701618`) and deep slate (`#0f172a`), avoiding candy gradients, toy badges, and frivolous animations.
2. **Zero-Pill Discipline**: Informational metadata (dates, categories, shifts, designations) is rendered as clean unboxed text with subtle typographic separators (`·` or `|`), never encased in colored capsule/pill pills. Interactive buttons and segmented controls use restrained rectangular-curved shapes (`rounded-xl` or `rounded-lg`).
3. **Information Density & Accessibility**: High-density tabular views, crisp 1-pixel borders (`#e2e8f0`), WCAG AA contrast (minimum 4.5:1 for body copy), and predictable keyboard/touch targets.
4. **Resilient Responsive Math**: Explicit support for desktop displays down to small mobile phones with strict horizontal overflow containment, self-scrolling data tables, and touch-friendly controls.

---

## 2. Color System

No arbitrary hex values are permitted in future page redesigns. All components must use the centralized tokens or their Tailwind equivalents.

### 2.1 Brand & Institutional Tokens
| Token | Hex | Tailwind Class | CSS Variable | Intended Usage |
|---|---|---|---|---|
| **Primary** | `#701618` | `bg-primary`, `text-primary` | `var(--ds-primary)` | Primary action buttons, brand logo accents, active module highlights |
| **Primary Hover** | `#561012` | `hover:bg-[#561012]` | `var(--ds-primary-hover)` | Primary button hover state |
| **Primary Active** | `#3e0b0d` | `active:bg-[#3e0b0d]` | `var(--ds-primary-active)` | Primary button active/pressed state |
| **Primary Subtle** | `#fdf2f4` | `bg-[#fdf2f4]` | `var(--ds-primary-subtle)` | Active navigation item background, light brand highlight |
| **Primary Light** | `#fae5e7` | `bg-[#fae5e7]` | `var(--ds-primary-light)` | Subtle chip background, badge border tint |
| **Primary Border** | `#f4bec2` | `border-[#f4bec2]` | `var(--ds-primary-border)` | Border for primary-themed alerts and banners |

### 2.2 Structural Secondary Tokens
| Token | Hex | Tailwind Class | CSS Variable | Intended Usage |
|---|---|---|---|---|
| **Secondary** | `#0f172a` | `bg-slate-900`, `text-slate-900` | `var(--ds-secondary)` | Secondary action buttons, export PDF buttons, active dark tabs |
| **Secondary Hover** | `#1e293b` | `hover:bg-slate-800` | `var(--ds-secondary-hover)` | Secondary button hover |
| **Secondary Active** | `#334155` | `active:bg-slate-700` | `var(--ds-secondary-active)` | Secondary button active state |

### 2.3 Background & Surface Tokens
| Token | Hex | Tailwind Class | CSS Variable | Intended Usage |
|---|---|---|---|---|
| **App Background** | `#f8fafc` | `bg-slate-50` | `var(--ds-bg-app)` | Global viewport layout background |
| **Surface Card** | `#ffffff` | `bg-white` | `var(--ds-bg-surface)` | Main content cards, tables, modal dialogs, sidebars, header |
| **Surface Muted** | `#f1f5f9` | `bg-slate-100` | `var(--ds-bg-surface-muted)` | Table `th` header cells, inactive tab strips, search bar backgrounds |
| **Surface Alt Row**| `#f8fafc` | `bg-slate-50` | `var(--ds-bg-surface-alt)` | Table alternating row stripe or hover surface |
| **Backdrop** | `rgba(15,23,42,0.55)` | `bg-slate-900/55` | `var(--ds-bg-backdrop)` | Modal backdrops, mobile navigation drawers |

### 2.4 Border & Divider Tokens
| Token | Hex | Tailwind Class | CSS Variable | Intended Usage |
|---|---|---|---|---|
| **Border Subtle** | `#f1f5f9` | `border-slate-100` | `var(--ds-border-subtle)` | Subtle inner card dividers, item separators |
| **Border Default** | `#e2e8f0` | `border-slate-200` | `var(--ds-border-default)` | Standard card boundary, table rows, header/sidebar borders |
| **Border Strong** | `#cbd5e1` | `border-slate-300` | `var(--ds-border-strong)` | Form inputs, select dropdowns, search bars |
| **Border Focus** | `#2563eb` | `focus:border-blue-600` | `var(--ds-border-focus)` | Input focus state with `ring-2 ring-blue-600/20` |

### 2.5 Text Hierarchy Tokens
| Token | Hex | Tailwind Class | Intended Usage |
|---|---|---|---|
| **Heading Text** | `#0f172a` | `text-slate-900` | Page titles, module headers, card titles, key metric numbers |
| **Body Text** | `#334155` | `text-slate-700` | Main table text, form field answers, body copy |
| **Secondary Text** | `#475569` | `text-slate-600` | Field labels, sub-descriptions, secondary metadata |
| **Muted Text** | `#64748b` | `text-slate-500` | Helper text, breadcrumb paths, timestamps |
| **Subtle Text** | `#94a3b8` | `text-slate-400` | Placeholders, inactive icons, empty state copy |
| **Disabled Text** | `#cbd5e1` | `text-slate-300` | Disabled inputs, unavailable actions |
| **Inverse Text** | `#ffffff` | `text-white` | Text on dark buttons, banners, dark tooltips |

### 2.6 Semantic Feedback Tokens
| Role | Surface (`50`) | Border (`200`) | Text (`800`) | Solid (`600`) | Usage |
|---|---|---|---|---|---|
| **Success** | `#ecfdf5` (`emerald-50`) | `#a7f3d0` (`emerald-200`) | `#065f46` (`emerald-800`) | `#059669` (`emerald-600`) | Present, Approved, Disbursed, Verified, Active |
| **Warning** | `#fffbeb` (`amber-50`) | `#fde68a` (`amber-200`) | `#92400e` (`amber-800`) | `#d97706` (`amber-600`) | Pending Level-1, Half-Day, Review, Delayed |
| **Error** | `#fff1f2` (`rose-50`) | `#fecdd3` (`rose-200`) | `#9f1239` (`rose-800`) | `#dc2626` (`rose-600`) | Absent, Rejected, Cancelled, Low Stock, Delete |
| **Info** | `#eff6ff` (`blue-50`) | `#bfdbfe` (`blue-200`) | `#1e40af` (`blue-800`) | `#2563eb` (`blue-600`) | Outdoor Duty (OD), Transit, Informational hints |

---

## 3. Typography Hierarchy

The software uses a single font stack: **Inter** with fallbacks to system fonts, and a monospace font stack (**JetBrains Mono / SF Mono / Consolas**) for record codes, employee IDs, and timestamps.

| Level | Size | Weight | Line Height | Tracking | Standard Tailwind Class |
|---|---|---|---|---|---|
| **Page Title** | 20px / 24px | Bold (700) | 28px / 32px | -0.02em | `text-xl sm:text-2xl font-bold tracking-tight text-slate-900` |
| **Section Title** | 16px / 18px | Bold (700) | 24px / 28px | -0.01em | `text-base sm:text-lg font-bold tracking-tight text-slate-900` |
| **Sub-Heading** | 14px | Semibold (600) | 20px | -0.005em | `text-sm font-semibold text-slate-800` |
| **Card Title** | 14px | Bold (700) | 20px | Normal | `text-sm font-bold text-slate-900` |
| **Body Text** | 14px | Normal (400) | 22px | Normal | `text-sm font-normal text-slate-700 leading-relaxed` |
| **Body Small** | 12px | Medium (500) | 18px | Normal | `text-xs font-medium text-slate-600` |
| **Label** | 12px | Semibold (600) | 16px | Normal | `text-xs font-semibold text-slate-700` |
| **Placeholder** | 12px | Normal (400) | 16px | Normal | `text-xs font-normal text-slate-400` |
| **Helper Text** | 11px | Normal (400) | 15px | Normal | `text-[11px] font-normal text-slate-500` |
| **Error Text** | 11px | Semibold (600) | 15px | Normal | `text-[11px] font-semibold text-rose-600` |
| **Button Text** | 12px | Bold (700) | 16px | 0.01em | `text-xs font-bold tracking-normal` |
| **Table Header** | 11px | Bold (700) | 14px | 0.05em | `text-[11px] font-bold text-slate-600 uppercase tracking-wider` |
| **Table Body** | 12px | Medium (500) | 18px | Normal | `text-xs font-medium text-slate-800` |
| **Caption / Kicker** | 10px | Bold (700) | 12px | 0.06em | `text-[10px] font-bold text-slate-400 uppercase tracking-wider` |

---

## 4. Spacing Scale

All margins, paddings, and flex/grid gaps must adhere strictly to the 4-pixel grid system:

| Scale Value | REM Equivalent | Tailwind Alias | Typical Component Application |
|---|---|---|---|
| **4px** | `0.25rem` | `1` / `gap-1` | Micro-gaps between icon and label, badge internal spacing |
| **8px** | `0.5rem` | `2` / `gap-2` | Tight gaps in button groups, search clear icon padding |
| **12px** | `0.75rem` | `3` / `gap-3` | Standard mobile padding, stat card inner item gaps |
| **16px** | `1.0rem` | `4` / `p-4` | Standard card inner padding, input horizontal padding |
| **20px** | `1.25rem` | `5` / `p-5` | Content container padding, modal header/footer padding |
| **24px** | `1.5rem` | `6` / `space-y-6` | Vertical gap between major page sections and tables |
| **32px** | `2.0rem` | `8` / `mb-8` | Modal dialog margins, major page block separation |
| **40px** | `2.5rem` | `10` | Hero section separators |
| **48px** | `3.0rem` | `12` | Bottom content padding on long administrative pages |
| **64px** | `4.0rem` | `16` | Maximum structural boundary separation |

---

## 5. Border Radius Hierarchy

Arbitrary corner curves are strictly prohibited. The border radius scale is calibrated as follows:

| Radius Token | Value | Tailwind Class | Approved Component Usages | Forbidden Usages |
|---|---|---|---|---|
| **Small (sm)** | `6px` (`0.375rem`) | `rounded-md` | Micro status indicators, small icon boxes in tables | Never for full cards or main inputs |
| **Medium (md)** | `8px` (`0.5rem`) | `rounded-lg` | Standard text inputs, select dropdowns, compact action buttons | Never for main content containers |
| **Large (lg)** | `12px` (`0.75rem`) | `rounded-xl` | Primary action buttons, content cards, modal dialogs, segmented tab strips | Never for avatar thumbnails |
| **Extra Large (xl)**| `16px` (`1.0rem`) | `rounded-2xl` | Outer module containers, top feature cards, lobby cards | Never for form fields or buttons |
| **Pill (full)** | `9999px` | `rounded-full` | Circular avatars, circular icon triggers, status indicator dots | **NEVER for static text metadata chips** |

---

## 6. Shadow Hierarchy

Shadows are calibrated for institutional software: subtle, high-clarity ambient depth with zero colorful glowing effects.

| Shadow Level | CSS Definition | Tailwind Class | Approved Application |
|---|---|---|---|
| **None** | `none` | `shadow-none` | Flat embedded cards, nested table panels |
| **2xs** | `0 1px 2px 0 rgba(15, 23, 42, 0.04)` | `shadow-2xs` | Form inputs, outline buttons, compact table cards |
| **xs** | `0 1px 3px 0 rgba(15, 23, 42, 0.06), 0 1px 2px -1px rgba(15, 23, 42, 0.04)` | `shadow-xs` | Standard content cards, primary action buttons, segmented tabs |
| **sm** | `0 2px 4px -1px rgba(15, 23, 42, 0.06), 0 4px 6px -1px rgba(15, 23, 42, 0.08)` | `shadow-sm` | Interactive card hover states, elevated metric counters |
| **md** | `0 4px 6px -2px rgba(15, 23, 42, 0.08), 0 10px 15px -3px rgba(15, 23, 42, 0.1)` | `shadow-md` | Dropdown menus, popover date pickers, time picker flyouts |
| **lg** | `0 10px 15px -3px rgba(15, 23, 42, 0.1), 0 20px 25px -5px rgba(15, 23, 42, 0.1)` | `shadow-lg` | Modal dialog windows, drawer panels, image lightboxes |

---

## 7. Responsive Breakpoints

The responsive system ensures complete layout integrity across mobile, tablet, laptop, and ultrawide monitors.

| Device Tier | Viewport Widths | Target Devices | Layout Behavior |
|---|---|---|---|
| **Desktop Ultra** | `1920px+` | 1080p / 1440p / 4K Monitors | Content centered with `max-w-[1700px]`, 4-column metric grid |
| **Desktop High** | `1600px - 1919px` | High-res Laptops / 27" Displays | 4-column metrics, full table column expansion |
| **Desktop Std** | `1440px - 1599px` | Standard Workstations | 4-column metrics, fixed sidebar `w-64` |
| **Desktop Low** | `1366px - 1439px` | Common Institutional Laptops | Standard sidebar, table containers allow horizontal scroll if columns exceed |
| **Laptop Std** | `1280px - 1365px` | Compact Laptops | Standard layout, compact filter controls |
| **Laptop / Tablet Pro** | `1024px - 1279px` | iPad Pro (Landscape), Small Laptops | Desktop sidebar visible, dense data grids scroll cleanly |
| **Tablet Landscape** | `820px - 1023px` | iPad Air (Landscape) | Sidebar switches to drawer on `< 1024px` |
| **Tablet Portrait** | `768px - 819px` | iPad / Surface (Portrait) | Drawer sidebar, 2-column metrics, scrollable data tables |
| **Mobile Large** | `430px - 767px` | iPhone Pro Max, Galaxy Ultra | 2-column or 1-column metrics, wrapped filter strips |
| **Mobile Medium** | `375px - 429px` | iPhone 14/15/16, Pixel | 2-column compact metrics, full-width modal dialogs |
| **Mobile Compact**| `360px - 374px` | Android Small Devices | 1-column forms, horizontal scroll boundary on all tables |

---

## 8. Standard Component Archetypes

### 8.1 Buttons
* **Primary Institutional Button**:
  ```tsx
  className="h-9 px-4 bg-[#701618] hover:bg-[#561012] active:bg-[#3e0b0d] text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
  ```
* **Secondary Action Button (Corporate Slate)**:
  ```tsx
  className="h-9 px-4 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
  ```
* **Outline Button**:
  ```tsx
  className="h-9 px-3.5 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-800 border border-slate-200/90 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
  ```
* **Destructive Action Button**:
  ```tsx
  className="h-9 px-4 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
  ```

### 8.2 Form Inputs & Controls
* **Text Input**:
  ```tsx
  className="h-9 w-full px-3 bg-white border border-slate-300 hover:border-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 rounded-xl text-xs font-semibold text-slate-900 placeholder-slate-400 transition-all outline-none disabled:bg-slate-100"
  ```
* **Search Field**:
  ```tsx
  className="h-9 w-full pl-9 pr-8 bg-slate-50/70 hover:bg-slate-50 focus:bg-white border border-slate-200/80 focus:border-blue-500 focus:ring-2 focus:ring-blue-600/20 rounded-xl text-xs font-semibold text-slate-900 placeholder-slate-400 transition-all outline-none"
  ```
* **Select Dropdown**: Standardized via custom `AppSelect` or global select styling (`index.css`) with consistent 12px height, 12px font, `#cbd5e1` border, `#2563eb` focus ring.

### 8.3 Data Tables
* Container:
  ```tsx
  className="w-full overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs custom-table-scrollbar"
  ```
* Header cells (`th`):
  ```tsx
  className="py-2.5 px-3 bg-slate-50/90 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider whitespace-nowrap"
  ```
* Body cells (`td`):
  ```tsx
  className="py-2.5 px-3 border-b border-slate-100 text-xs font-medium text-slate-800 whitespace-nowrap"
  ```
* Row hover: `hover:bg-slate-50/80 transition-colors`

### 8.4 Cards & Panels
* Standard Card:
  ```tsx
  className="bg-white border border-slate-200/90 rounded-xl p-4 sm:p-5 shadow-xs"
  ```
* Metric Counter Card (4-up Row):
  ```tsx
  className="bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-2xs flex flex-col justify-between min-h-[92px]"
  ```

### 8.5 Modal Dialogs
* Backdrop:
  ```tsx
  className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4"
  ```
* Container:
  ```tsx
  className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-hidden border border-slate-200 flex flex-col"
  ```
* Header:
  ```tsx
  className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white"
  ```
* Body:
  ```tsx
  className="p-5 overflow-y-auto space-y-4 flex-1"
  ```
* Footer:
  ```tsx
  className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end space-x-2 shrink-0"
  ```

### 8.6 Status Indicators (Zero-Pill Compliance)
* Unboxed status with indicator dot:
  ```tsx
  // ✅ Approved / Present
  <span className="inline-flex items-center space-x-1.5 text-xs font-semibold text-emerald-700">
    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
    <span>Present</span>
  </span>

  // ✅ Pending Review
  <span className="inline-flex items-center space-x-1.5 text-xs font-semibold text-amber-700">
    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
    <span>Pending Review</span>
  </span>

  // ✅ Absent / Rejected
  <span className="inline-flex items-center space-x-1.5 text-xs font-semibold text-rose-700">
    <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
    <span>Absent</span>
  </span>
  ```

---

## 9. Implementation & Architectural File Map

* `src/shared/design-system/tokens.ts`: Centralized TypeScript constants for all tokens, spacing, typography, radii, shadows, breakpoints, and component class combinations.
* `src/shared/design-system/index.ts`: Public module exports for application-wide consumption.
* `src/index.css`: Tailwind CSS v4 `@theme` block and `:root` CSS variables implementing the token contract.
* `UI_DESIGN_SYSTEM.md`: This canonical specification document.

---

## 10. Rules of Engagement for Subsequent Phases

1. **Phase 2 (Layout & Navigation Standardization)**:
   - Harmonize `Header`, `Sidebar`, `LobbyPage`, and `LoginPage` with the new tokens.
   - Replace any legacy navigation pills and inconsistent header styles.
2. **Phase 3 (Core Forms & Data Tables Standardization)**:
   - Standardize table headers, zebra striping, pagination bars, and filter strips across all modules.
   - Apply uniform form input styling, validation messages, and date/time pickers.
3. **Phase 4 (Modal Dialogs, Metric Cards & Edge Cases)**:
   - Audit and standardize all 15+ modal dialogs to share identical backdrop, border radius, header, body, and footer button ergonomics.
   - Clean up remaining isolated arbitrary hex colors.
