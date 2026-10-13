import { Router } from 'express';
import { db } from '../../src/db';
import { employee_profiles, shifts } from '../../src/db/schema';
import { isAuthenticated, isAdmin } from '../middleware/auth.middleware';
import { eq } from 'drizzle-orm';

const router = Router();

// Employees
router.get('/employees', isAuthenticated, async (req, res) => {
  try {
    const employees = await db.select().from(employee_profiles);
    res.json(employees);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
});

router.get('/employees/:userId', isAuthenticated, async (req, res) => {
  try {
    const result = await db.select().from(employee_profiles).where(eq(employee_profiles.userId, req.params.userId));
    if (result.length === 0) return res.status(404).json({ error: 'Employee not found' });
    res.json(result[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch employee' });
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
