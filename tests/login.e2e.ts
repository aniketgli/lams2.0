import { test } from '@e2e-dev/web';
import { expect } from 'e2e';

test('shows the sign-in form', async ({ app, screen }) => {
  await app.open('/');

  await expect(screen.getByRole('heading', 'Sign in')).toBeVisible();
  await expect(screen.getByLabel('Email')).toBeVisible();
  await expect(screen.getByLabel('Password')).toBeVisible();
});

test('rejects an email outside the institute domains', async ({ app, screen }) => {
  await app.open('/');

  await screen.getByLabel('Email').fill('someone@gmail.com');
  await screen.getByLabel('Password').fill('not-a-real-password');
  await screen.getByRole('button', 'Sign in').click();

  // The domain check is done by the server before any account lookup.
  await expect(screen.getByText('Sign in with your institute email')).toBeVisible();
});
