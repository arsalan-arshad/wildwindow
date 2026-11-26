import { createDb, users } from '@wildwindow/db';
import { loadEnv } from '@wildwindow/shared';
import { sql } from 'drizzle-orm';
import { z } from 'zod';

const makeAdminEnvSchema = z.object({
  /** Owner / migrations URL — ww_worker has no DML on app.users (§6.3). */
  DATABASE_URL: z.string().min(1),
});

export type MakeAdminOptions = {
  readonly email: string;
  readonly env?: z.infer<typeof makeAdminEnvSchema>;
};

export type MakeAdminResult = {
  readonly userId: string;
  readonly email: string;
  readonly role: 'admin';
  readonly alreadyAdmin: boolean;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Set `app.users.role = 'admin'` for the user with the given email (T5.8).
 * Email is stored on first Firebase Auth upsert; the user must have signed in once.
 */
export async function runMakeAdmin(options: MakeAdminOptions): Promise<MakeAdminResult> {
  const env = options.env ?? loadEnv(makeAdminEnvSchema);
  const email = normalizeEmail(options.email);
  if (email.length === 0 || !email.includes('@')) {
    throw new Error(`make-admin: invalid email (${options.email})`);
  }

  const { db, pool } = createDb({ connectionString: env.DATABASE_URL });
  try {
    const existing = await db
      .select({ id: users.id, email: users.email, role: users.role })
      .from(users)
      .where(sql`lower(${users.email}) = ${email}`)
      .limit(1);

    const row = existing[0];
    if (row === undefined) {
      throw new Error(
        `make-admin: no user with email ${email} — they must sign in once so the API can upsert app.users`,
      );
    }

    if (row.role === 'admin') {
      return {
        userId: row.id,
        email,
        role: 'admin',
        alreadyAdmin: true,
      };
    }

    const [updated] = await db
      .update(users)
      .set({ role: 'admin' })
      .where(sql`lower(${users.email}) = ${email}`)
      .returning({ id: users.id });

    if (updated === undefined) {
      throw new Error(`make-admin: failed to update user ${email}`);
    }

    return {
      userId: updated.id,
      email,
      role: 'admin',
      alreadyAdmin: false,
    };
  } finally {
    await pool.end();
  }
}
