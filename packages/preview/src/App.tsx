import React, { useState, useEffect } from 'react'
import { CheckedClaim, ProcessReelResponse } from '@ext/types'

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_RESULT: ProcessReelResponse = {
  reelId: 'mock123',
  checkedClaims: [
    {
      claim: { id: '1', text: "You can't build muscle in a calorie deficit", type: 'body_composition', entities: ['muscle', 'calorie deficit'], timestamp_ms: 4200 },
      verdict: { claimId: '1', status: 'contradicted', summary: "Research shows beginners and returning lifters can build muscle while losing fat. It's harder for advanced athletes but not impossible.", sources: [{ title: 'Body Recomposition Research', url: '#', excerpt: '', siteName: 'examine.com' }] },
    },
    {
      claim: { id: '2', text: 'Creatine causes hair loss', type: 'supplement', entities: ['creatine', 'hair loss'], timestamp_ms: 12500 },
      verdict: { claimId: '2', status: 'partially_true', summary: 'One small study found creatine raised DHT levels linked to hair loss, but no study has directly shown it causes hair loss. Evidence is weak.', sources: [{ title: 'Creatine and DHT levels', url: '#', excerpt: '', siteName: 'pubmed.ncbi.nlm.nih.gov' }] },
    },
    {
      claim: { id: '3', text: 'You need protein within 30 minutes of training', type: 'nutrition', entities: ['protein', 'anabolic window'], timestamp_ms: 27000 },
      verdict: { claimId: '3', status: 'contradicted', summary: 'The "anabolic window" is much wider than 30 minutes. Total daily protein intake matters far more than exact timing.', sources: [{ title: 'Nutrient Timing Revisited', url: '#', excerpt: '', siteName: 'jissn.biomedcentral.com' }] },
    },
    {
      claim: { id: '4', text: 'Cold plunges increase testosterone by 300%', type: 'health_outcome', entities: ['cold plunge', 'testosterone'], timestamp_ms: 41000 },
      verdict: { claimId: '4', status: 'unverified', summary: 'No peer-reviewed study supports a 300% increase. Some studies show modest short-term hormonal changes but nothing close to this figure.', sources: [] },
    },
  ],
}

// ── Colours ───────────────────────────────────────────────────────────────────

const c = {
  bg: '#0a0a0f', card: '#12121a', border: '#1e1e2e',
  accent: '#6366f1', green: '#22c55e', yellow: '#eab308',
  red: '#ef4444', muted: '#94a3b8', dim: '#64748b', text: '#e2e8f0',
}

const STATUS_COLOR: Record<string, string> = {
  supported: c.green, contradicted: c.red, partially_true: c.yellow, unverified: c.muted,
}
const STATUS_LABEL: Record<string, string> = {
  supported: '✓ Supported', contradicted: '✗ Contradicted',
  partially_true: '~ Partially true', unverified: '? Unverified',
}

function formatMs(ms: number) {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

// ── Card ──────────────────────────────────────────────────────────────────────

function Card({ item, reached }: { item: CheckedClaim; reached: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const { claim, verdict } = item
  const color = STATUS_COLOR[verdict.status] ?? c.muted

  return (
    <div style={{
      background: c.card, border: `1.5px solid ${reached ? color : c.border}`,
      borderRadius: 10, padding: '12px 14px',
      opacity: reached ? 1 : 0.4, transition: 'all 0.3s ease',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ color, fontWeight: 700, fontSize: 12 }}>{STATUS_LABEL[verdict.status]}</span>
        <span style={{ color: c.dim, fontSize: 11 }}>{formatMs(claim.timestamp_ms)}</span>
      </div>
      <div style={{ color: c.accent, fontSize: 12, fontStyle: 'italic', marginBottom: 6 }}>
        "{claim.text}"
      </div>
      <div style={{ color: c.muted, fontSize: 13, lineHeight: 1.55 }}>{verdict.summary}</div>
      {verdict.sources.length > 0 && (
        <>
          <button onClick={() => setExpanded(e => !e)} style={{ background: 'none', border: 'none', color: c.dim, cursor: 'pointer', fontSize: 11, marginTop: 8, padding: 0 }}>
            {expanded ? '▲ hide sources' : `▼ ${verdict.sources.length} source(s)`}
          </button>
          {expanded && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {verdict.sources.map((s, i) => (
                <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: c.accent, textDecoration: 'none' }}>
                  {s.siteName} — {s.title}
                </a>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Panel shell ───────────────────────────────────────────────────────────────

function SidePanel({ currentMs }: { currentMs: number }) {
  return (
    <div style={{ width: 340, minHeight: 700, background: c.bg, borderRadius: 12, border: `1px solid ${c.border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${c.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.green, boxShadow: `0 0 6px ${c.green}` }} />
        <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: '-0.3px', color: c.text }}>ReelCheck</span>
        <span style={{ color: c.dim, fontSize: 12, marginLeft: 'auto' }}>@fitnessguru</span>
      </div>
      <div style={{ flex: 1, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {MOCK_RESULT.checkedClaims.map(item => (
          <Card key={item.claim.id} item={item} reached={item.claim.timestamp_ms <= currentMs} />
        ))}
      </div>
    </div>
  )
}

// ── Preview page ──────────────────────────────────────────────────────────────

export default function App() {
  const [currentMs, setCurrentMs] = useState(0)
  const [playing, setPlaying] = useState(false)

  // Simulate video playback scrubbing through the reel
  useEffect(() => {
    if (!playing) return
    const interval = setInterval(() => {
      setCurrentMs(ms => {
        const next = ms + 500
        if (next >= 50000) { setPlaying(false); return 50000 }
        return next
      })
    }, 500)
    return () => clearInterval(interval)
  }, [playing])

  return (
    <div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 32, padding: 40, flexWrap: 'wrap' }}>

      {/* Fake Instagram reel */}
      <div style={{ width: 390, height: 700, background: '#111', borderRadius: 16, position: 'relative', overflow: 'hidden', border: '1px solid #222', flexShrink: 0 }}>
        <div style={{ width: '100%', height: '100%', background: 'linear-gradient(160deg, #1a1a2e, #16213e, #0f3460)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff22', fontSize: 48 }}>▶</div>
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 12px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 14, marginBottom: 4 }}>@fitnessguru</div>
              <div style={{ color: '#ffffffcc', fontSize: 12, maxWidth: 260, lineHeight: 1.4 }}>Everything you thought you knew about gains is WRONG 🔥 #fitness #gym #nutrition</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center', color: '#fff' }}>
              <div style={{ fontSize: 24 }}>♡</div>
              <div style={{ fontSize: 22 }}>💬</div>
              <div style={{ fontSize: 22 }}>↗</div>
            </div>
          </div>
        </div>
        {/* Fake playback time */}
        <div style={{ position: 'absolute', top: 12, left: 12, color: '#ffffff88', fontSize: 11 }}>{formatMs(currentMs)}</div>
      </div>

      {/* Side panel */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <SidePanel currentMs={currentMs} />

        {/* Playback controls */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { setCurrentMs(0); setPlaying(false) }}
            style={{ flex: 1, padding: '8px 0', background: '#1e1e2e', border: '1px solid #2e2e3e', borderRadius: 8, color: c.muted, cursor: 'pointer', fontSize: 12 }}>
            ↺ Reset
          </button>
          <button onClick={() => setPlaying(p => !p)}
            style={{ flex: 1, padding: '8px 0', background: playing ? '#1e1e2e' : c.accent, border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
            {playing ? '⏸ Pause' : '▶ Play'}
          </button>
        </div>
        <div style={{ color: c.dim, fontSize: 11, textAlign: 'center' }}>
          Cards appear as video reaches each timestamp
        </div>
      </div>

    </div>
  )
}
