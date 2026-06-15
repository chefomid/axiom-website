#!/usr/bin/env node
/** Create careers_submissions table. Run from repo root: npm run migrate:careers-db */

import { ensureStorageReady, isCareersStorageEnabled } from '../api/careers/store.js'

async function main() {
  if (!isCareersStorageEnabled()) {
    console.error('FAIL: CAREERS_DATABASE_URL is not set (local file store is dev-only).')
    return 1
  }

  try {
    await ensureStorageReady()
    console.log('OK: careers submissions storage is ready.')
    return 0
  } catch (err) {
    console.error(`FAIL: ${err?.message ?? err}`)
    return 1
  }
}

main().then(code => process.exit(code))
