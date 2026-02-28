import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AnalyzeReelResponse, Discrepancy, ExtractedClaim, TranscriptEntry } from '@ext/types'

const MOCK_RESULT: AnalyzeReelResponse = {
  reelId: 'mock-reel',
  transcript: [
    { text: 'Lose belly fat in 7 days with this method.', timestampMs: 1200 },
    { text: 'This herbal shot boosts metabolism by 300 percent.', timestampMs: 5200 },
    { text: 'Doctors do not want you to know this secret.', timestampMs: 9100 },
    { text: 'Use code FLASH for my supplement stack.', timestampMs: 14600 },
  ],
  claims: [
    {
      id: 'claim-1',
      text: 'Herbal shot boosts metabolism by 300 percent.',
      reasoning: 'This is a quantified physiological claim with a large effect size and no context about study design or population.',
      authorSources: ['Mentions unnamed doctors', 'Promotional supplement code'],
      timestampMs: 5200,
    },
    {
      id: 'claim-2',
      text: 'Lose belly fat in 7 days.',
      reasoning: 'A rapid body-composition promise is likely to be interpreted as guaranteed and universally applicable.',
      authorSources: [],
      timestampMs: 1200,
    },
  ],
  discrepancies: [
    {
      description: 'Before/after body shots appear edited and not matched by equivalent lighting or angle.',
      frameTimestampMs: 7000,
      severity: 'medium',
    },
    {
      description: 'Product shown on screen differs from label shown in text overlay.',
      frameTimestampMs: 15000,
      severity: 'high',
    },
  ],
}

const c = {
  bg: '#081018',
  card: '#12202c',
  border: '#1d3346',
  accent: '#36b4f2',
  amber: '#f59e0b',
  red: '#ef4444',
  text: '#dbeafe',
  muted: '#91a8bd',
  dim: '#5f768a',
}

function formatMs(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(total / 60)
  const s = String(total % 60).padStart(2, '0')
  return `${m}:${s}`
}

function TranscriptSection({ transcript, currentMs }: { transcript: TranscriptEntry[]; currentMs: number }) {
  const activeIndex = useMemo(() => {
    if (transcript.length === 0) return -1
    let best = 0
    let delta = Number.POSITIVE_INFINITY
    for (let i = 0; i < transcript.length; i++) {
      const d = Math.abs(transcript[i].timestampMs - currentMs)
      if (d < delta) {
        delta = d
        best = i
      }
    }
    return best
  }, [transcript, currentMs])

  const refs = useRef<Array<HTMLDivElement | null>>([])
  useEffect(() => {
    if (activeIndex < 0) return
    refs.current[activeIndex]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [activeIndex])

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <h3 style={{ color: c.accent, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Transcript
      </h3>
      <div style={{
        minHeight: 200,
        maxHeight: 320,
        overflowY: 'auto',
        border: `1px solid ${c.border}`,
        borderRadius: 10,
        background: '#0e1a25',
        padding: 8,
      }}>
        {transcript.map((entry, index) => {
          const active = index === activeIndex
          return (
            <div
              key={`${entry.timestampMs}-${entry.text}-${index}`}
              ref={(el) => { refs.current[index] = el }}
              style={{
                display: 'grid',
                gridTemplateColumns: '44px 1fr',
                gap: 8,
                padding: '6px 4px',
                borderRadius: 8,
                background: active ? 'rgba(54,180,242,0.14)' : 'transparent',
              }}
            >
              <span style={{ color: active ? c.accent : c.dim, fontSize: 11 }}>{formatMs(entry.timestampMs)}</span>
              <span style={{ color: active ? c.text : c.muted, fontSize: 12, lineHeight: 1.5 }}>{entry.text}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function discrepancyColor(severity: Discrepancy['severity']) {
  return severity === 'high' ? c.red : c.amber
}

function DiscrepanciesSection({ discrepancies, currentMs }: { discrepancies: Discrepancy[]; currentMs: number }) {
  const visible = discrepancies.filter((d) => d.frameTimestampMs <= currentMs)
  if (visible.length === 0) return null

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <h3 style={{ color: c.accent, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Discrepancies
      </h3>
      {visible.map((item, index) => {
        const color = discrepancyColor(item.severity)
        return (
          <div key={`${item.frameTimestampMs}-${index}`} style={{
            border: `1px solid ${color}`,
            borderRadius: 10,
            background: 'rgba(0,0,0,0.24)',
            padding: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
              <span style={{ color, fontWeight: 700, textTransform: 'uppercase' }}>{item.severity}</span>
              <span style={{ color: c.dim }}>{formatMs(item.frameTimestampMs)}</span>
            </div>
            <div style={{ color: c.text, fontSize: 12, lineHeight: 1.5 }}>{item.description}</div>
          </div>
        )
      })}
    </section>
  )
}

function ClaimsSection({ claims, currentMs }: { claims: ExtractedClaim[]; currentMs: number }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <h3 style={{ color: c.accent, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Claims
      </h3>
      {claims.map((claim) => {
        const reached = claim.timestampMs <= currentMs
        return (
          <article key={claim.id} style={{
            border: `1px solid ${reached ? c.accent : c.border}`,
            borderRadius: 10,
            background: c.card,
            padding: 10,
            opacity: reached ? 1 : 0.42,
            transition: 'opacity 0.25s ease, border-color 0.25s ease',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ color: c.text, fontSize: 13, fontWeight: 600, lineHeight: 1.5 }}>{claim.text}</div>
              <span style={{ color: c.dim, fontSize: 11 }}>{formatMs(claim.timestampMs)}</span>
            </div>
            <div style={{ color: c.muted, fontSize: 12, lineHeight: 1.55 }}>{claim.reasoning}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ color: c.dim, fontSize: 11, textTransform: 'uppercase' }}>Author Sources</span>
              {claim.authorSources.length === 0 && <span style={{ color: c.dim, fontSize: 11 }}>No sources cited by creator.</span>}
              {claim.authorSources.map((source, index) => (
                <span key={`${source}-${index}`} style={{ color: c.text, fontSize: 11, lineHeight: 1.4 }}>
                  - {source}
                </span>
              ))}
            </div>
          </article>
        )
      })}
    </section>
  )
}

function SidePanel({ currentMs }: { currentMs: number }) {
  return (
    <div style={{
      width: 360,
      minHeight: 720,
      border: `1px solid ${c.border}`,
      borderRadius: 12,
      background: c.bg,
      color: c.text,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <header style={{
        padding: '14px 16px',
        borderBottom: `1px solid ${c.border}`,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.accent }} />
        <span style={{ fontWeight: 700, fontSize: 15 }}>ReelCheck VLM</span>
        <span style={{ color: c.dim, fontSize: 12, marginLeft: 'auto' }}>@fitnessguru</span>
      </header>
      <main style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <TranscriptSection transcript={MOCK_RESULT.transcript} currentMs={currentMs} />
        <DiscrepanciesSection discrepancies={MOCK_RESULT.discrepancies} currentMs={currentMs} />
        <ClaimsSection claims={MOCK_RESULT.claims} currentMs={currentMs} />
      </main>
    </div>
  )
}

export default function App() {
  const [currentMs, setCurrentMs] = useState(0)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    if (!playing) return
    const timer = setInterval(() => {
      setCurrentMs((prev) => {
        const next = prev + 500
        if (next >= 24000) {
          setPlaying(false)
          return 24000
        }
        return next
      })
    }, 500)
    return () => clearInterval(timer)
  }, [playing])

  return (
    <div style={{
      minHeight: '100vh',
      background: '#04070c',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 28,
      padding: 32,
      flexWrap: 'wrap',
    }}>
      <div style={{
        width: 390,
        height: 720,
        borderRadius: 16,
        border: '1px solid #1f2937',
        overflow: 'hidden',
        background: 'linear-gradient(160deg, #1a1a2e, #0f172a, #0b1120)',
        position: 'relative',
      }}>
        <div style={{ position: 'absolute', top: 12, left: 12, color: '#ffffff9a', fontSize: 11 }}>
          {formatMs(currentMs)}
        </div>
        <div style={{ position: 'absolute', bottom: 24, left: 16, right: 16, color: '#d1d5db', fontSize: 12, lineHeight: 1.45 }}>
          <div style={{ color: '#f9fafb', fontWeight: 700, marginBottom: 4 }}>@fitnessguru</div>
          7-day fat loss trick they do not teach you.
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <SidePanel currentMs={currentMs} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => { setCurrentMs(0); setPlaying(false) }}
            style={{
              flex: 1,
              background: '#1f2937',
              border: '1px solid #374151',
              color: '#d1d5db',
              borderRadius: 8,
              padding: '8px 10px',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Reset
          </button>
          <button
            onClick={() => setPlaying((p) => !p)}
            style={{
              flex: 1,
              background: playing ? '#1f2937' : c.accent,
              border: 'none',
              color: '#f8fafc',
              borderRadius: 8,
              padding: '8px 10px',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            {playing ? 'Pause' : 'Play'}
          </button>
        </div>
      </div>
    </div>
  )
}
