import { Router } from 'express';
import { db } from '../../src/db';
import { employee_profiles, shifts, users } from '../../src/db/schema';
import { isAuthenticated, isAdmin } from '../middleware/auth.middleware';
import { eq } from 'drizzle-orm';

const router = Router();

// Employees
router.get('/employees', isAuthenticated, async (_req, res) => {
  try {
    // The directory needs account and profile fields together. LEFT JOIN keeps
    // valid login accounts visible even before their employee profile is completed.
    const employees = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        department: employee_profiles.department,
        designation: employee_profiles.designation,
        employmentType: employee_profiles.employmentType,
        joiningDate: employee_profiles.joiningDate,
        phone: employee_profiles.phone,
        officeLocation: employee_profiles.officeLocation,
        shiftId: employee_profiles.shiftId
      })
      .from(users)
      .leftJoin(employee_profiles, eq(users.id, employee_profiles.userId));

    res.setHeader('Cache-Control', 'no-store');
    return res.json(employees);
  } catch (error) {
    console.error('Failed to fetch employees:', error instanceof Error ? error.message : error);
    return res.status(500).json({ error: 'Failed to fetch employees' });
  }
});

router.get('/employees/:userId', isAuthenticated, async (req, res) => {
  try {
    const [employee] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        department: employee_profiles.department,
        designation: employee_profiles.designation,
        employmentType: employee_profiles.employmentType,
        joiningDate: employee_profiles.joiningDate,
        phone: employee_profiles.phone,
        officeLocation: employee_profiles.officeLocation,
        shiftId: employee_profiles.shiftId
      })
      .from(users)
      .leftJoin(employee_profiles, eq(users.id, employee_profiles.userId))
      .where(eq(users.id, req.params.userId));

    if (!employee) return res.status(404).json({ error: 'Employee not found' });
    res.setHeader('Cache-Control', 'no-store');
    return res.json(employee);
  } catch (error) {
    console.error('Failed to fetch employee:', error instanceof Error ? error.message : error);
    return res.status(500).json({ error: 'Failed to fetch employee' });
  }
});

router.post('/employees', isAdmin, async (req, res) => {
  try {
    await db.insert(employee_profiles).values(req.body);
    res.status(201).json({ message: 'Employee created' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create employee' });
  }
});

router.put('/employees/:userId', isAdmin, async (req, res) => {
  try {
    await db.update(employee_profiles).set(req.body).where(eq(employee_profiles.userId, req.params.userId));
    res.json({ message: 'Employee updated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update employee' });
  }
});

// Shifts
router.get('/shifts', isAuthenticated, async (req, res) => {
  try {
    const shiftList = await db.select().from(shifts);
    res.json(shiftList);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch shifts' });
  }
});

router.post('/shifts', isAdmin, async (req, res) => {
  try {
    await db.insert(shifts).values(req.body);
    res.status(201).json({ message: 'Shift created' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create shift' });
  }
});

router.put('/shifts/:id', isAdmin, async (req, res) => {
  try {
    await db.update(shifts).set(req.body).where(eq(shifts.id, req.params.id));
    res.json({ message: 'Shift updated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update shift' });
  }
});

export default router;
