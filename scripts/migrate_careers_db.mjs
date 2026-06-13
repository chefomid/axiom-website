#!/usr/bin/env node
/** Create careers_submissions table. Run from repo root: npm run migrate:careers-db */

import { ensureCareersSchema, isCareersDbEnabled } from '../api/careers/db.js'

async function main() {
  if (!isCareersDbEnabled()) {
    console.error('FAIL: CAREERS_DATABASE_URL is not set.')
    return 1
  }

  try {
    await ensureCareersSchema()
    console.log('OK: careers_submissions schema is ready.')
    return 0
  } catch (err) {
    console.error(`FAIL: ${err?.message ?? err}`)
    return 1
  }
}

main().then(code => process.exit(code))
