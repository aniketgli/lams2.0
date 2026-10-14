import { Router } from 'express';
import bcrypt from 'bcrypt';
import { randomBytes, randomUUID } from 'node:crypto';
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
        suffix: employee_profiles.suffix,
        email: users.email,
        role: users.role,
        department: employee_profiles.department,
        designation: employee_profiles.designation,
        employmentType: employee_profiles.employmentType,
        joiningDate: employee_profiles.joiningDate,
        phone: employee_profiles.phone,
        officeLocation: employee_profiles.officeLocation,
        shiftId: employee_profiles.shiftId,
        profileData: employee_profiles.profileData
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
        suffix: employee_profiles.suffix,
        email: users.email,
        role: users.role,
        department: employee_profiles.department,
        designation: employee_profiles.designation,
        employmentType: employee_profiles.employmentType,
        joiningDate: employee_profiles.joiningDate,
        phone: employee_profiles.phone,
        officeLocation: employee_profiles.officeLocation,
        shiftId: employee_profiles.shiftId,
        profileData: employee_profiles.profileData
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

const allowedRoles = new Set(['administrator', 'reporting_manager', 'reviewing_manager', 'general_staff', 'audit']);
const allowedEmploymentTypes = new Set(['permanent', 'contractual', 'researcher', 'diploma_trainee', 'intern', 'bsc_msc_student', 'phd_student']);

function normalizeEmployeePayload(body: any) {
  const profile = body && typeof body === 'object' ? body : {};
  const name = typeof profile.name === 'string' ? profile.name.trim() : '';
  const email = typeof profile.email === 'string' ? profile.email.trim().toLowerCase() : '';
  const role = typeof profile.role === 'string' && allowedRoles.has(profile.role) ? profile.role : 'general_staff';
  const employmentType = typeof profile.employmentType === 'string' && allowedEmploymentTypes.has(profile.employmentType)
    ? profile.employmentType : 'permanent';
  return { profile, name, email, role, employmentType };
}

function toProfileRow(userId: string, profile: Record<string, any>, role: string, employmentType: string) {
  return {
    userId,
    suffix: ['Mr.', 'Mrs.', 'Miss', 'Dr.'].includes(profile.suffix) ? profile.suffix : null,
    department: typeof profile.department === 'string' && profile.department.trim() ? profile.department.trim() : 'Unassigned',
    designation: typeof profile.designation === 'string' && profile.designation.trim() ? profile.designation.trim() : 'Staff',
    employmentType,
    joiningDate: typeof profile.joiningDate === 'string' && profile.joiningDate ? profile.joiningDate.slice(0, 10) : '1970-01-01',
    phone: typeof profile.phone === 'string' ? profile.phone : null,
    officeLocation: typeof profile.officeLocation === 'string' ? profile.officeLocation : null,
    shiftId: typeof profile.shiftId === 'string' ? profile.shiftId : null,
    profileData: JSON.stringify({ ...profile, id: userId, name: profile.name, email: profile.email, role, employmentType })
  };
}

// Create account and employee profile together. A random unknown initial password prevents
// accidentally issuing a predictable credential; use the approved password-reset flow to activate login.
router.post('/employees', isAdmin, async (req, res) => {
  const { profile, name, email, role, employmentType } = normalizeEmployeePayload(req.body);
  if (!name || !email || email.length > 255 || !email.includes('@')) {
    return res.status(400).json({ error: 'A valid employee name and email are required.' });
  }

  const userId = typeof profile.id === 'string' && profile.id.length <= 36 ? profile.id : randomUUID();
  try {
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
    if (existing) return res.status(409).json({ error: 'An account with this email already exists.' });

    const initialSecret = randomBytes(32).toString('hex');
    const passwordHash = await bcrypt.hash(initialSecret, 12);
    const profileRow = toProfileRow(userId, { ...profile, name, email }, role, employmentType);

    await db.transaction(async (tx) => {
      await tx.insert(users).values({ id: userId, name, email, passwordHash, role });
      await tx.insert(employee_profiles).values(profileRow);
    });

    res.setHeader('Cache-Control', 'no-store');
    return res.status(201).json({ id: userId, message: 'Employee saved to database.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('Duplicate entry') || (error as any)?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'An account or employee profile with this email/ID already exists.' });
    }
    console.error('Failed to create employee:', message);
    return res.status(500).json({ error: 'Failed to create employee.' });
  }
});

router.put('/employees/:userId', isAdmin, async (req, res) => {
  const userId = req.params.userId;
  const { profile, name, email, role, employmentType } = normalizeEmployeePayload(req.body);
  if (!name || !email || email.length > 255 || !email.includes('@')) {
    return res.status(400).json({ error: 'A valid employee name and email are required.' });
  }

  try {
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId));
    if (!existing) return res.status(404).json({ error: 'Employee account not found.' });

    const [emailOwner] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
    if (emailOwner && emailOwner.id !== userId) {
      return res.status(409).json({ error: 'Another account already uses this email.' });
    }

    const profileRow = toProfileRow(userId, { ...profile, name, email }, role, employmentType);
    await db.transaction(async (tx) => {
      await tx.update(users).set({ name, email, role }).where(eq(users.id, userId));
      await tx.insert(employee_profiles).values(profileRow).onDuplicateKeyUpdate({
        set: {
          suffix: profileRow.suffix,
          department: profileRow.department,
          designation: profileRow.designation,
          employmentType: profileRow.employmentType,
          joiningDate: profileRow.joiningDate,
          phone: profileRow.phone,
          officeLocation: profileRow.officeLocation,
          shiftId: profileRow.shiftId,
          profileData: profileRow.profileData
        }
      });
    });

    res.setHeader('Cache-Control', 'no-store');
    return res.json({ id: userId, message: 'Employee profile updated in database.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('Duplicate entry') || (error as any)?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Another account already uses this email.' });
    }
    console.error('Failed to update employee:', message);
    return res.status(500).json({ error: 'Failed to update employee.' });
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
