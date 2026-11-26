import { createDb, migrationsFolder, runMigrations, users } from '@wildwindow/db';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { runMakeAdmin } from './make-admin.js';

const DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/wildwindow';

const EMAIL = 'make-admin-test@example.com';

describe('make-admin (T5.8)', () => {
  const { db, pool } = createDb({ connectionString: DATABASE_URL });

  beforeAll(async () => {
    await runMigrations(DATABASE_URL, migrationsFolder());
  });

  beforeEach(async () => {
    await db.delete(users).where(eq(users.email, EMAIL));
  });

  afterAll(async () => {
    await db.delete(users).where(eq(users.email, EMAIL));
    await pool.end();
  });

  it('promotes an existing user by email', async () => {
    const [inserted] = await db
      .insert(users)
      .values({
        firebaseUid: `make-admin-uid-${String(Date.now())}`,
        email: EMAIL,
        displayName: 'Admin Candidate',
        role: 'user',
      })
      .returning({ id: users.id });
    expect(inserted).toBeDefined();

    const result = await runMakeAdmin({
      email: '  Make-Admin-Test@Example.com ',
      env: { DATABASE_URL },
    });

    expect(result).toMatchObject({
      userId: inserted?.id,
      email: EMAIL,
      role: 'admin',
      alreadyAdmin: false,
    });

    const rows = await db.select({ role: users.role }).from(users).where(eq(users.email, EMAIL));
    expect(rows[0]?.role).toBe('admin');
  });

  it('is idempotent when already admin', async () => {
    await db.insert(users).values({
      firebaseUid: `make-admin-uid-idem-${String(Date.now())}`,
      email: EMAIL,
      role: 'admin',
    });

    const result = await runMakeAdmin({
      email: EMAIL,
      env: { DATABASE_URL },
    });
    expect(result.alreadyAdmin).toBe(true);
    expect(result.role).toBe('admin');
  });

  it('throws when the email is unknown', async () => {
    await expect(
      runMakeAdmin({
        email: 'nobody-here@example.com',
        env: { DATABASE_URL },
      }),
    ).rejects.toThrow(/no user with email/);
  });
});
