import { describe, it, expect, vi } from 'vitest'

// Prevent lib/supabase/client.ts from throwing on missing env vars.
// Tests inject a custom fetcher so the real client is never called.
vi.mock('@/lib/supabase/client', () => ({ supabase: {} }))

import {
  resolveContextPacket,
  type ContextFetcher,
  type ContextPacket,
} from './resolveContextPacket'

// ── Mock data helpers ─────────────────────────────────────────────────────────

function makeFetcher(overrides: Partial<ContextFetcher> = {}): ContextFetcher {
  return {
    fetchDirectDeps: vi.fn().mockResolvedValue([]),
    fetchIndirectDeps: vi.fn().mockResolvedValue([]),
    fetchOutputs: vi.fn().mockResolvedValue([]),
    ...overrides,
  }
}

const WS = 'ws-test-001'

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('resolveContextPacket', () => {

  it('all prerequisites present and approved — returns complete, non-provisional packet', async () => {
    const fetcher = makeFetcher({
      fetchDirectDeps: vi.fn().mockResolvedValue([
        { prerequisite_step_id: '1' },
        { prerequisite_step_id: '3' },
      ]),
      fetchIndirectDeps: vi.fn().mockResolvedValue([]),
      fetchOutputs: vi.fn().mockResolvedValue([
        { step_id: '1', content: { whatDoYouSell: 'We sell CRM software' }, status: 'approved', version: 2 },
        { step_id: '3', content: { segments: [{ name: 'Mid-market SaaS' }] }, status: 'approved', version: 1 },
      ]),
    })

    const packet: ContextPacket = await resolveContextPacket('5', WS, fetcher)

    expect(packet.step_id).toBe('5')
    expect(packet.workspace_id).toBe(WS)
    expect(packet.prerequisites).toHaveLength(2)
    expect(packet.missing_prerequisites).toHaveLength(0)
    expect(packet.is_provisional).toBe(false)
    expect(packet.trimmed).toBe(false)
    expect(packet.estimated_tokens).toBeGreaterThan(0)

    // Latest version wins (version 2 for step 1)
    const step1 = packet.prerequisites.find(p => p.step_id === '1')
    expect(step1?.version).toBe(2)
    expect(step1?.hop_distance).toBe(1)
  })

  it('some prerequisites missing — lists them in missing_prerequisites', async () => {
    const fetcher = makeFetcher({
      fetchDirectDeps: vi.fn().mockResolvedValue([
        { prerequisite_step_id: '1' },
        { prerequisite_step_id: '3' },
        { prerequisite_step_id: '4' },
      ]),
      fetchIndirectDeps: vi.fn().mockResolvedValue([]),
      // step 4 has no output record
      fetchOutputs: vi.fn().mockResolvedValue([
        { step_id: '1', content: { whatDoYouSell: 'Software' }, status: 'approved', version: 1 },
        { step_id: '3', content: { segments: [] }, status: 'approved', version: 1 },
      ]),
    })

    const packet = await resolveContextPacket('7', WS, fetcher)

    expect(packet.missing_prerequisites).toContain('4')
    expect(packet.missing_prerequisites).toHaveLength(1)
    expect(packet.prerequisites).toHaveLength(2)
    // Still not provisional because present ones are approved
    expect(packet.is_provisional).toBe(false)
  })

  it('some prerequisites unapproved — sets is_provisional to true', async () => {
    const fetcher = makeFetcher({
      fetchDirectDeps: vi.fn().mockResolvedValue([
        { prerequisite_step_id: '1' },
        { prerequisite_step_id: '3' },
      ]),
      fetchIndirectDeps: vi.fn().mockResolvedValue([]),
      fetchOutputs: vi.fn().mockResolvedValue([
        { step_id: '1', content: { whatDoYouSell: 'Software' }, status: 'approved', version: 1 },
        // step 3 is still a draft
        { step_id: '3', content: { segments: [] }, status: 'draft', version: 1 },
      ]),
    })

    const packet = await resolveContextPacket('5', WS, fetcher)

    expect(packet.is_provisional).toBe(true)
    expect(packet.missing_prerequisites).toHaveLength(0)
    expect(packet.prerequisites.find(p => p.step_id === '3')?.status).toBe('draft')
  })

  it('context trimming triggered — hop-2 content truncated when total tokens exceed 3000', async () => {
    // hop-2 dep has ~12 000 chars of content → ~3000 tokens on its own
    const largeContent = { data: 'x'.repeat(12000) }
    const smallContent = { summary: 'short text' }

    const fetcher = makeFetcher({
      // step '20' directly depends on '11' (hop 1)
      fetchDirectDeps: vi.fn().mockResolvedValue([
        { prerequisite_step_id: '11' },
      ]),
      // step '11' itself depends on '4' (so '4' is hop 2 from '20')
      fetchIndirectDeps: vi.fn().mockResolvedValue([
        { prerequisite_step_id: '4' },
      ]),
      fetchOutputs: vi.fn().mockResolvedValue([
        { step_id: '11', content: smallContent, status: 'approved', version: 1 },
        { step_id: '4',  content: largeContent, status: 'approved', version: 1 },
      ]),
    })

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)

    const packet = await resolveContextPacket('20', WS, fetcher)

    expect(packet.trimmed).toBe(true)

    // Hop-1 content left untouched
    const hop1 = packet.prerequisites.find(p => p.hop_distance === 1)
    expect(hop1?.content).toEqual(smallContent)

    // Hop-2 content replaced with summary stub
    const hop2 = packet.prerequisites.find(p => p.hop_distance === 2)
    expect(hop2?.content['_trimmed']).toBe(true)
    expect(typeof hop2?.content['_summary']).toBe('string')
    expect((hop2?.content['_summary'] as string).length).toBeLessThanOrEqual(300)

    // Token count recalculated after trimming
    expect(packet.estimated_tokens).toBeLessThan(3000 + 10) // within budget after trim

    // Trimming was logged
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[resolveContextPacket]'),
    )

    consoleSpy.mockRestore()
  })

})
