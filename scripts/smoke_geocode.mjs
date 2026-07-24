#!/usr/bin/env node
/**
 * Smoke-test address autocomplete gates + Census/Photon providers.
 * Run from repo root: npm run smoke:geocode
 */

import assert from 'node:assert/strict'
import { test, describe } from 'node:test'

import {
  GEOCODE_FETCH_TIMEOUT_MS,
  isPropertyAddressQuery,
  isSearchableAddressQuery,
  withGeocodeTimeout,
} from '../src/services/geocodeQuery.js'

/** Known US address both Census and Photon resolve reliably. */
const SAMPLE_QUERY = '123 Main St, Portland, OR'
const LIVE_TIMEOUT_MS = 8000

async function fetchJson(url, timeoutMs = LIVE_TIMEOUT_MS) {
  const timed = withGeocodeTimeout(undefined, timeoutMs)
  try {
    const res = await fetch(url, {
      signal: timed.signal,
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return { ok: false, status: res.status, data: null }
    return { ok: true, status: res.status, data: await res.json() }
  } catch (err) {
    return { ok: false, status: 0, data: null, error: err }
  } finally {
    timed.cleanup()
  }
}

describe('geocode query gates', () => {
  test('accepts the stuck-UI sample query', () => {
    assert.equal(isPropertyAddressQuery('1115 ne sorrel pl'), true)
    assert.equal(isSearchableAddressQuery('1115 ne sorrel pl', 5), true)
  })

  test('rejects junk that should not fire autocomplete', () => {
    assert.equal(isPropertyAddressQuery('825'), false)
    assert.equal(isPropertyAddressQuery('ne'), false)
    assert.equal(isSearchableAddressQuery('12', 4), false)
  })

  test('accepts comma-form full addresses', () => {
    assert.equal(isPropertyAddressQuery('123 Main St, Portland, OR'), true)
  })
})

describe('withGeocodeTimeout', () => {
  test('aborts after timeoutMs', async () => {
    const timed = withGeocodeTimeout(undefined, 40)
    const started = Date.now()
    await new Promise(resolve => {
      timed.signal.addEventListener('abort', resolve, { once: true })
    })
    timed.cleanup()
    const elapsed = Date.now() - started
    assert.ok(timed.signal.aborted)
    assert.ok(elapsed >= 30, `expected ~40ms abort, got ${elapsed}ms`)
    assert.ok(elapsed < 500, `timeout took too long: ${elapsed}ms`)
  })

  test('propagates caller abort', () => {
    const parent = new AbortController()
    const timed = withGeocodeTimeout(parent.signal, GEOCODE_FETCH_TIMEOUT_MS)
    parent.abort()
    assert.ok(timed.signal.aborted)
    timed.cleanup()
  })
})

describe('live Census + Photon providers', () => {
  test('at least one provider returns a usable match', async () => {
    const censusUrl = new URL('https://geocoding.geo.census.gov/geocoder/locations/onelineaddress')
    censusUrl.searchParams.set('address', SAMPLE_QUERY)
    censusUrl.searchParams.set('benchmark', 'Public_AR_Current')
    censusUrl.searchParams.set('format', 'json')

    const photonUrl = new URL('https://photon.komoot.io/api/')
    photonUrl.searchParams.set('q', SAMPLE_QUERY)
    photonUrl.searchParams.set('limit', '5')
    photonUrl.searchParams.set('lang', 'en')

    const [census, photon] = await Promise.all([fetchJson(censusUrl), fetchJson(photonUrl)])

    const censusMatches = census.data?.result?.addressMatches ?? []
    const photonFeatures = photon.data?.features ?? []

    const censusHit = censusMatches.some(
      m => m?.matchedAddress && m?.coordinates?.x != null && m?.coordinates?.y != null,
    )
    const photonHit = photonFeatures.some(f => {
      const coords = f?.geometry?.coordinates
      return Array.isArray(coords) && coords.length >= 2
    })

    assert.ok(
      censusHit || photonHit,
      `No usable geocode match. census=${census.status} photon=${photon.status}`,
    )
  })
})
