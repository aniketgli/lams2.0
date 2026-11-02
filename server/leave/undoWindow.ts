/** A leave decision can be undone only for a short time after it was made. */
export const UNDO_WINDOW_MINUTES = 10;

/** `ageSeconds` is how long ago the step was taken, measured by the database clock. */
export function withinUndoWindow(ageSeconds: unknown): boolean {
  if (ageSeconds === null || ageSeconds === undefined || ageSeconds === '') return false;
  const age = Number(ageSeconds);
  return Number.isFinite(age) && age <= UNDO_WINDOW_MINUTES * 60;
}
