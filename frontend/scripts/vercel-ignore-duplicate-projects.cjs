#!/usr/bin/env node
/**
 * Ignore Build Step for Vercel (optional guard).
 *
 * By default this script does NOT skip builds — renamed/misnamed projects were exiting1
 * and blocking all production deploys.
 *
 * To re-enable “only the canonical project may build” (e.g. duplicate Hobby projects):
 *   Vercel → Project → Settings → Environment Variables:
 *     VERCEL_ENFORCE_PRIMARY_PROJECT = true
 *     VERCEL_PRIMARY_PROJECT_NAME = <exact Project Name from Settings → General>
 *
 * Emergency bypass: ALLOW_NON_PRIMARY_VERCEL_BUILD=true
 */
const onVercel = process.env.VERCEL === '1';

const PRIMARY_PROJECT =
  String(process.env.VERCEL_PRIMARY_PROJECT_NAME || '').trim() ||
  'divine-iris-healing-dimple-safe-res';

if (process.env.ALLOW_NON_PRIMARY_VERCEL_BUILD === 'true') {
  process.exit(0);
}

if (!onVercel) {
  process.exit(0);
}

const enforce = String(process.env.VERCEL_ENFORCE_PRIMARY_PROJECT || '').toLowerCase() === 'true';
if (!enforce) {
  process.exit(0);
}

const name = String(process.env.VERCEL_PROJECT_NAME || '').trim();
if (!name || name !== PRIMARY_PROJECT) {
  process.exit(1);
}

process.exit(0);
