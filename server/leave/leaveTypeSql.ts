/**
 * Columns of a leave type for SELECT … FROM leave_types t. The employee types it is for and its purposes are kept one
 * per row (leave_type_employee_types, leave_type_purposes); here they are read back as the comma / line lists the
 * leave rules work with.
 */
export const LEAVE_TYPE_SELECT = `t.*,
  (SELECT GROUP_CONCAT(e.employee_type_code ORDER BY e.employee_type_code SEPARATOR ',') FROM leave_type_employee_types e WHERE e.leave_type_id = t.id) AS employee_types,
  (SELECT GROUP_CONCAT(p.purpose ORDER BY p.sort_order SEPARATOR '\n') FROM leave_type_purposes p WHERE p.leave_type_id = t.id) AS purposes`;
