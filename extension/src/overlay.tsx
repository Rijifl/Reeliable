import { useState } from 'react'
import ReactDOM from 'react-dom/client'
import { CheckedClaim, ProcessReelResponse } from './types'

// ── Types ────────────────────────────────────────────────────────────────────

type OverlayState =
  | { status: 'idle' }
  | { status: 'processing'; creator: string }
  | { status: 'done'; result: ProcessReelResponse; creator: string; currentMs: number }

interface OverlayPosition {
  top: number
  left: number
  height: number
}

// ── Colours (matches panel.tsx exactly) ──────────────────────────────────────

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

// ── Helpers ──────────────────────────────────────────────────────────────────

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
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ color, fontWeight: 700, fontSize: 12 }}>
          {STATUS_LABEL[verdict.status]}
        </span>
        <span style={{ color: c.dim, fontSize: 11 }}>{formatMs(claim.timestamp_ms)}</span>
      </div>

      <div style={{ color: c.accent, fontSize: 12, fontStyle: 'italic', marginBottom: 6 }}>
        "{claim.text}"
      </div>

      <div style={{ color: c.muted, fontSize: 13, lineHeight: 1.55 }}>
        {verdict.summary}
      </div>

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
        width: 28, height: 28,
        border: `3px solid ${c.border}`,
        borderTop: `3px solid ${c.accent}`,
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <span style={{ color: c.dim, fontSize: 13 }}>Analyzing reel…</span>
    </div>
  )
}

// ── Overlay app — driven entirely by props, no useEffect state sync needed ───

interface OverlayAppProps {
  state: OverlayState
  pos: OverlayPosition
}

function OverlayApp({ state, pos }: OverlayAppProps) {
  const visible = state.status !== 'idle'
  const height = Math.max(pos.height, 200)

  return (
    <>
      {/* Inject keyframes into shadow DOM */}
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

      <div style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        width: 300,
        height,
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: 12,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fontSize: 14,
        color: c.text,
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'all' : 'none',
        transition: 'opacity 0.25s ease',
        zIndex: 2147483647,
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 16px',
          borderBottom: `1px solid ${c.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexShrink: 0,
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: c.green, boxShadow: `0 0 6px ${c.green}`,
          }} />
          <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: '-0.3px' }}>ReelCheck</span>
          {state.status !== 'idle' && 'creator' in state && state.creator && (
            <span style={{ color: c.dim, fontSize: 12, marginLeft: 'auto' }}>{state.creator}</span>
          )}
        </div>

        {/* Body */}
        <div style={{
          flex: 1,
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          overflowY: 'auto',
        }}>
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
    </>
  )
}

// ── ReelCheckOverlay class ─────────────────────────────────────────────────────

export class ReelCheckOverlay {
  private host: HTMLDivElement
  private root: ReactDOM.Root
  // State lives here in the class — no useEffect race conditions
  private state: OverlayState = { status: 'idle' }
  private pos: OverlayPosition = {
    top: 80,
    left: Math.max(8, window.innerWidth - 320),
    height: 400,
  }

  constructor() {
    console.log('[ReelCheck] ReelCheckOverlay constructor')
    this.host = document.createElement('div')
    this.host.id = 'reelcheck-overlay-host'
    this.host.style.cssText = 'all: initial; position: fixed; z-index: 2147483647;'
    // Prevent Instagram's event handlers from firing on our overlay
    this.host.addEventListener('click', (e) => e.stopPropagation())
    this.host.addEventListener('keydown', (e) => e.stopPropagation())

    const shadow = this.host.attachShadow({ mode: 'open' })
    document.body.appendChild(this.host)

    const container = document.createElement('div')
    shadow.appendChild(container)

    this.root = ReactDOM.createRoot(container)
    this.rerender()
  }

  private rerender() {
    this.root.render(<OverlayApp state={this.state} pos={this.pos} />)
  }

  setProcessing(creator: string) {
    this.state = { status: 'processing', creator }
    this.rerender()
  }

  setResult(result: ProcessReelResponse) {
    const creator = this.state.status !== 'idle' ? (this.state as any).creator ?? '' : ''
    this.state = { status: 'done', result, creator, currentMs: 0 }
    this.rerender()
  }

  setTime(ms: number) {
    if (this.state.status !== 'done') return
    this.state = { ...this.state, currentMs: ms }
    this.rerender()
  }

  updatePosition(videoRect: DOMRect) {
    const gap = 12
    const overlayWidth = 300
    const viewportWidth = window.innerWidth

    let left = videoRect.right + gap
    if (left + overlayWidth > viewportWidth - 8) {
      left = videoRect.left - overlayWidth - gap
    }
    left = Math.max(8, left)

    this.pos = {
      top: Math.max(8, videoRect.top),
      left,
      height: videoRect.height - 100,
    }
    this.rerender()
  }

  destroy() {
    this.root.unmount()
    this.host.remove()
  }
}
