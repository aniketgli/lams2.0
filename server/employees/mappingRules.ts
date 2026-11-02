import { Validator, isValidIsoDate } from '../lib/validate';

/**
 * Employees Mapping: input rules for a transfer order and a manager replacement.
 * Pure (no database) so they can be tested on their own; the database checks live in mapping.ts.
 */

const ID = /^\d{1,20}$/;
export const MAX_PEOPLE_PER_ORDER = 200;

export interface TransferInput {
  userIds: number[];
  department: string | null;
  reportingManagerId: number | null;
  reviewingManagerId: number | null;
  effectiveDate: string;
  notes: string | null;
}

export type ReplaceScope = 'reporting' | 'reviewing' | 'both';

export interface ReplaceInput {
  outgoingManagerId: number;
  incomingManagerId: number;
  scope: ReplaceScope;
  /** Empty = every reportee of the outgoing manager. */
  userIds: number[];
  effectiveDate: string;
  notes: string | null;
}

function idList(v: Validator, field: string, required: boolean): number[] {
  const raw = v.raw(field);
  if (raw === undefined || raw === null || (Array.isArray(raw) && raw.length === 0)) {
    if (required) v.errors[field] ||= 'Choose at least one employee.';
    return [];
  }
  if (!Array.isArray(raw)) { v.errors[field] ||= 'Choose employees from the list.'; return []; }
  if (raw.length > MAX_PEOPLE_PER_ORDER) { v.errors[field] ||= `An order can cover at most ${MAX_PEOPLE_PER_ORDER} employees.`; return []; }
  const ids: number[] = [];
  for (const item of raw) {
    const text = String(item ?? '').trim();
    if (!ID.test(text)) { v.errors[field] ||= 'Choose employees from the list.'; return []; }
    ids.push(Number(text));
  }
  return [...new Set(ids)].sort((a, b) => a - b);
}

function optionalIdField(v: Validator, field: string): number | null {
  const raw = v.raw(field);
  if (raw === undefined || raw === null || raw === '') return null;
  const text = String(raw).trim();
  if (!ID.test(text)) { v.errors[field] ||= 'Choose a person from the list.'; return null; }
  return Number(text);
}

function requiredIdField(v: Validator, field: string): number {
  const value = optionalIdField(v, field);
  if (value === null) v.errors[field] ||= 'This field is required.';
  return value ?? 0;
}

/** An order takes effect today or earlier, never in the future. */
function effective(v: Validator, today: string): string {
  const date = v.date('effectiveDate') ?? today;
  if (date > today) v.errors.effectiveDate ||= 'The effective date cannot be in the future.';
  return date;
}

export function parseTransfer(body: unknown, today: string): TransferInput {
  const v = new Validator(body);
  const userIds = idList(v, 'userIds', true);
  const department = v.optionalString('department', { max: 255 });
  const reportingManagerId = optionalIdField(v, 'reportingManagerId');
  const reviewingManagerId = optionalIdField(v, 'reviewingManagerId');
  const effectiveDate = effective(v, today);
  const notes = v.optionalString('notes', { max: 500 });
  if (!department && !reportingManagerId && !reviewingManagerId) {
    v.errors.department ||= 'Choose a new department, reporting manager or HoD.';
  }
  v.assert();
  return { userIds, department, reportingManagerId, reviewingManagerId, effectiveDate, notes };
}

export function parseReplace(body: unknown, today: string): ReplaceInput {
  const v = new Validator(body);
  const outgoingManagerId = requiredIdField(v, 'outgoingManagerId');
  const incomingManagerId = requiredIdField(v, 'incomingManagerId');
  if (outgoingManagerId && outgoingManagerId === incomingManagerId) v.errors.incomingManagerId ||= 'The incoming manager must be a different person.';
  const scope = v.oneOf('scope', ['reporting', 'reviewing', 'both'] as const)!;
  const userIds = idList(v, 'userIds', false);
  const effectiveDate = effective(v, today);
  const notes = v.optionalString('notes', { max: 500 });
  v.assert();
  return { outgoingManagerId, incomingManagerId, scope, userIds, effectiveDate, notes };
}

export interface LogFilter {
  kind: 'transfer' | 'manager_change' | null;
  department: string | null;
  search: string | null;
  from: string | null;
  to: string | null;
}

export function parseLogFilter(query: Record<string, unknown>): LogFilter {
  const one = (k: string) => (typeof query[k] === 'string' && query[k] ? String(query[k]).trim() : null);
  const v = new Validator({});
  const kind = one('kind');
  if (kind && kind !== 'transfer' && kind !== 'manager_change') v.errors.kind = 'Unknown order type.';
  const from = one('from');
  const to = one('to');
  if (from && !isValidIsoDate(from)) v.errors.from = 'Invalid from date.';
  if (to && !isValidIsoDate(to)) v.errors.to = 'Invalid to date.';
  if (from && to && from > to) v.errors.to ||= 'The from date must be on or before the to date.';
  v.assert();
  return { kind: kind as LogFilter['kind'], department: one('department')?.slice(0, 255) ?? null, search: one('search')?.slice(0, 100) ?? null, from, to };
}
