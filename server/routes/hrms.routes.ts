import { Router } from 'express';
import bcrypt from 'bcrypt';
import { randomBytes, randomUUID } from 'node:crypto';
import { db } from '../../src/db';
import { biometric_machines, employee_profiles, organization_settings, shifts, users } from '../../src/db/schema';
import { isAuthenticated, isAdmin } from '../middleware/auth.middleware';
import { eq } from 'drizzle-orm';
import { isIP } from 'node:net';

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

// Shift Master API: database is the source of truth.
function normalizeShift(body: any) {
  const value = body && typeof body === 'object' ? body : {};
  const code = typeof value.code === 'string' ? value.code.trim().toUpperCase() : '';
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!code || code.length > 50 || !name || name.length > 255) {
    return { error: 'Shift code and name are required (maximum 50 and 255 characters).' } as const;
  }
  if (!timePattern.test(value.startTime) || !timePattern.test(value.endTime)) {
    return { error: 'Start time and end time must use HH:MM format.' } as const;
  }
  const grace = Number(value.gracePeriodMins ?? 0);
  const halfDay = Number(value.halfDayHours ?? value.minHalfDayHours ?? 4);
  const fullDay = Number(value.fullDayHours ?? value.minFullDayHours ?? 8);
  if (!Number.isFinite(grace) || grace < 0 || grace > 600 ||
      !Number.isFinite(halfDay) || halfDay < 0 || halfDay > 24 ||
      !Number.isFinite(fullDay) || fullDay < 0 || fullDay > 24) {
    return { error: 'Grace period and hour values are outside allowed ranges.' } as const;
  }
  return { value: {
    code, name, startTime: value.startTime, endTime: value.endTime,
    gracePeriodMins: grace, halfDayHours: String(halfDay), fullDayHours: String(fullDay),
    halfDayCutoffTime: typeof value.halfDayCutoffTime === 'string' && timePattern.test(value.halfDayCutoffTime) ? value.halfDayCutoffTime : null,
    description: typeof value.description === 'string' ? value.description.trim().slice(0, 5000) : null,
    color: typeof value.color === 'string' ? value.color.slice(0, 30) : null,
    applicableDays: Array.isArray(value.applicableDays) ? JSON.stringify(value.applicableDays.filter((d: unknown) => typeof d === 'string').slice(0, 7)) : null,
    isDefault: Boolean(value.isDefault),
    isActive: value.isActive !== false
  }} as const;
}

router.get('/shifts', isAuthenticated, async (_req, res) => {
  try {
    const shiftList = await db.select().from(shifts);
    res.setHeader('Cache-Control', 'no-store');
    return res.json(shiftList.map((shift) => ({
      ...shift,
      halfDayHours: Number(shift.halfDayHours ?? 4),
      fullDayHours: Number(shift.fullDayHours ?? 8),
      minHalfDayHours: Number(shift.halfDayHours ?? 4),
      minFullDayHours: Number(shift.fullDayHours ?? 8),
      applicableDays: (() => { try { return JSON.parse(shift.applicableDays || '[]'); } catch { return []; } })()
    })));
  } catch (error) {
    console.error('Failed to fetch shifts:', error);
    return res.status(500).json({ error: 'Failed to fetch shifts' });
  }
});

router.post('/shifts', isAdmin, async (req, res) => {
  const normalized = normalizeShift(req.body);
  if ('error' in normalized) return res.status(400).json({ error: normalized.error });
  try {
    const [duplicate] = await db.select({ id: shifts.id }).from(shifts).where(eq(shifts.code, normalized.value.code));
    if (duplicate) return res.status(409).json({ error: 'A shift with this code already exists.' });
    const id = typeof req.body.id === 'string' && req.body.id.length <= 36 ? req.body.id : randomUUID();
    if (normalized.value.isDefault) {
      await db.transaction(async (tx) => {
        await tx.update(shifts).set({ isDefault: false });
        await tx.insert(shifts).values({ id, ...normalized.value });
      });
    } else {
      await db.insert(shifts).values({ id, ...normalized.value });
    }
    return res.status(201).json({ id, message: 'Shift created in database.' });
  } catch (error) {
    console.error('Failed to create shift:', error);
    return res.status(500).json({ error: 'Failed to create shift' });
  }
});

router.put('/shifts/:id', isAdmin, async (req, res) => {
  const normalized = normalizeShift(req.body);
  if ('error' in normalized) return res.status(400).json({ error: normalized.error });
  try {
    const [existing] = await db.select({ id: shifts.id }).from(shifts).where(eq(shifts.id, req.params.id));
    if (!existing) return res.status(404).json({ error: 'Shift not found.' });
    const [duplicate] = await db.select({ id: shifts.id }).from(shifts).where(eq(shifts.code, normalized.value.code));
    if (duplicate && duplicate.id !== req.params.id) return res.status(409).json({ error: 'A shift with this code already exists.' });
    if (normalized.value.isDefault) {
      await db.transaction(async (tx) => {
        await tx.update(shifts).set({ isDefault: false });
        await tx.update(shifts).set(normalized.value).where(eq(shifts.id, req.params.id));
      });
    } else {
      await db.update(shifts).set(normalized.value).where(eq(shifts.id, req.params.id));
    }
    return res.json({ message: 'Shift updated in database.' });
  } catch (error) {
    console.error('Failed to update shift:', error);
    return res.status(500).json({ error: 'Failed to update shift' });
  }
});

router.delete('/shifts/:id', isAdmin, async (req, res) => {
  try {
    const [target] = await db.select().from(shifts).where(eq(shifts.id, req.params.id));
    if (!target) return res.status(404).json({ error: 'Shift not found.' });
    if (target.isDefault) return res.status(409).json({ error: 'Set another shift as default before deleting this shift.' });
    const [assigned] = await db.select({ id: employee_profiles.userId }).from(employee_profiles).where(eq(employee_profiles.shiftId, req.params.id));
    if (assigned) return res.status(409).json({ error: 'This shift is assigned to employees. Deactivate it instead of deleting.' });
    await db.delete(shifts).where(eq(shifts.id, req.params.id));
    return res.json({ message: 'Shift deleted from database.' });
  } catch (error) {
    console.error('Failed to delete shift:', error);
    return res.status(500).json({ error: 'Failed to delete shift' });
  }
});



// Biometric Machines Master
function normalizeBiometricPayload(body: any) {
  const value = body && typeof body === 'object' ? body : {};
  const id = typeof value.id === 'string' ? value.id.trim() : '';
  const fullName = typeof value.fullName === 'string' ? value.fullName.trim() : '';
  const shortName = typeof value.shortName === 'string' ? value.shortName.trim().toUpperCase() : '';
  const serialNumber = typeof value.serialNumber === 'string' ? value.serialNumber.trim().toUpperCase() : '';
  const ipAddress = typeof value.ipAddress === 'string' ? value.ipAddress.trim() : '';
  if (!id || id.length > 64 || !fullName || fullName.length > 255 ||
      !shortName || shortName.length > 80 || !serialNumber || serialNumber.length > 120) {
    return { error: 'Device ID, Device Full Name, Short Name and Serial Number are required.' } as const;
  }
  if (isIP(ipAddress) === 0) {
    return { error: 'Enter a valid IPv4 or IPv6 address.' } as const;
  }
  return { value: { id, fullName, shortName, serialNumber, ipAddress } } as const;
}

router.get('/biometric-machines', isAuthenticated, async (_req, res) => {
  try {
    return res.json(await db.select().from(biometric_machines));
  } catch (error) {
    console.error('Failed to fetch biometric machines:', error);
    return res.status(500).json({ error: 'Failed to fetch biometric machines.' });
  }
});

router.post('/biometric-machines', isAdmin, async (req, res) => {
  const normalized = normalizeBiometricPayload(req.body);
  if ('error' in normalized) return res.status(400).json({ error: normalized.error });
  try {
    await db.insert(biometric_machines).values(normalized.value);
    return res.status(201).json({ ...normalized.value, message: 'Biometric machine saved.' });
  } catch (error) {
    const err = error as any;
    if (err?.code === 'ER_DUP_ENTRY' || String(err?.message || '').includes('Duplicate entry')) {
      return res.status(409).json({ error: 'Device ID, Short Name or Serial Number already exists.' });
    }
    console.error('Failed to create biometric machine:', error);
    return res.status(500).json({ error: 'Failed to save biometric machine.' });
  }
});

router.put('/biometric-machines/:id', isAdmin, async (req, res) => {
  const normalized = normalizeBiometricPayload({ ...req.body, id: req.params.id });
  if ('error' in normalized) return res.status(400).json({ error: normalized.error });
  try {
    const [existing] = await db.select({ id: biometric_machines.id }).from(biometric_machines).where(eq(biometric_machines.id, req.params.id));
    if (!existing) return res.status(404).json({ error: 'Biometric machine not found.' });
    const [shortNameOwner] = await db.select({ id: biometric_machines.id }).from(biometric_machines).where(eq(biometric_machines.shortName, normalized.value.shortName));
    const [serialOwner] = await db.select({ id: biometric_machines.id }).from(biometric_machines).where(eq(biometric_machines.serialNumber, normalized.value.serialNumber));
    if ((shortNameOwner && shortNameOwner.id !== req.params.id) || (serialOwner && serialOwner.id !== req.params.id)) {
      return res.status(409).json({ error: 'Short Name or Serial Number already belongs to another device.' });
    }
    await db.update(biometric_machines).set({
      fullName: normalized.value.fullName,
      shortName: normalized.value.shortName,
      serialNumber: normalized.value.serialNumber,
      ipAddress: normalized.value.ipAddress
    }).where(eq(biometric_machines.id, req.params.id));
    return res.json({ ...normalized.value, message: 'Biometric machine updated.' });
  } catch (error) {
    console.error('Failed to update biometric machine:', error);
    return res.status(500).json({ error: 'Failed to update biometric machine.' });
  }
});

router.delete('/biometric-machines/:id', isAdmin, async (req, res) => {
  try {
    const [existing] = await db.select({ id: biometric_machines.id }).from(biometric_machines).where(eq(biometric_machines.id, req.params.id));
    if (!existing) return res.status(404).json({ error: 'Biometric machine not found.' });
    await db.delete(biometric_machines).where(eq(biometric_machines.id, req.params.id));
    return res.json({ message: 'Biometric machine deleted.' });
  } catch (error) {
    console.error('Failed to delete biometric machine:', error);
    return res.status(500).json({ error: 'Failed to delete biometric machine.' });
  }
});

// Organization Master: a single row keyed by "default".
router.get('/organization', isAuthenticated, async (_req, res) => {
  try {
    const [organization] = await db.select().from(organization_settings).where(eq(organization_settings.id, 'default'));
    return res.json(organization || null);
  } catch (error) {
    console.error('Failed to fetch organization settings:', error);
    return res.status(500).json({ error: 'Failed to fetch organization settings.' });
  }
});

router.put('/organization', isAdmin, async (req, res) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const orgName = typeof body.orgName === 'string' ? body.orgName.trim() : '';
  const address = typeof body.address === 'string' ? body.address.trim() : '';
  const copyrightText = typeof body.copyrightText === 'string' ? body.copyrightText.trim() : '';
  const logoData = typeof body.logoData === 'string' && body.logoData ? body.logoData : null;
  if (!orgName || orgName.length > 255) return res.status(400).json({ error: 'Organization name is required (maximum 255 characters).' });
  if (address.length > 5000 || copyrightText.length > 500) return res.status(400).json({ error: 'Address or copyright text exceeds the allowed length.' });
  if (logoData && !(/^data:image\\/(png|jpeg|webp|svg\\+xml);base64,/.test(logoData) || /^https?:\\/\\//i.test(logoData)) || (logoData && logoData.length > 2_800_000)) {
    return res.status(400).json({ error: 'Logo must be PNG, JPG, WEBP or SVG and smaller than 2 MB.' });
  }
  try {
    await db.insert(organization_settings).values({
      id: 'default', orgName, logoData, address: address || null, copyrightText: copyrightText || null
    }).onDuplicateKeyUpdate({
      set: { orgName, logoData, address: address || null, copyrightText: copyrightText || null }
    });
    const [saved] = await db.select().from(organization_settings).where(eq(organization_settings.id, 'default'));
    return res.json(saved);
  } catch (error) {
    console.error('Failed to save organization settings:', error);
    return res.status(500).json({ error: 'Failed to save organization settings.' });
  }
});

export default router;
