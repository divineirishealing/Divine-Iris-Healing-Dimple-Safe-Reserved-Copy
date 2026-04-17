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

/** Matches project name in Vercel dashboard and GitHub commit status (Vercel – …). */
const PRIMARY_PROJECT = 'divine-iris-healing-dimple-safe-res';

if (process.env.ALLOW_NON_PRIMARY_VERCEL_BUILD === 'true') {
  process.exit(0);
}

if (!onVercel) {
  process.exit(0);
}

const name = String(process.env.VERCEL_PROJECT_NAME || '').trim();

// If we cannot identify the project, skip — otherwise an empty name treated as “primary”
// lets every linked clone run a deployment and burns Hobby rate limits (3× per push).
if (!name || name !== PRIMARY_PROJECT) {
  process.exit(1);
}

process.exit(0);
