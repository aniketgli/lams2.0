/**
 * Fixed lists on the employee form that have no master of their own.
 * Kept in one place so the form, the masters that refer to them and the
 * server checks always agree.
 */

/** Cadre of permanent / contractual staff. Designations and institute units can be tied to cadres. */
export const CADRES = [
  'Scientific', 'Technical', 'Support', 'Administrative', 'Finance', 'Stenographer', 'Driver', 'Multi Tasking Staff',
] as const;

/** Category (how a permanent employee was recruited). */
export const RECRUITMENT_CATEGORIES = ['Direct', 'Deputation'] as const;
