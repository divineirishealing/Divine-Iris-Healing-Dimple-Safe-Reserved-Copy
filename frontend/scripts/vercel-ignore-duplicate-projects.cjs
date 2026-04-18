#!/usr/bin/env node
/**
 * Ignore Build Step for Vercel (optional guard).
 *
 * Vercel semantics (ignoreCommand / Ignored Build Step):
 *   exit 0 → build is SKIPPED (cancelled)
 *   exit 1 → build PROCEEDS
 *
 * By default this script exits 1 so every push builds. Duplicate-project guard is opt-in.
 *
 * To enable “only the canonical project may build”:
 *   Vercel → Project → Settings → Environment Variables:
 *     VERCEL_ENFORCE_PRIMARY_PROJECT = true
 *     VERCEL_PRIMARY_PROJECT_NAME = <exact Project Name from Settings → General>
 *
 * Emergency bypass when enforce is on: ALLOW_NON_PRIMARY_VERCEL_BUILD=true
 */
const onVercel = process.env.VERCEL === '1';

const PRIMARY_PROJECT =
  String(process.env.VERCEL_PRIMARY_PROJECT_NAME || '').trim() ||
  'divine-iris-healing-dimple-safe-res';

/** Proceed with build */
const proceed = () => process.exit(1);
/** Skip build */
const skip = () => process.exit(0);

if (process.env.ALLOW_NON_PRIMARY_VERCEL_BUILD === 'true') {
  proceed();
}

if (!onVercel) {
  proceed();
}

const enforce = String(process.env.VERCEL_ENFORCE_PRIMARY_PROJECT || '').toLowerCase() === 'true';
if (!enforce) {
  proceed();
}

const name = String(process.env.VERCEL_PROJECT_NAME || '').trim();
if (!name || name !== PRIMARY_PROJECT) {
  skip();
}

proceed();
