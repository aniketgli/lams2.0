import express from 'express';
import bcrypt from 'bcrypt';
import { db } from '../../src/db';
import { users } from '../../src/db/schema';
import { eq } from 'drizzle-orm';

const router = express.Router();

router.post('/login', async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!email || !password || email.length > 255 || password.length > 1024) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    const [user] = await db.select().from(users).where(eq(users.email, email));

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Rotate the session identifier after authentication to mitigate session fixation.
    req.session.regenerate((regenerateError) => {
      if (regenerateError) {
        console.error('Session regeneration failed:', regenerateError);
        return res.status(500).json({ message: 'Unable to start a secure session.' });
      }

      req.session.userId = user.id;
      req.session.role = user.role;
      req.session.save((saveError) => {
        if (saveError) {
          console.error('Session save failed:', saveError);
          return res.status(500).json({ message: 'Unable to start a secure session.' });
        }

        return res.json({ user: { id: user.id, name: user.name, role: user.role } });
      });
    });
  } catch (error) {
    console.error('Login error:', error instanceof Error ? error.message : error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      console.error('Logout session destruction failed:', error);
      return res.status(500).json({ message: 'Unable to complete logout.' });
    }

    res.clearCookie('connect.sid', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/'
    });
    return res.status(200).json({ message: 'Logged out' });
  });
});

router.get('/me', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const [user] = await db
      .select({ id: users.id, name: users.name, email: users.email, role: users.role })
      .from(users)
      .where(eq(users.id, req.session.userId));

    if (!user) {
      req.session.destroy(() => undefined);
      return res.status(401).json({ message: 'Session user no longer exists.' });
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.json({ userId: user.id, role: user.role, user });
  } catch (error) {
    console.error('Session identity lookup failed:', error instanceof Error ? error.message : error);
    return res.status(500).json({ message: 'Unable to load the signed-in user.' });
  }
});

export const authRoutes = router;
