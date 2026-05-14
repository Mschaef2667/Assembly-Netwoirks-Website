'use client'

import { useState, useEffect, useRef } from 'react'
import { Loader2, Upload, Link as LinkIcon, BarChart2 } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ParsedRow {
  [column: string]: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseCSV(text: string): { headers: string[]; rows: ParsedRow[] } {
  const lines = text.split(/\r?\n/)
  const nonEmpty = lines.filter(l => l.trim().length > 0)
  if (nonEmpty.length === 0) return { headers: [], rows: [] }

  function splitLine(line: string): string[] {
    const cells: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
        else inQuotes = !inQuotes
      } else if (ch === ',' && !inQuotes) {
        cells.push(current); current = ''
      } else {
        current += ch
      }
    }
    cells.push(current)
    return cells
  }

  const headers = splitLine(nonEmpty[0])
  const rows: ParsedRow[] = nonEmpty.slice(1).map(line => {
    const cells = splitLine(line)
    const row: ParsedRow = {}
    headers.forEach((h, i) => { row[h] = cells[i] ?? '' })
    return row
  })
  return { headers, rows }
}

function extractSheetId(url: string): string | null {
  const match = url.match(/\/spreadsheets\/d\/([\w-]+)/)
  return match ? match[1] : null
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ResponseImportPage() {
  const [orgId, setOrgId] = useState<string | null>(null)
  const [sheetUrl, setSheetUrl] = useState('')
  const [fetchingSheet, setFetchingSheet] = useState(false)
  const [sheetError, setSheetError] = useState<string | null>(null)

  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [rawCsv, setRawCsv] = useState('')

  const [saving, setSaving] = useState(false)
  const [savedCount, setSavedCount] = useState<number | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [loadingInit, setLoadingInit] = useState(true)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load org and latest saved responses
  useEffect(() => {
    async function init() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: userRow } = await supabase
          .from('users').select('org_id').eq('id', user.id).single()
        if (!userRow) return
        const oid = (userRow as Record<string, unknown>)['org_id'] as string
        setOrgId(oid)

        const { data: existing } = await supabase
          .from('survey_responses')
          .select('raw_csv, parsed_responses, response_count')
          .eq('org_id', oid)
          .order('imported_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (existing) {
          const row = existing as Record<string, unknown>
          const csv = String(row['raw_csv'] ?? '')
          if (csv) {
            const { headers: h, rows: r } = parseCSV(csv)
            setHeaders(h)
            setRows(r)
            setRawCsv(csv)
            setSavedCount(Number(row['response_count'] ?? r.length))
          }
        }
      } catch {
        // non-fatal
      } finally {
        setLoadingInit(false)
      }
    }
    void init()
  }, [])

  // ── Load CSV from parsed text ───────────────────────────────────────────────

  function loadCsv(text: string) {
    const { headers: h, rows: r } = parseCSV(text)
    setHeaders(h)
    setRows(r)
    setRawCsv(text)
  }

  // ── Google Sheets fetch ─────────────────────────────────────────────────────

  async function fetchSheet() {
    setSheetError(null)
    const id = extractSheetId(sheetUrl.trim())
    if (!id) {
      setSheetError('Could not extract a sheet ID from that URL. Paste the full Google Sheets URL.')
      return
    }
    setFetchingSheet(true)
    try {
      const res = await fetch(`/api/intelligence/fetch-sheet?id=${encodeURIComponent(id)}`)
      if (!res.ok) {
        const body = await res.json() as { error?: string }
        setSheetError(body.error ?? `Fetch failed (${res.status})`)
        return
      }
      const csv = await res.text()
      loadCsv(csv)
    } catch (err) {
      setSheetError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setFetchingSheet(false)
    }
  }

  // ── File upload ─────────────────────────────────────────────────────────────

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result
      if (typeof text === 'string') loadCsv(text)
    }
    reader.readAsText(file)
  }

  // ── Save to Supabase ────────────────────────────────────────────────────────

  async function saveResponses() {
    if (!orgId || rows.length === 0) return
    setSaving(true)
    setSaveError(null)
    try {
      const { error } = await supabase.from('survey_responses').insert({
        org_id: orgId,
        raw_csv: rawCsv,
        parsed_responses: rows,
        response_count: rows.length,
        imported_at: new Date().toISOString(),
      })
      if (error) throw error
      setSavedCount(rows.length)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loadingInit) {
    return (
      <div style={{ backgroundColor: '#F8F6F1', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={32} className="animate-spin" style={{ color: '#6B7280' }} />
      </div>
    )
  }

  const hasData = rows.length > 0

  return (
    <div style={{ backgroundColor: '#F8F6F1', minHeight: '100vh' }}>
      <header style={{ backgroundColor: '#0A1628', padding: '24px 32px' }}>
        <h1 style={{ color: '#FFFFFF', fontSize: '22px', fontWeight: 700, margin: 0 }}>Response Import</h1>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', margin: '6px 0 0' }}>
          Import completed survey responses to generate your DCP Map.
        </p>
      </header>

      <div style={{ padding: '28px 32px', maxWidth: '1100px' }}>

        {/* Import options */}
        {!hasData && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '28px' }}>

            {/* Google Sheets */}
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <LinkIcon size={20} style={{ color: '#E8520A' }} />
                <p style={{ fontSize: '15px', fontWeight: 700, color: '#0D0D0D', margin: 0 }}>Google Sheets URL</p>
              </div>
              <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '14px' }}>
                Paste the URL of a public Google Sheet containing your survey responses.
              </p>
              <input
                type="url"
                value={sheetUrl}
                onChange={e => setSheetUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                style={{
                  width: '100%', padding: '10px 12px', fontSize: '13px',
                  border: '1px solid #9CA3AF', borderRadius: '8px',
                  outline: 'none', boxSizing: 'border-box', marginBottom: '10px',
                }}
              />
              {sheetError && (
                <p style={{ fontSize: '12px', color: '#EF4444', marginBottom: '8px' }}>{sheetError}</p>
              )}
              <button
                onClick={() => void fetchSheet()}
                disabled={fetchingSheet || !sheetUrl.trim()}
                style={{
                  width: '100%', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  backgroundColor: (fetchingSheet || !sheetUrl.trim()) ? '#E5E7EB' : '#E8520A',
                  color: (fetchingSheet || !sheetUrl.trim()) ? '#9CA3AF' : '#FFFFFF',
                  border: 'none', borderRadius: '8px', cursor: (fetchingSheet || !sheetUrl.trim()) ? 'not-allowed' : 'pointer',
                  fontSize: '14px', fontWeight: 600,
                }}
              >
                {fetchingSheet && <Loader2 size={14} className="animate-spin" />}
                Fetch Responses
              </button>
            </div>

            {/* CSV Upload */}
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <Upload size={20} style={{ color: '#E8520A' }} />
                <p style={{ fontSize: '15px', fontWeight: 700, color: '#0D0D0D', margin: 0 }}>Upload CSV</p>
              </div>
              <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '14px' }}>
                Upload a CSV file exported from Google Forms, Typeform, or any other survey tool.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  width: '100%', minHeight: '44px',
                  border: '2px dashed #D1D5DB', borderRadius: '8px',
                  backgroundColor: '#F9FAFB', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: '6px', color: '#6B7280', fontSize: '13px',
                }}
              >
                <Upload size={20} />
                Click to select CSV file
              </button>
            </div>
          </div>
        )}

        {/* Response count + status */}
        {hasData && (
          <div style={{
            backgroundColor: '#FFFFFF', borderRadius: '10px', padding: '16px 20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.07)', marginBottom: '20px',
            display: 'flex', alignItems: 'center', gap: '16px',
          }}>
            <BarChart2 size={20} style={{ color: '#E8520A' }} />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '15px', fontWeight: 700, color: '#0D0D0D', margin: 0 }}>
                {rows.length} response{rows.length !== 1 ? 's' : ''} imported
              </p>
              {savedCount !== null && savedCount === rows.length && (
                <p style={{ fontSize: '12px', color: '#16A34A', margin: '2px 0 0' }}>Saved to workspace</p>
              )}
            </div>
            <button
              onClick={() => { setHeaders([]); setRows([]); setRawCsv(''); setSavedCount(null) }}
              style={{
                minHeight: '36px', padding: '0 14px', fontSize: '13px', fontWeight: 500,
                border: '1px solid #E5E7EB', borderRadius: '6px', cursor: 'pointer',
                backgroundColor: '#FFFFFF', color: '#6B7280',
              }}
            >
              Clear & re-import
            </button>
            <button
              onClick={() => void saveResponses()}
              disabled={saving || savedCount === rows.length}
              style={{
                minHeight: '44px', padding: '0 20px', display: 'flex', alignItems: 'center', gap: '8px',
                backgroundColor: (saving || savedCount === rows.length) ? '#E5E7EB' : '#E8520A',
                color: (saving || savedCount === rows.length) ? '#9CA3AF' : '#FFFFFF',
                border: 'none', borderRadius: '8px',
                cursor: (saving || savedCount === rows.length) ? 'not-allowed' : 'pointer',
                fontSize: '14px', fontWeight: 600,
              }}
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {savedCount === rows.length ? 'Saved' : 'Save Responses'}
            </button>
            <a
              href="/dashboard/intelligence/dcp-map"
              style={{
                minHeight: '44px', padding: '0 20px', display: 'flex', alignItems: 'center',
                backgroundColor: '#0A1628', color: '#FFFFFF',
                borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: 600,
              }}
            >
              Analyze with Copilot →
            </a>
          </div>
        )}

        {saveError && (
          <p style={{ fontSize: '13px', color: '#EF4444', marginBottom: '12px' }}>{saveError}</p>
        )}

        {/* Data table */}
        {hasData && headers.length > 0 && (
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto', maxHeight: '520px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead style={{ position: 'sticky', top: 0, backgroundColor: '#F9FAFB', zIndex: 1 }}>
                  <tr>
                    {headers.map((h, i) => (
                      <th key={i} style={{
                        padding: '10px 14px', textAlign: 'left', fontWeight: 700,
                        color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em',
                        borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap',
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 200).map((row, ri) => (
                    <tr key={ri} style={{ borderBottom: '1px solid #F3F4F6' }}>
                      {headers.map((h, ci) => (
                        <td key={ci} style={{
                          padding: '8px 14px', color: '#0D0D0D',
                          maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {row[h]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 200 && (
                <p style={{ padding: '10px 14px', fontSize: '12px', color: '#6B7280', margin: 0 }}>
                  Showing first 200 of {rows.length} rows.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
