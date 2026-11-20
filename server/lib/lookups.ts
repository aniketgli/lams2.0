/**
 * The lists of the employee form, one table each (migrations/20261219_02_list_tables.sql).
 * Every table has id, code (unique), name, sort_order, status ('ACTIVE' / 'INACTIVE'); employee_types also has
 * form_layout. Other tables point at the code with a foreign key.
 *
 * Table names come only from this map, never from a request.
 */
export const LOOKUP_TABLES = {
  salutation: 'salutations',
  gender: 'genders',
  institute: 'institutes',
  employee_type: 'employee_types',
  org_unit_type: 'org_unit_types',
  cadre_group: 'cadre_groups',
  funding_category: 'funding_categories',
} as const;

export type LookupType = keyof typeof LOOKUP_TABLES;

export function isLookupType(value: unknown): value is LookupType {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(LOOKUP_TABLES, value);
}

/** Table of a list; throws for an unknown list (a programming error, never user input). */
export function lookupTable(type: string): string {
  if (!isLookupType(type)) throw new Error(`Unknown list: ${type}`);
  return LOOKUP_TABLES[type];
}
