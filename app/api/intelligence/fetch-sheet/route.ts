import { NextRequest, NextResponse } from 'next/server'

// Proxy Google Sheets CSV export to avoid browser CORS restrictions.
// The sheet must be publicly accessible (Anyone with link can view).

export async function GET(req: NextRequest): Promise<Response> {
  const sheetId = req.nextUrl.searchParams.get('id')
  if (!sheetId || !/^[\w-]+$/.test(sheetId)) {
    return NextResponse.json({ error: 'Invalid sheet ID' }, { status: 400 })
  }

  try {
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`
    const res = await fetch(url, { redirect: 'follow' })
    if (!res.ok) {
      return NextResponse.json(
        { error: `Google Sheets returned ${res.status}. Ensure the sheet is publicly accessible.` },
        { status: 502 },
      )
    }
    const csv = await res.text()
    return new Response(csv, {
      headers: { 'Content-Type': 'text/csv; charset=utf-8' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
