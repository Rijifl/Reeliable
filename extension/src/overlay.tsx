import React, { useEffect, useMemo, useRef } from 'react'
import ReactDOM from 'react-dom/client'
import { AnalyzeReelResponse, Discrepancy, ExtractedClaim, TranscriptEntry } from './types'

type OverlayState =
  | { status: 'idle' }
  | { status: 'processing'; creator: string }
  | { status: 'done'; creator: string; result: AnalyzeReelResponse; currentMs: number }
  | { status: 'error'; creator: string; message: string }

interface OverlayPosition {
  top: number
  left: number
  height: number
}

const c = {
  bg: '#040a0e',
  surface: '#0a1520',
  card: '#0d1b28',
  border: '#152030',
  borderActive: 'rgba(6,214,160,0.32)',
  accent: '#06d6a0',
  accentDim: 'rgba(6,214,160,0.09)',
  amber: '#f4a261',
  amberDim: 'rgba(244,162,97,0.10)',
  red: '#e63946',
  redDim: 'rgba(230,57,70,0.10)',
  text: '#dff2f0',
  muted: '#5a8a99',
  dim: '#1e3545',
}

const mono = "'IBM Plex Mono', monospace"
const sans = "'Syne', sans-serif"

const SHADOW_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500&family=Syne:wght@400;500;600;700;800&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #152030; border-radius: 4px; }
  ::-webkit-scrollbar-thumb:hover { background: #1e3545; }

  @keyframes spin   { to { transform: rotate(360deg); } }
  @keyframes spin-r { to { transform: rotate(-360deg); } }
  @keyframes pulse-op { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
  @keyframes fade-up {
    from { opacity:0; transform:translateY(8px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes beacon {
    0%,100% { box-shadow: 0 0 0 2px rgba(6,214,160,0.18); }
    50%      { box-shadow: 0 0 0 5px rgba(6,214,160,0.04); }
  }
`

function formatMs(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(total / 60)
  const s = String(total % 60).padStart(2, '0')
  return `${m}:${s}`
}

function SectionLabel({ children, color = c.accent, count }: { children: React.ReactNode; color?: string; count?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <span style={{ fontFamily: mono, fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color }}>
        {children}
      </span>
      {count !== undefined && (
        <span style={{ fontFamily: mono, fontSize: 9, color: c.dim, letterSpacing: '0.06em' }}>· {count}</span>
      )}
    </div>
  )
}

function TranscriptSection({ transcript, currentMs }: { transcript: TranscriptEntry[]; currentMs: number }) {
  const activeIndex = useMemo(() => {
    if (transcript.length === 0) return -1
    let best = 0, delta = Infinity
    for (let i = 0; i < transcript.length; i++) {
      const d = Math.abs(transcript[i].timestampMs - currentMs)
      if (d < delta) { best = i; delta = d }
    }
    return best
  }, [transcript, currentMs])

  const refs = useRef<Array<HTMLDivElement | null>>([])
  useEffect(() => {
    if (activeIndex >= 0) refs.current[activeIndex]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [activeIndex])

  return (
    <section>
      <SectionLabel count={transcript.length}>Transcript</SectionLabel>
      <div style={{
        maxHeight: 160,
        overflowY: 'auto',
        border: `1px solid ${c.border}`,
        borderRadius: 10,
        background: c.surface,
        padding: '6px 4px',
      }}>
        {transcript.length === 0 ? (
          <div style={{ color: c.dim, fontSize: 11, padding: '6px 8px', fontFamily: mono }}>no_transcript_data</div>
        ) : (
          transcript.map((entry, i) => {
            const active = i === activeIndex
            return (
              <div
                key={`${entry.timestampMs}-${entry.text}-${i}`}
                ref={el => { refs.current[i] = el }}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '40px 1fr',
                  gap: 8,
                  padding: '5px 6px',
                  borderRadius: 6,
                  background: active ? c.accentDim : 'transparent',
                  borderLeft: `2px solid ${active ? c.accent : 'transparent'}`,
                  transition: 'all 0.2s ease',
                  marginBottom: 2,
                }}
              >
                <span style={{ fontFamily: mono, color: active ? c.accent : c.dim, fontSize: 10, lineHeight: 1.6, transition: 'color 0.2s ease' }}>
                  {formatMs(entry.timestampMs)}
                </span>
                <span style={{ color: active ? c.text : c.muted, fontSize: 12, lineHeight: 1.55, transition: 'color 0.2s ease' }}>
                  {entry.text}
                </span>
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}

function severityConfig(severity: Discrepancy['severity']) {
  if (severity === 'high')   return { color: c.red,   bg: c.redDim,   label: 'HIGH RISK' }
  if (severity === 'medium') return { color: c.amber, bg: c.amberDim, label: 'MEDIUM' }
  return { color: c.muted, bg: 'rgba(90,138,153,0.07)', label: 'LOW' }
}

function DiscrepancySection({ discrepancies, currentMs }: { discrepancies: Discrepancy[]; currentMs: number }) {
  const visible = discrepancies.filter(d => d.frameTimestampMs <= currentMs)
  if (visible.length === 0) return null

  return (
    <section>
      <SectionLabel color={c.red} count={visible.length}>Discrepancies</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {visible.map((item, i) => {
          const cfg = severityConfig(item.severity)
          return (
            <div key={`${item.frameTimestampMs}-${i}`} style={{
              background: cfg.bg,
              border: `1px solid ${cfg.color}`,
              borderRadius: 10,
              padding: '10px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              animation: 'fade-up 0.3s ease forwards',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: mono, fontSize: 9, letterSpacing: '0.12em', color: cfg.color, fontWeight: 700 }}>
                  {cfg.label}
                </span>
                <span style={{ fontFamily: mono, fontSize: 9, color: c.dim }}>{formatMs(item.frameTimestampMs)}</span>
              </div>
              <div style={{ color: c.text, fontSize: 12, lineHeight: 1.55 }}>{item.description}</div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function ClaimCard({ claim, reached, idx }: { claim: ExtractedClaim; reached: boolean; idx: number }) {
  return (
    <article style={{
      border: `1px solid ${reached ? c.borderActive : c.border}`,
      borderRadius: 10,
      background: reached
        ? `linear-gradient(135deg, ${c.card} 0%, rgba(6,214,160,0.025) 100%)`
        : c.card,
      padding: '12px 14px',
      opacity: reached ? 1 : 0.45,
      transition: 'opacity 0.3s ease, border-color 0.35s ease, background 0.4s ease, box-shadow 0.35s ease',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      boxShadow: reached ? `0 0 16px rgba(6,214,160,0.05)` : 'none',
      animation: 'fade-up 0.3s ease forwards',
      animationDelay: `${idx * 55}ms`,
      animationFillMode: 'both',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ color: c.text, fontSize: 13, fontWeight: 600, lineHeight: 1.45, flex: 1 }}>{claim.text}</div>
        <span style={{ fontFamily: mono, color: c.dim, fontSize: 9, letterSpacing: '0.06em', flexShrink: 0, marginTop: 3 }}>
          {formatMs(claim.timestampMs)}
        </span>
      </div>
      {claim.reasoning && (
        <div style={{ color: c.muted, fontSize: 11, lineHeight: 1.6 }}>{claim.reasoning}</div>
      )}
      {claim.authorSources.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontFamily: mono, color: c.dim, fontSize: 9, textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>
            Creator Sources
          </span>
          {claim.authorSources.map((src, i) => (
            <span key={i} style={{ color: c.muted, fontSize: 11, lineHeight: 1.4, paddingLeft: 8, borderLeft: `1px solid ${c.dim}` }}>
              {src}
            </span>
          ))}
        </div>
      )}
    </article>
  )
}

function ClaimsSection({ claims, currentMs }: { claims: ExtractedClaim[]; currentMs: number }) {
  return (
    <section>
      <SectionLabel count={claims.length}>Claims</SectionLabel>
      {claims.length === 0 && (
        <div style={{ border: `1px solid ${c.border}`, borderRadius: 10, padding: '12px 14px', color: c.dim, fontSize: 11, fontFamily: mono }}>
          no_claims_detected
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {claims.map((claim, idx) => (
          <ClaimCard key={claim.id} claim={claim} reached={claim.timestampMs <= currentMs} idx={idx} />
        ))}
      </div>
    </section>
  )
}

function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 2px' }}>
      <div style={{ position: 'relative', width: 28, height: 28, flexShrink: 0 }}>
        <div style={{
          position: 'absolute', inset: 0,
          border: `2px solid ${c.border}`,
          borderTop: `2px solid ${c.accent}`,
          borderRadius: '50%',
          animation: 'spin 0.9s linear infinite',
        }} />
        <div style={{
          position: 'absolute', inset: 5,
          border: `1px solid ${c.dim}`,
          borderBottom: `1px solid ${c.accent}`,
          borderRadius: '50%',
          animation: 'spin-r 1.5s linear infinite',
          opacity: 0.5,
        }} />
      </div>
      <div>
        <div style={{ color: c.text, fontSize: 12, fontWeight: 600 }}>Analyzing Reel</div>
        <div style={{ fontFamily: mono, color: c.muted, fontSize: 10, letterSpacing: '0.06em', animation: 'pulse-op 2s ease-in-out infinite' }}>
          VLM pipeline running...
        </div>
      </div>
    </div>
  )
}

function OverlayApp({ state, pos }: { state: OverlayState; pos: OverlayPosition }) {
  const visible = state.status !== 'idle'
  const bodyHeight = Math.max(pos.height, 300)

  const statusColor = state.status === 'processing' ? c.amber : state.status === 'done' ? c.accent : c.red

  return (
    <div style={{
      position: 'fixed',
      top: pos.top,
      left: pos.left,
      width: 340,
      height: bodyHeight,
      borderRadius: 14,
      border: `1px solid ${c.border}`,
      background: c.bg,
      color: c.text,
      fontFamily: sans,
      boxShadow: '0 16px 48px rgba(0,0,0,0.65), 0 0 0 1px rgba(6,214,160,0.05)',
      zIndex: 2147483647,
      overflow: 'hidden',
      opacity: visible ? 1 : 0,
      pointerEvents: visible ? 'auto' : 'none',
      transition: 'opacity 0.2s ease',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Scan-line texture */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(6,214,160,0.012) 2px, rgba(6,214,160,0.012) 4px)',
        borderRadius: 14,
      }} />

      {/* Header */}
      <header style={{
        padding: '11px 14px',
        borderBottom: `1px solid ${c.border}`,
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        background: 'linear-gradient(180deg, rgba(6,214,160,0.04) 0%, transparent 100%)',
        flexShrink: 0,
        position: 'relative',
        zIndex: 1,
      }}>
        <div style={{
          width: 26, height: 26,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: c.accentDim,
          border: '1px solid rgba(6,214,160,0.22)',
          borderRadius: 7, flexShrink: 0,
        }}>
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
            <path d="M10 1.5L2.5 5.5v9l7.5 4 7.5-4v-9L10 1.5z" stroke="#06d6a0" strokeWidth="1.3" strokeLinejoin="round" />
            <path d="M7 10.5l2 2 4-4" stroke="#06d6a0" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <span style={{ fontWeight: 700, fontSize: 13, letterSpacing: '-0.01em' }}>
          Reel<span style={{ color: c.accent }}>Check</span>
        </span>
        {'creator' in state && state.creator && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 5, height: 5, borderRadius: '50%',
              background: statusColor,
              boxShadow: `0 0 6px ${statusColor}`,
              animation: state.status === 'processing' ? 'pulse-op 1.5s ease-in-out infinite' : 'none',
            }} />
            <span style={{
              fontFamily: mono, fontSize: 10, color: c.muted, letterSpacing: '0.04em',
              maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {state.creator}
            </span>
          </div>
        )}
      </header>

      {/* Main */}
      <main style={{
        flex: 1, overflowY: 'auto', padding: 12,
        display: 'flex', flexDirection: 'column', gap: 14,
        position: 'relative', zIndex: 1,
      }}>
        {state.status === 'processing' && <Spinner />}
        {state.status === 'error' && (
          <div style={{
            background: c.redDim, border: `1px solid ${c.red}`,
            borderRadius: 10, padding: '12px 14px',
            display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            <span style={{ fontFamily: mono, fontSize: 9, color: c.red, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              Analysis Error
            </span>
            <div style={{ color: '#fecaca', fontSize: 12, lineHeight: 1.55 }}>{state.message}</div>
          </div>
        )}
        {state.status === 'done' && (
          <>
            <TranscriptSection transcript={state.result.transcript} currentMs={state.currentMs} />
            <DiscrepancySection discrepancies={state.result.discrepancies} currentMs={state.currentMs} />
            <ClaimsSection claims={state.result.claims} currentMs={state.currentMs} />
          </>
        )}
      </main>
    </div>
  )
}

export class ReelCheckOverlay {
  private host: HTMLDivElement
  private root: ReactDOM.Root
  private state: OverlayState = { status: 'idle' }
  private pos: OverlayPosition = {
    top: 80,
    left: Math.max(8, window.innerWidth - 360),
    height: 400,
  }

  constructor() {
    this.host = document.createElement('div')
    this.host.id = 'reelcheck-overlay-host'
    this.host.style.cssText = 'all: initial; position: fixed; z-index: 2147483647;'
    this.host.addEventListener('click', e => e.stopPropagation())
    this.host.addEventListener('keydown', e => e.stopPropagation())

    const shadow = this.host.attachShadow({ mode: 'open' })
    document.body.appendChild(this.host)

    // Inject fonts + keyframes into the shadow root
    const style = document.createElement('style')
    style.textContent = SHADOW_STYLES
    shadow.appendChild(style)

    const container = document.createElement('div')
    shadow.appendChild(container)

    this.root = ReactDOM.createRoot(container)
    this.rerender()
  }

  private rerender() {
    this.root.render(<OverlayApp state={this.state} pos={this.pos} />)
  }

  setIdle() {
    this.state = { status: 'idle' }
    this.rerender()
  }

  setProcessing(creator: string) {
    this.state = { status: 'processing', creator }
    this.rerender()
  }

  setResult(result: AnalyzeReelResponse) {
    const creator = 'creator' in this.state ? this.state.creator : ''
    this.state = { status: 'done', creator, result, currentMs: 0 }
    this.rerender()
  }

  setError(message: string) {
    const creator = 'creator' in this.state ? this.state.creator : ''
    this.state = { status: 'error', creator, message }
    this.rerender()
  }

  setTime(ms: number) {
    if (this.state.status !== 'done') return
    this.state = { ...this.state, currentMs: ms }
    this.rerender()
  }

  updatePosition(videoRect: DOMRect) {
    const gap = 12
    const overlayWidth = 340
    const viewportWidth = window.innerWidth
    let left = videoRect.right + gap
    if (left + overlayWidth > viewportWidth - 8) {
      left = videoRect.left - overlayWidth - gap
    }
    left = Math.max(8, left)

    this.pos = {
      top: Math.max(8, videoRect.top),
      left,
      height: Math.max(300, videoRect.height - 80),
    }
    this.rerender()
  }

  destroy() {
    this.root.unmount()
    this.host.remove()
  }
}
