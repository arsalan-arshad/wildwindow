/**
 * Next.js instrumentation hook — init Sentry on the Node runtime (T9.1).
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register(): Promise<void> {
  if (process.env['NEXT_RUNTIME'] === 'nodejs' || process.env['NEXT_RUNTIME'] === undefined) {
    const { initSentry } = await import('./lib/sentry');
    await initSentry();
  }
}
