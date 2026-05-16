'use client'

import { useState, useEffect, useRef } from 'react'
import { Loader2, Upload, Link as LinkIcon, BarChart2 } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ParsedRow {
  [column: string]: string
}

interface ImportBatch {
  imported_at: string
  source: 'google_sheets' | 'csv'
  response_count: number
  parsed_responses: ParsedRow[]
  stage_mapping: Record<string, number>
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

function extractStageMappings(headers: string[]): Record<string, number> {
  const mapping: Record<string, number> = {}
  for (const h of headers) {
    const match = h.match(/^\[Stage\s+(\d+)\s+-/)
    if (match) mapping[h] = parseInt(match[1], 10)
  }
  return mapping
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ResponseImportPage() {
  const [orgId, setOrgId] = useState<string | null>(null)
  const [importRowId, setImportRowId] = useState<string | null>(null)

  // Import form state
  const [sheetUrl, setSheetUrl] = useState('')
  const [fetchingSheet, setFetchingSheet] = useState(false)
  const [sheetError, setSheetError] = useState<string | null>(null)

  // Pending (loaded, not yet saved) import
  const [pendingHeaders, setPendingHeaders] = useState<string[]>([])
  const [pendingRows, setPendingRows] = useState<ParsedRow[]>([])
  const [pendingStageMapping, setPendingStageMapping] = useState<Record<string, number>>({})
  const [pendingSource, setPendingSource] = useState<'google_sheets' | 'csv'>('csv')

  // Saved batches (from DB)
  const [batches, setBatches] = useState<ImportBatch[]>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [loadingInit, setLoadingInit] = useState(true)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Load ─────────────────────────────────────────────────────────────────────

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
          .from('dcp_imports')
          .select('id, batches, parsed_responses, response_count, stage_mapping')
          .eq('org_id', oid)
          .order('imported_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (existing) {
          const row = existing as Record<string, unknown>
          const rowId = String(row['id'] ?? '')
          setImportRowId(rowId)

          const batchesData = row['batches']
          if (Array.isArray(batchesData) && batchesData.length > 0) {
            setBatches(batchesData as ImportBatch[])
          } else {
            // Migrate legacy flat row into a synthetic batch
            const legacyResponses = row['parsed_responses']
            const legacyCount = Number(row['response_count'] ?? 0)
            const legacyMapping = row['stage_mapping']
            if (Array.isArray(legacyResponses) && legacyResponses.length > 0) {
              const legacyBatch: ImportBatch = {
                imported_at: new Date().toISOString(),
                source: 'csv',
                response_count: legacyCount,
                parsed_responses: legacyResponses as ParsedRow[],
                stage_mapping:
                  legacyMapping && typeof legacyMapping === 'object' && !Array.isArray(legacyMapping)
                    ? (legacyMapping as Record<string, number>)
                    : {},
              }
              setBatches([legacyBatch])
              await supabase.from('dcp_imports').update({
                batches: [legacyBatch],
              }).eq('id', rowId)
            }
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

  // ── Load CSV ─────────────────────────────────────────────────────────────────

  function loadCsv(text: string, source: 'google_sheets' | 'csv') {
    const { headers: h, rows: r } = parseCSV(text)
    setPendingHeaders(h)
    setPendingRows(r)
    setPendingStageMapping(extractStageMappings(h))
    setPendingSource(source)
    setSaveError(null)
  }

  // ── Google Sheets fetch ───────────────────────────────────────────────────────

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
      loadCsv(csv, 'google_sheets')
    } catch (err) {
      setSheetError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setFetchingSheet(false)
    }
  }

  // ── File upload ───────────────────────────────────────────────────────────────

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result
      if (typeof text === 'string') loadCsv(text, 'csv')
    }
    reader.readAsText(file)
  }

  // ── Save batch ────────────────────────────────────────────────────────────────

  async function saveBatch() {
    if (!orgId || pendingRows.length === 0) return
    setSaving(true)
    setSaveError(null)
    try {
      const newBatch: ImportBatch = {
        imported_at: new Date().toISOString(),
        source: pendingSource,
        response_count: pendingRows.length,
        parsed_responses: pendingRows,
        stage_mapping: pendingStageMapping,
      }
      const updatedBatches = [...batches, newBatch]
      const totalCount = updatedBatches.reduce((sum, b) => sum + b.response_count, 0)

      if (importRowId) {
        const { error } = await supabase.from('dcp_imports')
          .update({ batches: updatedBatches, response_count: totalCount })
          .eq('id', importRowId)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('dcp_imports')
          .insert({
            org_id: orgId,
            batches: updatedBatches,
            response_count: totalCount,
            imported_at: new Date().toISOString(),
          })
          .select('id').single()
        if (error) throw error
        if (data) setImportRowId(String((data as Record<string, unknown>)['id'] ?? ''))
      }

      setBatches(updatedBatches)
      setPendingHeaders([])
      setPendingRows([])
      setPendingStageMapping({})
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loadingInit) {
    return (
      <div style={{ backgroundColor: '#F8F6F1', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={32} className="animate-spin" style={{ color: '#6B7280' }} />
      </div>
    )
  }

  const totalResponses = batches.reduce((sum, b) => sum + b.response_count, 0)
  const hasBatches = batches.length > 0
  const hasPending = pendingRows.length > 0
  const mappedCount = Object.keys(pendingStageMapping).length

  return (
    <div style={{ backgroundColor: '#F8F6F1', minHeight: '100vh' }}>
      <header style={{ backgroundColor: '#0A1628', padding: '24px 32px' }}>
        <h1 style={{ color: '#FFFFFF', fontSize: '22px', fontWeight: 700, margin: 0 }}>Response Import</h1>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', margin: '6px 0 0' }}>
          Import completed survey responses to generate your DCP Map.
        </p>
      </header>

      <div style={{ padding: '28px 32px', maxWidth: '1100px' }}>

        {/* ── Import options ──────────────────────────────────────────────────── */}
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
              onKeyDown={e => { if (e.key === 'Enter' && sheetUrl.trim()) void fetchSheet() }}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              style={{
                width: '100%', padding: '10px 12px', fontSize: '13px',
                color: '#0D0D0D', backgroundColor: '#FFFFFF',
                border: '1px solid #9CA3AF', borderRadius: '8px',
                outline: 'none', boxSizing: 'border-box', marginBottom: '10px',
                cursor: 'text',
              }}
            />
            {sheetError && <p style={{ fontSize: '12px', color: '#EF4444', marginBottom: '8px' }}>{sheetError}</p>}
            <button
              onClick={() => void fetchSheet()}
              disabled={fetchingSheet || !sheetUrl.trim()}
              style={{
                width: '100%', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                backgroundColor: (fetchingSheet || !sheetUrl.trim()) ? '#E5E7EB' : '#E8520A',
                color: (fetchingSheet || !sheetUrl.trim()) ? '#9CA3AF' : '#FFFFFF',
                border: 'none', borderRadius: '8px',
                cursor: (fetchingSheet || !sheetUrl.trim()) ? 'not-allowed' : 'pointer',
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
            <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleFileChange} style={{ display: 'none' }} />
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

        {/* ── Pending import preview ──────────────────────────────────────────── */}
        {hasPending && (
          <div style={{
            backgroundColor: '#FFFFFF', borderRadius: '10px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.07)', marginBottom: '20px', overflow: 'hidden',
          }}>
            <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <BarChart2 size={20} style={{ color: '#E8520A' }} />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '15px', fontWeight: 700, color: '#0D0D0D', margin: 0 }}>
                  {pendingRows.length} response{pendingRows.length !== 1 ? 's' : ''} loaded
                  <span style={{ fontSize: '12px', fontWeight: 400, color: '#6B7280', marginLeft: '8px' }}>
                    {pendingSource === 'google_sheets' ? 'from Google Sheets' : 'from CSV'}
                  </span>
                </p>
                {mappedCount > 0 && (
                  <p style={{ fontSize: '12px', color: '#E8520A', margin: '2px 0 0' }}>
                    {mappedCount} column{mappedCount !== 1 ? 's' : ''} auto-mapped to DCP stages
                  </p>
                )}
              </div>
              <button
                onClick={() => { setPendingHeaders([]); setPendingRows([]); setPendingStageMapping({}) }}
                style={{
                  minHeight: '36px', padding: '0 14px', fontSize: '13px', fontWeight: 500,
                  border: '1px solid #E5E7EB', borderRadius: '6px', cursor: 'pointer',
                  backgroundColor: '#FFFFFF', color: '#6B7280',
                }}
              >
                Discard
              </button>
              <button
                onClick={() => void saveBatch()}
                disabled={saving}
                style={{
                  minHeight: '44px', padding: '0 20px', display: 'flex', alignItems: 'center', gap: '8px',
                  backgroundColor: saving ? '#E5E7EB' : '#E8520A',
                  color: saving ? '#9CA3AF' : '#FFFFFF',
                  border: 'none', borderRadius: '8px', cursor: saving ? 'not-allowed' : 'pointer',
                  fontSize: '14px', fontWeight: 600,
                }}
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                Save Import
              </button>
            </div>

            {saveError && (
              <p style={{ fontSize: '13px', color: '#EF4444', margin: '0 20px 12px' }}>{saveError}</p>
            )}

            {pendingHeaders.length > 0 && (
              <div style={{ overflowX: 'auto', maxHeight: '360px', overflowY: 'auto', borderTop: '1px solid #F3F4F6' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead style={{ position: 'sticky', top: 0, backgroundColor: '#F9FAFB', zIndex: 1 }}>
                    <tr>
                      {pendingHeaders.map((h, i) => (
                        <th key={i} style={{
                          padding: '10px 14px', textAlign: 'left', fontWeight: 700,
                          color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em',
                          borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap',
                        }}>
                          {h}
                          {pendingStageMapping[h] !== undefined && (
                            <span style={{ marginLeft: '5px', fontSize: '10px', color: '#E8520A', fontWeight: 700 }}>
                              ·S{pendingStageMapping[h]}
                            </span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pendingRows.slice(0, 100).map((row, ri) => (
                      <tr key={ri} style={{ borderBottom: '1px solid #F3F4F6' }}>
                        {pendingHeaders.map((h, ci) => (
                          <td key={ci} style={{
                            padding: '8px 14px', color: '#0D0D0D',
                            maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {row[h]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {pendingRows.length > 100 && (
                  <p style={{ padding: '8px 14px', fontSize: '12px', color: '#6B7280', margin: 0 }}>
                    Showing first 100 of {pendingRows.length} rows.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Import history ──────────────────────────────────────────────────── */}
        {hasBatches && (
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid #F3F4F6',
              display: 'flex', alignItems: 'center', gap: '16px',
            }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '15px', fontWeight: 700, color: '#0D0D0D', margin: 0 }}>
                  {totalResponses} total response{totalResponses !== 1 ? 's' : ''}
                </p>
                <p style={{ fontSize: '12px', color: '#6B7280', margin: '2px 0 0' }}>
                  across {batches.length} import{batches.length !== 1 ? 's' : ''}
                </p>
              </div>
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

            {[...batches].reverse().map((batch, i) => {
              const batchMapped = Object.keys(batch.stage_mapping ?? {}).length
              return (
                <div key={i} style={{
                  padding: '12px 20px', borderBottom: '1px solid #F9FAFB',
                  display: 'flex', alignItems: 'center', gap: '12px',
                }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: '#0D0D0D', margin: 0 }}>
                      {batch.response_count} response{batch.response_count !== 1 ? 's' : ''}
                      <span style={{ marginLeft: '8px', fontWeight: 400, color: '#6B7280' }}>
                        {batch.source === 'google_sheets' ? 'Google Sheets' : 'CSV'}
                      </span>
                    </p>
                    <p style={{ fontSize: '12px', color: '#9CA3AF', margin: '2px 0 0' }}>
                      {formatDate(batch.imported_at)}
                      {batchMapped > 0 && (
                        <span style={{ color: '#E8520A', marginLeft: '8px' }}>
                          {batchMapped} stage{batchMapped !== 1 ? 's' : ''} mapped
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
