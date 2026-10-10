/**
 * ============================================================================
 * GLOBAL DESIGN SYSTEM TOKENS (PHASE 1 SOURCE OF TRUTH)
 * ============================================================================
 * Wildlife Institute of India Enterprise Suite (WII-ERP / LAMS / PMS / SIMS / FMS / FinPay)
 * 
 * Standardized Design Tokens for institutional software.
 * All subsequent UI standardizations (Phase 2, 3, and 4) MUST reference these
 * tokens and follow the architecture laid out in this file.
 */

export const DS_COLORS = {
  // Brand / Institutional Primary (WII Garnet / Maroon)
  primary: {
    DEFAULT: '#2563eb', // Kept as provided
    hover: '#1d4ed8',
    active: '#1e40af',
    subtle: '#eff6ff',
    light: '#dbeafe',
    border: '#bfdbfe',
    foreground: '#ffffff'
  },

  // Structural Secondary (Corporate Dark Slate - matched to screenshot header)
  secondary: {
    DEFAULT: '#0f172a', // Slate-900
    hover: '#1e293b',   // Slate-800
    active: '#334155',  // Slate-700
    subtle: '#f8fafc',  // Slate-50
    light: '#f1f5f9',   // Slate-100
    border: '#e2e8f0',  // Slate-200
    foreground: '#ffffff'
  },

  // Background Hierarchy
  background: {
    app: '#f8fafc',       // Slate-50 background for page layouts
    surface: '#ffffff',   // Pure white for content cards, tables, modals
    surfaceMuted: '#f1f5f9', // Slate-100 for secondary panels, table headers
    surfaceAlt: '#f8fafc',  // Slate-50 alternating rows
    backdrop: 'rgba(15, 23, 42, 0.55)' // Slate-900 at 55% opacity for modals
  },

  // Borders & Dividers
  border: {
    subtle: '#f1f5f9',  // Slate-100
    DEFAULT: '#e2e8f0', // Slate-200 standard card and container border
    strong: '#cbd5e1',  // Slate-300 input border, prominent dividers
    focus: '#2563eb',   // Blue-600 focus ring
    focusRing: 'rgba(37, 99, 235, 0.2)' // Focus glow
  },

  // Text / Typography Hierarchy
  text: {
    heading: '#0f172a', // Slate-900 high-emphasis text
    body: '#334155',    // Slate-700 primary reading text
    secondary: '#475569', // Slate-600 secondary descriptions
    muted: '#64748b',   // Slate-500 captions, timestamps, hints
    subtle: '#94a3b8',  // Slate-400 placeholder text, icons
    disabled: '#cbd5e1', // Slate-300 disabled button/input text
    inverse: '#ffffff'  // Pure white text on dark surfaces
  },

  // Semantic Status & Feedback
  success: {
    DEFAULT: '#059669', // Emerald-600
    hover: '#047857',   // Emerald-700
    subtle: '#ecfdf5',  // Emerald-50
    border: '#a7f3d0',  // Emerald-200
    text: '#065f46'     // Emerald-800
  },

  warning: {
    DEFAULT: '#d97706', // Amber-600
    hover: '#b45309',   // Amber-700
    subtle: '#fffbeb',  // Amber-50
    border: '#fde68a',  // Amber-200
    text: '#92400e'     // Amber-800
  },

  error: {
    DEFAULT: '#dc2626', // Rose-600
    hover: '#b91c1c',   // Rose-700
    subtle: '#fff1f2',  // Rose-50
    border: '#fecdd3',  // Rose-200
    text: '#9f1239'     // Rose-800
  },

  info: {
    DEFAULT: '#2563eb', // Blue-600
    hover: '#1d4ed8',   // Blue-700
    subtle: '#eff6ff',  // Blue-50
    border: '#bfdbfe',  // Blue-200
    text: '#1e40af'     // Blue-800
  }
} as const;

export const DS_TYPOGRAPHY = {
  fontFamily: {
    sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    mono: "'JetBrains Mono', 'SF Mono', Consolas, Menlo, Monaco, monospace"
  },

  // Standard Typographic Scale
  scale: {
    pageTitle: {
      fontSize: '1.25rem', // 20px (sm: 24px)
      lineHeight: '1.75rem',
      fontWeight: '700',
      letterSpacing: '-0.02em',
      tailwind: 'text-xl sm:text-2xl font-bold tracking-tight text-slate-900'
    },
    sectionTitle: {
      fontSize: '1rem', // 16px (sm: 18px)
      lineHeight: '1.5rem',
      fontWeight: '700',
      letterSpacing: '-0.01em',
      tailwind: 'text-base sm:text-lg font-bold tracking-tight text-slate-900'
    },
    subHeading: {
      fontSize: '0.875rem', // 14px
      lineHeight: '1.25rem',
      fontWeight: '600',
      letterSpacing: '-0.005em',
      tailwind: 'text-sm font-semibold text-slate-800'
    },
    cardTitle: {
      fontSize: '0.875rem', // 14px
      lineHeight: '1.25rem',
      fontWeight: '700',
      letterSpacing: '0',
      tailwind: 'text-sm font-bold text-slate-900'
    },
    body: {
      fontSize: '0.875rem', // 14px
      lineHeight: '1.375rem',
      fontWeight: '400',
      letterSpacing: '0',
      tailwind: 'text-sm font-normal text-slate-700'
    },
    bodySmall: {
      fontSize: '0.75rem', // 12px
      lineHeight: '1.125rem',
      fontWeight: '500',
      letterSpacing: '0',
      tailwind: 'text-xs font-medium text-slate-600'
    },
    label: {
      fontSize: '0.75rem', // 12px
      lineHeight: '1rem',
      fontWeight: '600',
      letterSpacing: '0',
      tailwind: 'text-xs font-semibold text-slate-700'
    },
    placeholder: {
      fontSize: '0.75rem', // 12px
      lineHeight: '1rem',
      fontWeight: '400',
      letterSpacing: '0',
      tailwind: 'text-xs font-normal text-slate-400'
    },
    helperText: {
      fontSize: '0.6875rem', // 11px
      lineHeight: '0.9375rem',
      fontWeight: '400',
      letterSpacing: '0',
      tailwind: 'text-[11px] font-normal text-slate-500'
    },
    errorText: {
      fontSize: '0.6875rem', // 11px
      lineHeight: '0.9375rem',
      fontWeight: '600',
      letterSpacing: '0',
      tailwind: 'text-[11px] font-semibold text-rose-600'
    },
    buttonText: {
      fontSize: '0.75rem', // 12px
      lineHeight: '1rem',
      fontWeight: '700',
      letterSpacing: '0.01em',
      tailwind: 'text-xs font-bold tracking-normal'
    },
    tableHeader: {
      fontSize: '0.6875rem', // 11px
      lineHeight: '0.875rem',
      fontWeight: '700',
      letterSpacing: '0.05em',
      tailwind: 'text-[11px] font-bold text-slate-600 uppercase tracking-wider'
    },
    tableBody: {
      fontSize: '0.75rem', // 12px
      lineHeight: '1.125rem',
      fontWeight: '500',
      letterSpacing: '0',
      tailwind: 'text-xs font-medium text-slate-800'
    },
    caption: {
      fontSize: '0.625rem', // 10px
      lineHeight: '0.75rem',
      fontWeight: '700',
      letterSpacing: '0.06em',
      tailwind: 'text-[10px] font-bold text-slate-400 uppercase tracking-wider'
    }
  }
} as const;

export const DS_SPACING = {
  scale: {
    4: '0.25rem',  // 4px - tailwind 1
    8: '0.5rem',   // 8px - tailwind 2
    12: '0.75rem', // 12px - tailwind 3
    16: '1rem',    // 16px - tailwind 4
    20: '1.25rem', // 20px - tailwind 5
    24: '1.5rem',  // 24px - tailwind 6
    32: '2rem',    // 32px - tailwind 8
    40: '2.5rem',  // 40px - tailwind 10
    48: '3rem',    // 48px - tailwind 12
    64: '4rem'     // 64px - tailwind 16
  },
  layout: {
    pagePaddingMobile: 'p-3',
    pagePaddingTablet: 'sm:p-5',
    pagePaddingDesktop: 'lg:p-6',
    cardPaddingCompact: 'p-3.5',
    cardPaddingStandard: 'p-5',
    cardPaddingSpacious: 'p-6',
    gutterCompact: 'gap-3',
    gutterStandard: 'gap-4 sm:gap-5',
    sectionSpacing: 'space-y-6'
  }
} as const;

export const DS_RADIUS = {
  small: {
    value: '0.375rem', // 6px
    tailwind: 'rounded-md',
    usage: 'Micro badges, small icon boxes, nested pills'
  },
  medium: {
    value: '0.5rem', // 8px
    tailwind: 'rounded-lg',
    usage: 'Form inputs, standard select menus, compact buttons'
  },
  large: {
    value: '0.75rem', // 12px
    tailwind: 'rounded-xl',
    usage: 'Standard action buttons, cards, modals, popovers, tabs'
  },
  extraLarge: {
    value: '1rem', // 16px
    tailwind: 'rounded-2xl',
    usage: 'Primary module containers, hero cards'
  },
  pill: {
    value: '9999px',
    tailwind: 'rounded-full',
    usage: 'Circular avatar thumbnails, status dot indicators (NEVER static metadata pills)'
  }
} as const;

export const DS_SHADOWS = {
  none: 'none',
  '2xs': {
    value: '0 1px 2px 0 rgba(15, 23, 42, 0.04)',
    tailwind: 'shadow-2xs',
    usage: 'Subtle card border reinforcement, inputs'
  },
  xs: {
    value: '0 1px 3px 0 rgba(15, 23, 42, 0.06), 0 1px 2px -1px rgba(15, 23, 42, 0.04)',
    tailwind: 'shadow-xs',
    usage: 'Standard cards, buttons, tabs'
  },
  sm: {
    value: '0 2px 4px -1px rgba(15, 23, 42, 0.06), 0 4px 6px -1px rgba(15, 23, 42, 0.08)',
    tailwind: 'shadow-sm',
    usage: 'Elevated interactive cards, hover states'
  },
  md: {
    value: '0 4px 6px -2px rgba(15, 23, 42, 0.08), 0 10px 15px -3px rgba(15, 23, 42, 0.1)',
    tailwind: 'shadow-md',
    usage: 'Dropdown menus, popover date pickers'
  },
  lg: {
    value: '0 10px 15px -3px rgba(15, 23, 42, 0.1), 0 20px 25px -5px rgba(15, 23, 42, 0.1)',
    tailwind: 'shadow-lg',
    usage: 'Modal dialog windows, slide-over panels'
  }
} as const;

export const DS_BREAKPOINTS = {
  desktopLarge: { minWidth: 1920, label: '1920 Full HD / Ultrawide' },
  desktopMedium: { minWidth: 1600, label: '1600 Desktop' },
  desktopStandard: { minWidth: 1440, label: '1440 Standard Desktop' },
  desktopCompact: { minWidth: 1366, label: '1366 Laptop / Small Desktop' },
  laptopStandard: { minWidth: 1280, label: '1280 Standard Laptop' },
  laptopCompact: { minWidth: 1024, label: '1024 iPad Pro / Small Laptop' },
  tabletLandscape: { minWidth: 820, label: '820 iPad Air' },
  tabletPortrait: { minWidth: 768, label: '768 Tablet' },
  mobileLarge: { maxWidth: 430, label: '430 iPhone 14/15/16 Pro Max' },
  mobileMedium: { maxWidth: 390, label: '390 iPhone Standard' },
  mobileCompact: { maxWidth: 360, label: '360 Android Small' }
} as const;

/**
 * Standard Component Archetypes
 * Copy-paste safe Tailwind class combinations for consistent UI construction.
 */
export const DS_COMPONENTS = {
  button: {
    primary:
      'h-9 px-4 bg-[#2563eb] hover:bg-[#1d4ed8] active:bg-[#1e40af] text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
    secondary:
      'h-9 px-4 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
    outline:
      'h-9 px-3.5 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-800 border border-slate-200/90 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
    subtle:
      'h-9 px-3.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
    destructive:
      'h-9 px-4 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
    iconOnly:
      'p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-40'
  },
  card: {
    standard: 'bg-white border border-slate-200/90 rounded-xl p-4 sm:p-5 shadow-xs',
    container: 'bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs',
    statCard: 'bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-2xs flex flex-col justify-between min-h-[92px]',
    subtle: 'bg-slate-50/70 border border-slate-200/80 rounded-xl p-3.5'
  },
  input: {
    standard:
      'h-9 w-full px-3 bg-white border border-slate-300 hover:border-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 rounded-xl text-xs font-semibold text-slate-900 placeholder-slate-400 transition-all outline-none disabled:bg-slate-100 disabled:cursor-not-allowed',
    search:
      'h-9 w-full pl-9 pr-8 bg-slate-50/70 hover:bg-slate-50 focus:bg-white border border-slate-200/80 focus:border-blue-500 focus:ring-2 focus:ring-blue-600/20 rounded-xl text-xs font-semibold text-slate-900 placeholder-slate-400 transition-all outline-none'
  },
  table: {
    container: 'w-full overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs',
    table: 'w-full text-left border-collapse text-xs',
    th: 'py-2.5 px-3 bg-slate-50/90 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider select-none whitespace-nowrap',
    td: 'py-2.5 px-3 border-b border-slate-100 text-xs font-medium text-slate-800 whitespace-nowrap',
    rowHover: 'hover:bg-slate-50/80 transition-colors'
  },
  modal: {
    backdrop: 'fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4',
    dialog: 'bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-hidden border border-slate-200 flex flex-col',
    header: 'px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white',
    body: 'p-5 overflow-y-auto space-y-4 flex-1',
    footer: 'px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end space-x-2 shrink-0'
  },
  statusBadge: {
    success: 'inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80',
    warning: 'inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200/80',
    error: 'inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200/80',
    info: 'inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200/80',
    neutral: 'inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200/80'
  }
} as const;
