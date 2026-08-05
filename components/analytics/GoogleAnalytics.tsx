'use client'

// Loads the GA4 tag ONLY on production hostnames. On the dev environment,
// Vercel preview URLs, and localhost it injects nothing, so those environments
// never report into the live analytics property. The tag is injected
// imperatively on mount (client-only), which keeps every route statically
// renderable — reading the Host header in the root layout would deopt the whole
// app to dynamic rendering.

import { useEffect } from 'react'
import { GA_MEASUREMENT_ID, isGaProductionHost } from '@/lib/analytics/ga'

export default function GoogleAnalytics() {
  useEffect(() => {
    if (!isGaProductionHost(window.location.hostname)) return
    if (document.getElementById('ga4-src')) return // avoid double-injection

    const tag = document.createElement('script')
    tag.id = 'ga4-src'
    tag.async = true
    tag.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`
    document.head.appendChild(tag)

    const init = document.createElement('script')
    init.id = 'ga4-init'
    init.innerHTML = `window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config', '${GA_MEASUREMENT_ID}');`
    document.head.appendChild(init)
  }, [])

  return null
}
