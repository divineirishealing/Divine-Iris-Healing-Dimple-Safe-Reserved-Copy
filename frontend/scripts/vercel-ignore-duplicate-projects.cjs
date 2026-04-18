#!/usr/bin/env node
/**
 * Ignore Build Step for Vercel: only the canonical project may create deployments.
 * Multiple Vercel projects were linked to the same GitHub repo, which triggered
 * three deployments per push and hit Hobby deployment rate limits.
 *
 * Override (e.g. temporary): set env ALLOW_NON_PRIMARY_VERCEL_BUILD=true on a project.
 */
/** Vercel sets this during the ignore-build step and the build. */
const onVercel = process.env.VERCEL === '1';

/**
 * Canonical project slug (Vercel → Project Settings → General → Project Name).
 * If you renamed the Vercel project, set env VERCEL_PRIMARY_PROJECT_NAME to the exact
 * Project Name (Settings → General) or the ignore step skips every build.
 */
const PRIMARY_PROJECT =
  String(process.env.VERCEL_PRIMARY_PROJECT_NAME || '').trim() ||
  'divine-iris-healing-dimple-safe-res';

if (process.env.ALLOW_NON_PRIMARY_VERCEL_BUILD === 'true') {
  process.exit(0);
}

if (!onVercel) {
  process.exit(0);
}

const name = String(process.env.VERCEL_PROJECT_NAME || '').trim();

// Empty name: do not build (same as before). Wrong name: duplicate/legacy project — skip.
if (!name || name !== PRIMARY_PROJECT) {
  process.exit(1);
}

process.exit(0);
