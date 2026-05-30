import chromium from '@sparticuz/chromium'
import puppeteer from 'puppeteer-core'

import { renderReportHtml } from './renderReportHtml.js'

export const config = {
  maxDuration: 60,
  memory: 3008,
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
}

function slugifyLocation(label) {
  return String(label ?? 'location')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ detail: 'Method not allowed' })
    return
  }

  const document = req.body?.document
  if (!document) {
    res.status(400).json({ detail: 'Report document is required.' })
    return
  }

  let browser
  try {
    const html = renderReportHtml(document)
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    })
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'load', timeout: 30000 })
    await page.waitForSelector('#report-print-ready', { timeout: 15000 })
    const pdf = await page.pdf({
      format: 'Letter',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, bottom: 0, left: 0, right: 0 },
    })
    const slug = slugifyLocation(document.meta?.location)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="seismic-report-${slug}.pdf"`)
    res.status(200).send(Buffer.from(pdf))
  } catch (err) {
    res.status(502).json({
      detail: `PDF generation failed: ${err?.message ?? String(err)}`,
    })
  } finally {
    if (browser) {
      await browser.close().catch(() => {})
    }
  }
}
