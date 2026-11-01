/**
 * One look for every icon action button in the software (view, edit, delete, approve, reject, undo…).
 * The colour tells what the action does, never which screen it is on: neutral for look/change actions, success for
 * approve/forward, danger for reject/delete, warning for undo, primary for form-style actions. All from the theme tokens.
 */
export type ActionTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';

const BASE = 'w-8 h-8 rounded-lg border inline-flex items-center justify-center shrink-0 cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50 disabled:cursor-not-allowed';

export const ACTION_TONES: Record<ActionTone, string> = {
  neutral: 'border-slate-200 bg-white text-slate-600 hover:bg-primary-subtle hover:text-primary hover:border-primary-border',
  primary: 'border-primary-border bg-primary-subtle text-primary hover:bg-primary-light',
  success: 'border-success-border bg-success-subtle text-success hover:brightness-95',
  warning: 'border-warning-border bg-warning-subtle text-warning hover:brightness-95',
  danger: 'border-error-border bg-error-subtle text-error hover:brightness-95',
};

export const actionBtn = (tone: ActionTone = 'neutral'): string => `${BASE} ${ACTION_TONES[tone]}`;
