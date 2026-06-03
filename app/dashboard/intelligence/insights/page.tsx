'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Sparkles,
  Loader2,
  GitCompare,
  AlertCircle,
  Swords,
  Zap,
  Eye,
  Users,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────────

interface CategoryInsight {
  insights: string[]
  confidence: number
}

interface InsightsContent {
  generated_at: string
  overall_confidence: number
  categories: {
    internal_external_gap: CategoryInsight
    product_gaps: CategoryInsight
    key_competitors: CategoryInsight
    decision_signals: CategoryInsight
    brand_perception: CategoryInsight
    segment_differences: CategoryInsight
  }
}

type CategoryKey = keyof InsightsContent['categories']

interface CategoryMeta {
  key: CategoryKey
  title: string
  description: string
  icon: typeof GitCompare
  accent: string
  accentBg: string
}

// ── Category definitions ──────────────────────────────────────────────────────

const CATEGORIES: CategoryMeta[] = [
  {
    key: 'internal_external_gap',
    title: 'Internal vs External Gap',
    description: 'Where your team’s beliefs differ from what real buyers said.',
    icon: GitCompare,
    accent: '#0EA5E9',
    accentBg: 'rgba(14,165,233,0.15)',
  },
  {
    key: 'product_gaps',
    title: 'Product / Service Gaps',
    description: 'Unmet needs surfaced in the response data.',
    icon: AlertCircle,
    accent: '#D97706',
    accentBg: 'rgba(217,119,6,0.15)',
  },
  {
    key: 'key_competitors',
    title: 'Key Competitors',
    description: 'Who comes up most often, and in what context.',
    icon: Swords,
    accent: '#DC2626',
    accentBg: 'rgba(220,38,38,0.15)',
  },
  {
    key: 'decision_signals',
    title: 'Decision Signals',
    description: 'The highest-leverage moments in the buying journey.',
    icon: Zap,
    accent: '#E8520A',
    accentBg: 'rgba(232,82,10,0.15)',
  },
  {
    key: 'brand_perception',
    title: 'Brand Perception',
    description: 'How buyers describe you vs how you describe yourself.',
    icon: Eye,
    accent: '#A855F7',
    accentBg: 'rgba(168,85,247,0.15)',
  },
  {
    key: 'segment_differences',
    title: 'Segment Differences',
    description: 'Where different segments diverge in their decision process.',
    icon: Users,
    accent: '#16A34A',
    accentBg: 'rgba(22,163,74,0.15)',
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function confColor(score: number): string {
  if (score >= 70) return '#16A34A'
  if (score >= 40) return '#D97706'
  return '#DC2626'
}

function confBg(score: number): string {
  if (score >= 70) return '#DCFCE7'
  if (score >= 40) return '#FEF3C7'
  return '#FEE2E2'
}

function confLabel(score: number): string {
  if (score >= 70) return 'High'
  if (score >= 40) return 'Moderate'
  return 'Low'
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit',
    })
  } catch {
    return iso
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function InsightsPage() {
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [insights, setInsights] = useState<InsightsContent | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }
      const { data: userRow } = await supabase
        .from('users').select('org_id').eq('id', user.id).single()
      if (!userRow) {
        setLoading(false)
        return
      }
      const orgId = (userRow as Record<string, unknown>)['org_id'] as string

      const { data: row } = await supabase
        .from('step_output')
        .select('content')
        .eq('workspace_id', orgId)
        .eq('step_id', 'insights')
        .maybeSingle()

      if (row) {
        const content = (row as Record<string, unknown>)['content'] as InsightsContent | null
        if (content && content.categories) {
          setInsights(content)
        }
      }
    } catch {
      // non-fatal
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function handleGenerate() {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/intelligence/generate-insights', { method: 'POST' })
      const data = await res.json() as InsightsContent & { error?: string }
      if (!res.ok) {
        setError(data.error ?? 'Failed to generate insights.')
        return
      }
      setInsights(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate insights.')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div style={{ backgroundColor: '#0A1628', minHeight: '100vh' }}>
      <header style={{
        backgroundColor: '#0A1628',
        padding: '24px 32px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        <Link href="/dashboard/intelligence" style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          color: '#0EA5E9', fontSize: '13px', textDecoration: 'none', marginBottom: '12px',
        }}>
          <ArrowLeft size={14} /> Back to Intelligence
        </Link>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ color: '#FFFFFF', fontSize: '22px', fontWeight: 700, margin: 0 }}>
              Intelligence Insights
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', margin: '6px 0 0' }}>
              Patterns and opportunities surfaced from your buyer research.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {insights && (
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
                Last generated {formatTimestamp(insights.generated_at)}
              </span>
            )}
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                minHeight: '44px', padding: '0 18px', borderRadius: '8px',
                backgroundColor: '#E8520A', color: '#FFFFFF',
                fontSize: '14px', fontWeight: 600, border: 'none',
                cursor: generating ? 'not-allowed' : 'pointer',
                opacity: generating ? 0.7 : 1,
              }}
            >
              {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {generating ? 'Generating…' : insights ? 'Regenerate Insights' : 'Generate Insights'}
            </button>
          </div>
        </div>
      </header>

      <div style={{ padding: '28px 32px', maxWidth: '1200px' }}>
        {error && (
          <div style={{
            backgroundColor: 'rgba(220,38,38,0.1)',
            border: '1px solid rgba(220,38,38,0.3)',
            borderRadius: '8px',
            padding: '14px 18px',
            marginBottom: '20px',
            color: '#FCA5A5',
            fontSize: '13px',
          }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'rgba(255,255,255,0.6)' }}>
            <Loader2 size={16} className="animate-spin" /> Loading insights…
          </div>
        ) : !insights ? (
          <EmptyState generating={generating} onGenerate={handleGenerate} />
        ) : (
          <>
            <OverallConfidence score={insights.overall_confidence} />
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '20px',
              marginTop: '24px',
            }}>
              {CATEGORIES.map(meta => (
                <CategoryCard
                  key={meta.key}
                  meta={meta}
                  data={insights.categories[meta.key]}
                  generatedAt={insights.generated_at}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function EmptyState({ generating, onGenerate }: { generating: boolean; onGenerate: () => void }) {
  return (
    <div style={{
      backgroundColor: '#0F2140',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '12px',
      padding: '48px 32px',
      textAlign: 'center',
    }}>
      <div style={{
        width: '56px', height: '56px', borderRadius: '14px',
        backgroundColor: 'rgba(232,82,10,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 16px',
      }}>
        <Sparkles size={24} color="#E8520A" />
      </div>
      <h2 style={{ color: '#FFFFFF', fontSize: '18px', fontWeight: 700, margin: '0 0 8px' }}>
        No insights yet
      </h2>
      <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', maxWidth: '460px', margin: '0 auto 20px' }}>
        Generate insights once you have collected survey responses and built a Decision Clarity Profile.
        Copilot will surface patterns across 6 intelligence categories.
      </p>
      <button
        type="button"
        onClick={onGenerate}
        disabled={generating}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          minHeight: '44px', padding: '0 22px', borderRadius: '8px',
          backgroundColor: '#E8520A', color: '#FFFFFF',
          fontSize: '14px', fontWeight: 600, border: 'none',
          cursor: generating ? 'not-allowed' : 'pointer',
          opacity: generating ? 0.7 : 1,
        }}
      >
        {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
        {generating ? 'Generating…' : 'Generate Insights'}
      </button>
    </div>
  )
}

function OverallConfidence({ score }: { score: number }) {
  return (
    <div style={{
      backgroundColor: '#0F2140',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '12px',
      padding: '18px 22px',
      display: 'flex', alignItems: 'center', gap: '16px',
    }}>
      <CheckCircle2 size={18} color={confColor(score)} />
      <div style={{ flex: 1 }}>
        <p style={{ color: '#FFFFFF', fontSize: '14px', fontWeight: 700, margin: 0 }}>
          Overall confidence: {confLabel(score)}
        </p>
        <div style={{
          height: '6px', backgroundColor: 'rgba(255,255,255,0.1)',
          borderRadius: '3px', overflow: 'hidden', marginTop: '8px',
        }}>
          <div style={{
            width: `${Math.min(100, Math.max(0, score))}%`,
            height: '100%',
            backgroundColor: confColor(score),
            borderRadius: '3px',
          }} />
        </div>
      </div>
      <span style={{
        padding: '4px 12px', borderRadius: '999px',
        backgroundColor: confBg(score), color: confColor(score),
        fontSize: '12px', fontWeight: 700,
      }}>
        {score}/100
      </span>
    </div>
  )
}

function CategoryCard({
  meta,
  data,
  generatedAt,
}: {
  meta: CategoryMeta
  data: CategoryInsight | undefined
  generatedAt: string
}) {
  const Icon = meta.icon
  const insights = Array.isArray(data?.insights) ? data!.insights : []
  const confidence = typeof data?.confidence === 'number' ? data!.confidence : 0

  return (
    <div style={{
      backgroundColor: '#0F2140',
      border: '1px solid rgba(255,255,255,0.1)',
      borderLeft: `4px solid ${meta.accent}`,
      borderRadius: '10px',
      padding: '22px 24px',
      display: 'flex', flexDirection: 'column', gap: '14px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '10px',
          backgroundColor: meta.accentBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Icon size={18} color={meta.accent} />
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ color: '#FFFFFF', fontSize: '15px', fontWeight: 700, margin: 0 }}>
            {meta.title}
          </h3>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', margin: '2px 0 0' }}>
            {meta.description}
          </p>
        </div>
        <span style={{
          padding: '3px 10px', borderRadius: '999px',
          backgroundColor: confBg(confidence), color: confColor(confidence),
          fontSize: '11px', fontWeight: 700, flexShrink: 0,
        }}>
          {confLabel(confidence)} · {confidence}
        </span>
      </div>

      {insights.length === 0 ? (
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', margin: 0 }}>
          No insights generated for this category.
        </p>
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {insights.map((text, i) => (
            <li key={i} style={{
              display: 'flex', gap: '10px',
              fontSize: '13px', color: 'rgba(255,255,255,0.85)', lineHeight: '1.55',
            }}>
              <span style={{
                width: '6px', height: '6px', borderRadius: '50%',
                backgroundColor: meta.accent, flexShrink: 0, marginTop: '7px',
              }} />
              <span>{text}</span>
            </li>
          ))}
        </ul>
      )}

      <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', margin: 'auto 0 0' }}>
        Updated {formatTimestamp(generatedAt)}
      </p>
    </div>
  )
}
