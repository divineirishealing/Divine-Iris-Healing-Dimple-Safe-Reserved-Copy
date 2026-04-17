#!/usr/bin/env node
/**
 * Ignore Build Step for Vercel: only the canonical project may create deployments.
 * Multiple Vercel projects were linked to the same GitHub repo, which triggered
 * three deployments per push and hit Hobby deployment rate limits.
 *
 * Override (e.g. temporary): set env ALLOW_NON_PRIMARY_VERCEL_BUILD=true on a project.
 */
const isVercel = process.env.VERCEL === '1';
/** Matches project name in Vercel dashboard and GitHub commit status context. */
const PRIMARY_PROJECT = 'divine-iris-healing-dimple-safe-res';

if (process.env.ALLOW_NON_PRIMARY_VERCEL_BUILD === 'true') {
  process.exit(0);
}

if (!isVercel) {
  process.exit(0);
}

const name = process.env.VERCEL_PROJECT_NAME || '';
if (!name) {
  process.exit(0);
}

process.exit(name === PRIMARY_PROJECT ? 0 : 1);
