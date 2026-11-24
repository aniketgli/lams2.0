/** Each portal's name, as the lobby cards and the header show it (keyed by the server module id). */
export const PORTAL_NAMES: Record<string, { title: string; subtitle: string }> = {
  hrms: { title: 'HRMS', subtitle: 'Human Resource Management System' },
  pms: { title: 'PMS', subtitle: 'Project Management System' },
  stock: { title: 'Stock Inventory', subtitle: 'Inventory & Supply Chain Management' },
  finance: { title: 'Finance Management', subtitle: 'Financial Planning & Accounting' },
  facility: { title: 'Facility Management', subtitle: 'Facilities & Asset Management' },
};
