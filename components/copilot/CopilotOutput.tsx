'use client'

import { useState, useEffect } from 'react'
import { Loader2, Wand2, Check, X } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────────

interface CopilotRunMeta {
  model: string
  tokensUsed: number | null
}

interface DiffLine {
  text: string
  type: 'added' | 'removed' | 'unchanged'
}

export interface CopilotOutputProps {
  runId: string
  content: string
  stepId: string
  painPointIndex?: number
  existingContent?: string
  onApply: (content: string) => void
  onDismiss: () => void
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function copilotErrorMessage(code: number | string): string {
  const n = typeof code === 'string' ? parseInt(code, 10) : code
  if (n === 500 || n === 502 || n === 503)
    return "Anthropic's AI service is temporarily unavailable. Please wait a moment and try again. If it persists, check status.anthropic.com"
  if (n === 429) return "You've hit the rate limit. Please wait a minute before trying again."
  if (n === 408) return "The request took too long to complete. Try again or shorten your content."
  if (n > 0) return `Copilot encountered an unexpected error (code: ${n}). Please try again.`
  return 'Copilot encountered an unexpected error. Please try again.'
}

function isLikelyStreaming(text: string): boolean {
  if (!text.trim()) return false
  const t = text.trimEnd()
  // JSON: still streaming if it doesn't end with a closing brace
  if (t.startsWith('{')) return !t.endsWith('}')
  // Plain text: streaming if it doesn't end with sentence-ending punctuation
  return !/[.!?"]$/.test(t)
}

function computeDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split('\n')
  const newLines = newText.split('\n')
  const m = oldLines.length
  const n = newLines.length

  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array<number>(n + 1).fill(0),
  )
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        oldLines[i - 1] === newLines[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1])
    }
  }

  // Backtrack to produce diff
  const result: DiffLine[] = []
  let i = m
  let j = n
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.unshift({ text: oldLines[i - 1], type: 'unchanged' })
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ text: newLines[j - 1], type: 'added' })
      j--
    } else {
      result.unshift({ text: oldLines[i - 1], type: 'removed' })
      i--
    }
  }
  return result
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CopilotOutput({
  runId,
  content,
  stepId,
  painPointIndex,
  existingContent,
  onApply,
  onDismiss,
}: CopilotOutputProps) {
  const [runMeta, setRunMeta] = useState<CopilotRunMeta | null>(null)
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [preferredModel, setPreferredModel] = useState('claude-sonnet-4-5')
  const [displayContent, setDisplayContent] = useState(content)
  const [isImproving, setIsImproving] = useState(false)
  const [improveError, setImproveError] = useState<string | null>(null)
  const [showDiff, setShowDiff] = useState(true)
  const [cursorVisible, setCursorVisible] = useState(true)

  // Keep displayContent in sync with incoming content prop (live streaming from parent)
  useEffect(() => {
    setDisplayContent(content)
  }, [content])

  // Blinking cursor
  const streaming = isLikelyStreaming(displayContent)
  useEffect(() => {
    if (!streaming) { setCursorVisible(true); return }
    const id = setInterval(() => setCursorVisible(v => !v), 530)
    return () => clearInterval(id)
  }, [streaming])

  // Load workspace context + copilot_run metadata
  useEffect(() => {
    async function loadContext() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: userRow } = await supabase
          .from('users')
          .select('org_id')
          .eq('id', user.id)
          .single()
        if (!userRow) return

        const wsId = (userRow as Record<string, unknown>)['org_id'] as string
        setWorkspaceId(wsId)

        const { data: org } = await supabase
          .from('organizations')
          .select('preferred_model')
          .eq('id', wsId)
          .single()
        if (org) {
          setPreferredModel(
            String((org as Record<string, unknown>)['preferred_model'] ?? 'claude-sonnet-4-5'),
          )
        }
      } catch { /* non-fatal */ }
    }

    async function loadRunMeta() {
      if (!runId) return
      try {
        const { data } = await supabase
          .from('copilot_run')
          .select('model, tokens_used')
          .eq('id', runId)
          .maybeSingle()
        if (data) {
          const row = data as Record<string, unknown>
          setRunMeta({
            model: String(row['model'] ?? 'Unknown'),
            tokensUsed: typeof row['tokens_used'] === 'number' ? row['tokens_used'] : null,
          })
        }
      } catch { /* non-fatal */ }
    }

    void loadContext()
    void loadRunMeta()
  }, [runId])

  // Improve: stream an improved version inline
  async function handleImprove() {
    if (!workspaceId || isImproving) return
    setIsImproving(true)
    setImproveError(null)

    try {
      const res = await fetch('/api/copilot/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stepId,
          workspaceId,
          stepTitle: `Step ${stepId}`,
          stepDescription: '',
          currentContent: displayContent,
          preferredModel,
          extraContext: `Improve this draft: ${displayContent}`,
        }),
      })

      if (!res.ok || !res.body) {
        setImproveError(copilotErrorMessage(res.status))
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        setDisplayContent(accumulated)
      }

      if (accumulated.includes('__STREAM_ERROR__')) {
        const match = accumulated.match(/__STREAM_ERROR__:(\w+)/)
        setImproveError(copilotErrorMessage(match ? match[1] : 0))
        setDisplayContent(content)
        return
      }

      // Extract the draft field if response is JSON
      try {
        const parsed = JSON.parse(accumulated) as Record<string, unknown>
        if (typeof parsed['draft'] === 'string') {
          setDisplayContent(parsed['draft'])
        }
      } catch {
        // Keep accumulated raw text as-is
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message.toLowerCase() : ''
      setImproveError(
        msg.includes('timeout') || msg.includes('aborted')
          ? 'The request took too long to complete. Try again.'
          : copilotErrorMessage(0),
      )
      setDisplayContent(content)
    } finally {
      setIsImproving(false)
    }
  }

  // Derived state
  const hasDiff =
    !!existingContent && existingContent.trim() !== '' && existingContent.trim() !== displayContent.trim()
  const diffLines = hasDiff && showDiff ? computeDiff(existingContent!, displayContent) : null
  const isInteractive = !isImproving && !streaming

  return (
    <div style={{
      backgroundColor: '#FFFFFF',
      borderRadius: '12px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      border: '1px solid #E5E7EB',
      overflow: 'hidden',
    }}>
      {/* ── Header ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        backgroundColor: '#0A1628',
        gap: '8px',
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            fontSize: '11px',
            fontWeight: 700,
            color: '#E8520A',
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
          }}>
            Copilot Draft
          </span>
          {painPointIndex !== undefined && (
            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)' }}>
              — Pain Point {painPointIndex}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {runMeta && (
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', fontVariantNumeric: 'tabular-nums' }}>
              {runMeta.model}
              {runMeta.tokensUsed !== null ? ` · ${runMeta.tokensUsed.toLocaleString()} tokens` : ''}
            </span>
          )}
          {hasDiff && (
            <button
              onClick={() => setShowDiff(prev => !prev)}
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: showDiff ? '#E8520A' : 'rgba(255,255,255,0.45)',
                background: showDiff ? 'rgba(232,82,10,0.15)' : 'transparent',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                padding: '4px 10px',
                minHeight: '28px',
                transition: 'color 0.15s, background-color 0.15s',
              }}
            >
              {showDiff ? 'Hide diff' : 'Show diff'}
            </button>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ padding: '16px' }}>
        {diffLines ? (
          // Diff view
          <div style={{
            fontSize: '13px',
            lineHeight: '1.65',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            border: '1px solid #E5E7EB',
            borderRadius: '8px',
            overflow: 'hidden',
            maxHeight: '360px',
            overflowY: 'auto',
          }}>
            {diffLines.map((line, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  gap: '8px',
                  padding: '2px 12px',
                  backgroundColor:
                    line.type === 'added' ? '#F0FDF4' :
                    line.type === 'removed' ? '#FFF1F2' :
                    'transparent',
                  color:
                    line.type === 'added' ? '#15803D' :
                    line.type === 'removed' ? '#991B1B' :
                    '#0D0D0D',
                }}
              >
                <span style={{
                  userSelect: 'none',
                  flexShrink: 0,
                  width: '12px',
                  color:
                    line.type === 'added' ? '#16A34A' :
                    line.type === 'removed' ? '#DC2626' :
                    '#D1D5DB',
                  fontWeight: 700,
                }}>
                  {line.type === 'added' ? '+' : line.type === 'removed' ? '−' : ' '}
                </span>
                <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {line.text}
                </span>
              </div>
            ))}
          </div>
        ) : (
          // Plain text view with optional streaming cursor
          <div style={{
            fontSize: '14px',
            lineHeight: '1.7',
            color: '#0D0D0D',
            backgroundColor: '#F8F6F1',
            borderRadius: '8px',
            padding: '12px 14px',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            maxHeight: '320px',
            overflowY: 'auto',
          }}>
            {displayContent}
            {streaming && (
              <span style={{
                display: 'inline-block',
                width: '2px',
                height: '1em',
                backgroundColor: '#E8520A',
                marginLeft: '2px',
                verticalAlign: 'text-bottom',
                opacity: cursorVisible ? 1 : 0,
              }} />
            )}
          </div>
        )}

        {/* Improve status indicator */}
        {isImproving && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '10px',
            padding: '8px 12px',
            backgroundColor: '#F8F6F1',
            borderRadius: '6px',
            fontSize: '12px',
            color: '#6B7280',
          }}>
            <Loader2 size={13} className="animate-spin" style={{ color: '#E8520A', flexShrink: 0 }} />
            Improving draft…
          </div>
        )}

        {/* Error */}
        {improveError && !isImproving && (
          <div style={{
            marginTop: '10px',
            padding: '10px 14px',
            backgroundColor: '#FEF2F2',
            border: '1px solid #FCA5A5',
            borderRadius: '8px',
          }}>
            <p style={{ fontSize: '12px', color: '#991B1B', margin: '0 0 6px' }}>
              {improveError}
            </p>
            <a
              href="https://status.anthropic.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: '11px', color: '#991B1B', textDecoration: 'underline' }}
            >
              Check AI Status ↗
            </a>
          </div>
        )}
      </div>

      {/* ── Actions ── */}
      <div style={{
        display: 'flex',
        gap: '8px',
        padding: '12px 16px',
        borderTop: '1px solid #F3F4F6',
      }}>
        {/* Apply */}
        <button
          onClick={() => onApply(displayContent)}
          disabled={!isInteractive}
          style={{
            flex: 1,
            minHeight: '44px',
            backgroundColor: isInteractive ? '#E8520A' : '#F3F4F6',
            color: isInteractive ? '#FFFFFF' : '#9CA3AF',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: isInteractive ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'background-color 0.15s',
          }}
        >
          <Check size={15} />
          Apply
        </button>

        {/* Improve */}
        <button
          onClick={() => void handleImprove()}
          disabled={!isInteractive || !workspaceId}
          style={{
            flex: 1,
            minHeight: '44px',
            backgroundColor: isInteractive && workspaceId ? '#0A1628' : '#F3F4F6',
            color: isInteractive && workspaceId ? '#FFFFFF' : '#9CA3AF',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: isInteractive && workspaceId ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'background-color 0.15s',
          }}
        >
          <Wand2 size={15} />
          Improve
        </button>

        {/* Dismiss */}
        <button
          onClick={onDismiss}
          disabled={isImproving}
          style={{
            minHeight: '44px',
            minWidth: '44px',
            padding: '0 16px',
            backgroundColor: 'transparent',
            color: isImproving ? '#D1D5DB' : '#6B7280',
            border: '1px solid #E5E7EB',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: isImproving ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'color 0.15s',
          }}
        >
          <X size={15} />
          Dismiss
        </button>
      </div>
    </div>
  )
}
