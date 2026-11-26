import { AdminHub } from '@/components/admin/admin-hub';

export default function AdminPage() {
  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm uppercase tracking-wide text-ink-muted">W-07</p>
        <h1 className="font-display text-3xl text-ink sm:text-4xl">Admin</h1>
        <p className="mt-2 max-w-prose text-ink-muted">
          Curate species cards and sensitivity tiers. Sign-in is Firebase; the admin role is checked
          through the API.
        </p>
      </header>
      <AdminHub />
    </div>
  );
}
