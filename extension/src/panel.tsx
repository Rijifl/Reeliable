import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { CheckedClaim, ProcessReelResponse } from './types'

// ── Types ────────────────────────────────────────────────────────────────────

type PanelState =
  | { status: 'idle' }
  | { status: 'processing'; reelId: string; creator: string }
  | { status: 'done'; result: ProcessReelResponse; creator: string; currentMs: number }

// ── Colours ──────────────────────────────────────────────────────────────────

const c = {
  bg: '#0a0a0f',
  card: '#12121a',
  border: '#1e1e2e',
  accent: '#6366f1',
  green: '#22c55e',
  yellow: '#eab308',
  red: '#ef4444',
  muted: '#94a3b8',
  dim: '#64748b',
  text: '#e2e8f0',
}

const STATUS_COLOR: Record<string, string> = {
  supported: c.green,
  contradicted: c.red,
  partially_true: c.yellow,
  unverified: c.muted,
}

const STATUS_LABEL: Record<string, string> = {
  supported: '✓ Supported',
  contradicted: '✗ Contradicted',
  partially_true: '~ Partially true',
  unverified: '? Unverified',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatMs(ms: number) {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

// ── Components ────────────────────────────────────────────────────────────────

function Card({ item, reached }: { item: CheckedClaim; reached: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const { claim, verdict } = item
  const color = STATUS_COLOR[verdict.status] ?? c.muted

  return (
    <div style={{
      background: c.card,
      border: `1.5px solid ${reached ? color : c.border}`,
      borderRadius: 10,
      padding: '12px 14px',
      opacity: reached ? 1 : 0.4,
      transition: 'all 0.3s ease',
    }}>
      {/* Timestamp + status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ color, fontWeight: 700, fontSize: 12 }}>
          {STATUS_LABEL[verdict.status]}
        </span>
        <span style={{ color: c.dim, fontSize: 11 }}>{formatMs(claim.timestamp_ms)}</span>
      </div>

      {/* Claim text */}
      <div style={{ color: c.accent, fontSize: 12, fontStyle: 'italic', marginBottom: 6 }}>
        "{claim.text}"
      </div>

      {/* Summary */}
      <div style={{ color: c.muted, fontSize: 13, lineHeight: 1.55 }}>
        {verdict.summary}
      </div>

      {/* Sources toggle */}
      {verdict.sources.length > 0 && (
        <>
          <button
            onClick={() => setExpanded(e => !e)}
            style={{
              background: 'none', border: 'none', color: c.dim,
              cursor: 'pointer', fontSize: 11, marginTop: 8, padding: 0,
            }}
          >
            {expanded ? '▲ hide sources' : `▼ ${verdict.sources.length} source${verdict.sources.length > 1 ? 's' : ''}`}
          </button>
          {expanded && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {verdict.sources.map((s, i) => (
                <a
                  key={i}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 11, color: c.accent, textDecoration: 'none', lineHeight: 1.4 }}
                >
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

function Spinner() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: 40 }}>
      <div style={{
        width: 28, height: 28, border: `3px solid ${c.border}`,
        borderTop: `3px solid ${c.accent}`, borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <span style={{ color: c.dim, fontSize: 13 }}>Analyzing reel…</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

// ── Panel app ─────────────────────────────────────────────────────────────────

function Panel() {
  const [state, setState] = useState<PanelState>({ status: 'idle' })

  useEffect(() => {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type === 'REEL_CHANGED') {
        setState({ status: 'processing', reelId: msg.reelId, creator: msg.creator })
      }

      if (msg.type === 'REEL_PROCESSING') {
        setState(prev =>
          prev.status !== 'idle'
            ? { ...prev, status: 'processing' }
            : prev
        )
      }

      if (msg.type === 'REEL_CHECKED') {
        setState(prev => ({
          status: 'done',
          result: msg.result,
          creator: prev.status !== 'idle' ? prev.creator : '',
          currentMs: 0,
        }))
      }

      if (msg.type === 'VIDEO_TIME' && state.status === 'done') {
        setState(prev =>
          prev.status === 'done' ? { ...prev, currentMs: msg.currentMs } : prev
        )
      }
    })
  }, [state.status])

  return (
    <div style={{ minHeight: '100vh', background: c.bg, display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{
        padding: '14px 16px',
        borderBottom: `1px solid ${c.border}`,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.green, boxShadow: `0 0 6px ${c.green}` }} />
        <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: '-0.3px' }}>ReelCheck</span>
        {state.status !== 'idle' && 'creator' in state && state.creator && (
          <span style={{ color: c.dim, fontSize: 12, marginLeft: 'auto' }}>{state.creator}</span>
        )}
      </div>

      {/* Body */}
      <div style={{ flex: 1, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>

        {state.status === 'idle' && (
          <div style={{ padding: 40, textAlign: 'center', color: c.dim, fontSize: 13, lineHeight: 1.7 }}>
            Open an Instagram Reel<br />to start fact-checking
          </div>
        )}

        {state.status === 'processing' && <Spinner />}

        {state.status === 'done' && state.result.checkedClaims.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: c.dim, fontSize: 13 }}>
            No health or fitness claims detected in this reel.
          </div>
        )}

        {state.status === 'done' && state.result.checkedClaims.map((item) => (
          <Card
            key={item.claim.id}
            item={item}
            reached={item.claim.timestamp_ms <= state.currentMs}
          />
        ))}

      </div>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><Panel /></React.StrictMode>
)
