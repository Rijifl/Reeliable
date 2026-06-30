import React, { useEffect, useState } from 'react'
import { AnalyzeReelResponse } from '@ext/types'
import { c, mono, LogoMark, TranscriptSection, DiscrepanciesSection, ClaimsSection } from '@ext/ui'

// Standalone preview of the real side-panel UI (the same shared components the
// extension ships), driven by mock data — no extension or server needed.
const MOCK_RESULT: AnalyzeReelResponse = {
  reelId: 'mock-reel',
  transcript: [
    { text: 'Lose belly fat in 7 days with this one weird trick.', timestampMs: 1200 },
    { text: 'This herbal shot boosts your metabolism by 300%.', timestampMs: 5200 },
    { text: "Doctors don't want you to know this secret.", timestampMs: 9100 },
    { text: 'Use code FLASH for my supplement stack.', timestampMs: 14600 },
  ],
  claims: [
    {
      id: 'claim-1',
      text: 'This herbal shot boosts metabolism by 300%.',
      reasoning: 'A large, quantified physiological claim with no study, dosage, or population context.',
      authorSources: ['Unnamed "doctors"', 'Promo supplement code'],
      timestampMs: 5200,
      verdict: {
        status: 'contradicted',
        summary:
          'No reputable source supports a 300% metabolic boost from an herbal shot; documented effects of stimulants like caffeine are in the single-digit percentages and short-lived.',
        sources: [
          { title: 'nih.gov', url: 'https://www.nih.gov/' },
          { title: 'mayoclinic.org', url: 'https://www.mayoclinic.org/' },
        ],
      },
    },
    {
      id: 'claim-2',
      text: 'Lose belly fat in 7 days.',
      reasoning: 'A rapid, guaranteed body-composition promise framed as universal.',
      authorSources: [],
      timestampMs: 1200,
      verdict: {
        status: 'partially_true',
        summary:
          'Short-term scale changes are mostly water, not targeted fat loss; "spot reduction" of belly fat in 7 days is not supported.',
        sources: [{ title: 'hopkinsmedicine.org', url: 'https://www.hopkinsmedicine.org/' }],
      },
    },
  ],
  discrepancies: [
    {
      description: 'Before/after body shots use different lighting and posture, exaggerating the result.',
      frameTimestampMs: 7000,
      severity: 'medium',
    },
    {
      description: 'The product shown on screen differs from the one named in the caption.',
      frameTimestampMs: 15000,
      severity: 'high',
    },
  ],
}

const MAX_MS = 24000

export default function App() {
  const [currentMs, setCurrentMs] = useState(MAX_MS)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    if (!playing) return
    const t = setInterval(() => {
      setCurrentMs(prev => {
        const next = prev + 500
        if (next >= MAX_MS) { setPlaying(false); return MAX_MS }
        return next
      })
    }, 250)
    return () => clearInterval(t)
  }, [playing])

  return (
    <div style={{ minHeight: '100vh', background: '#04070c', color: c.text, fontFamily: "'Syne', sans-serif", display: 'flex', gap: 28, padding: 32, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
      {/* Phone mock */}
      <div style={{ width: 300, height: 600, borderRadius: 22, border: '1px solid #1f2937', overflow: 'hidden', background: 'linear-gradient(160deg, #1a1a2e, #0f172a, #0b1120)', position: 'relative', flexShrink: 0 }}>
        <div style={{ position: 'absolute', top: 12, left: 12, color: '#ffffff9a', fontFamily: mono, fontSize: 11 }}>{fmt(currentMs)}</div>
        <div style={{ position: 'absolute', bottom: 22, left: 16, right: 16, color: '#d1d5db', fontSize: 12, lineHeight: 1.45 }}>
          <div style={{ color: '#f9fafb', fontWeight: 700, marginBottom: 4 }}>@fitnessguru</div>
          7-day belly-fat trick they don&apos;t teach you 🔥
        </div>
      </div>

      {/* The real side-panel UI + scrub controls */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ width: 360, height: 600, overflow: 'hidden', borderRadius: 14, border: `1px solid ${c.border}`, background: c.bg, display: 'flex', flexDirection: 'column' }}>
          <header style={{ padding: '11px 14px', borderBottom: `1px solid ${c.border}`, display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: c.accentDim, border: '1px solid rgba(6,214,160,0.22)', borderRadius: 7 }}>
              <LogoMark />
            </div>
            <span style={{ fontWeight: 700, fontSize: 13 }}>Reeli<span style={{ color: c.accent }}>able</span></span>
            <span style={{ marginLeft: 'auto', fontFamily: mono, fontSize: 10, color: c.muted }}>@fitnessguru</span>
          </header>
          <main style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <TranscriptSection transcript={MOCK_RESULT.transcript} currentMs={currentMs} minHeight={0} maxHeight={140} />
            <DiscrepanciesSection discrepancies={MOCK_RESULT.discrepancies} currentMs={currentMs} />
            <ClaimsSection claims={MOCK_RESULT.claims} currentMs={currentMs} />
          </main>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { setCurrentMs(0); setPlaying(false) }} style={btn('#1f2937', '#d1d5db')}>Reset</button>
          <button onClick={() => setPlaying(p => !p)} style={btn(playing ? '#1f2937' : c.accent, playing ? '#d1d5db' : '#04070c')}>
            {playing ? 'Pause' : 'Play ▶'}
          </button>
        </div>
        <div style={{ fontFamily: mono, fontSize: 10, color: c.dim, textAlign: 'center' }}>
          UI preview · mock data · {fmt(currentMs)} / {fmt(MAX_MS)}
        </div>
      </div>
    </div>
  )
}

function fmt(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function btn(bg: string, color: string): React.CSSProperties {
  return { flex: 1, background: bg, border: 'none', color, borderRadius: 8, padding: '9px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }
}
