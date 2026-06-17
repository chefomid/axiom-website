import { describe, it, expect } from 'vitest'
import {
  isLicensedReceiptLine,
  licensedReceiptLineItems,
} from './receiptLicensedLines'

describe('isLicensedReceiptLine', () => {
  const base = {
    source_id: 'rentcast_property',
    api_cost_usd: 0.2,
    user_price_usd: 0.5,
    billable: true,
    configured: true,
  }

  it('includes billable licensed estimate lines', () => {
    expect(isLicensedReceiptLine(base)).toBe(true)
  })

  it('excludes unconfigured sources', () => {
    expect(isLicensedReceiptLine({ ...base, configured: false, billable: false })).toBe(false)
  })

  it('excludes failed runs', () => {
    expect(
      isLicensedReceiptLine({
        ...base,
        run_status: 'failed',
        charged: false,
        user_price_usd: 0,
        message: '429 rate limit exceeded',
      }),
    ).toBe(false)
  })

  it('excludes quota and auth errors by message', () => {
    expect(isLicensedReceiptLine({ ...base, message: '401 unauthorized' })).toBe(false)
    expect(isLicensedReceiptLine({ ...base, message: 'Insufficient API tokens' })).toBe(false)
  })

  it('excludes skipped runs with zero price', () => {
    expect(
      isLicensedReceiptLine({
        ...base,
        run_status: 'skipped',
        charged: false,
        user_price_usd: 0,
        api_cost_usd: 0,
        message: 'RENTCAST_API_KEY not configured',
      }),
    ).toBe(false)
  })
})

describe('licensedReceiptLineItems', () => {
  it('filters quote line items', () => {
    const quote = {
      line_items: [
        { source_id: 'fema_flood', api_cost_usd: 0, user_price_usd: 0, billable: true, configured: true },
        { source_id: 'rentcast_property', api_cost_usd: 0.2, user_price_usd: 0.5, billable: true, configured: true },
        { source_id: 'attom_property', api_cost_usd: 0.5, user_price_usd: 0, billable: false, configured: false },
      ],
    }
    expect(licensedReceiptLineItems(quote).map(i => i.source_id)).toEqual(['rentcast_property'])
  })
})
