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

function TranscriptSection({
  transcript,
  currentMs,
}: {
  transcript: TranscriptEntry[]
  currentMs: number
}) {
  const activeIndex = useMemo(() => {
    if (transcript.length === 0) return -1
    let idx = 0
    let bestDelta = Number.POSITIVE_INFINITY
    for (let i = 0; i < transcript.length; i++) {
      const delta = Math.abs(transcript[i].timestampMs - currentMs)
      if (delta < bestDelta) {
        bestDelta = delta
        idx = i
      }
    }
    return idx
  }, [transcript, currentMs])

  const lineRefs = useRef<Array<HTMLDivElement | null>>([])
  useEffect(() => {
    if (activeIndex < 0) return
    lineRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [activeIndex])

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <h3 style={{ color: c.accent, fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        Transcript
      </h3>
      <div style={{
        maxHeight: 160,
        overflowY: 'auto',
        border: `1px solid ${c.border}`,
        borderRadius: 10,
        background: '#0e1a25',
        padding: 8,
      }}>
        {transcript.length === 0 && (
          <div style={{ color: c.dim, fontSize: 12 }}>No visible text detected.</div>
        )}
        {transcript.map((entry, index) => {
          const active = index === activeIndex
          return (
            <div
              key={`${entry.timestampMs}-${entry.text}-${index}`}
              ref={(el) => { lineRefs.current[index] = el }}
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

function DiscrepancySection({
  discrepancies,
  currentMs,
}: {
  discrepancies: Discrepancy[]
  currentMs: number
}) {
  const visible = discrepancies.filter((item) => item.frameTimestampMs <= currentMs)
  if (visible.length === 0) return null

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <h3 style={{ color: c.accent, fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
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

function ClaimCard({ claim, reached }: { claim: ExtractedClaim; reached: boolean }) {
  return (
    <article style={{
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
        <span style={{ color: c.dim, fontSize: 11, flexShrink: 0 }}>{formatMs(claim.timestampMs)}</span>
      </div>
      <div style={{ color: c.muted, fontSize: 12, lineHeight: 1.5 }}>{claim.reasoning || 'No reasoning provided.'}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ color: c.dim, fontSize: 11, textTransform: 'uppercase' }}>Author Sources</span>
        {claim.authorSources.length === 0 && (
          <span style={{ color: c.dim, fontSize: 11 }}>No sources cited by creator.</span>
        )}
        {claim.authorSources.map((source, index) => (
          <span key={`${source}-${index}`} style={{ color: c.text, fontSize: 11, lineHeight: 1.4 }}>
            - {source}
          </span>
        ))}
      </div>
    </article>
  )
}

function ClaimsSection({
  claims,
  currentMs,
}: {
  claims: ExtractedClaim[]
  currentMs: number
}) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <h3 style={{ color: c.accent, fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        Claims
      </h3>
      {claims.length === 0 && (
        <div style={{ color: c.dim, fontSize: 12, border: `1px solid ${c.border}`, borderRadius: 10, padding: 10 }}>
          No major factual claims detected.
        </div>
      )}
      {claims.map((claim) => (
        <ClaimCard key={claim.id} claim={claim} reached={claim.timestampMs <= currentMs} />
      ))}
    </section>
  )
}

function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 2px' }}>
      <div style={{
        width: 16,
        height: 16,
        border: `2px solid ${c.border}`,
        borderTop: `2px solid ${c.accent}`,
        borderRadius: '50%',
        animation: 'spin 0.9s linear infinite',
      }} />
      <span style={{ color: c.muted, fontSize: 12 }}>Running VLM analysis...</span>
    </div>
  )
}

function OverlayApp({ state, pos }: { state: OverlayState; pos: OverlayPosition }) {
  const visible = state.status !== 'idle'
  const bodyHeight = Math.max(pos.height, 280)

  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
        fontFamily: '"IBM Plex Sans", "Segoe UI", sans-serif',
        boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
        zIndex: 2147483647,
        overflow: 'hidden',
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
        transition: 'opacity 0.2s ease',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <header style={{
          padding: '12px 14px',
          borderBottom: `1px solid ${c.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexShrink: 0,
        }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.accent }} />
          <span style={{ fontSize: 14, fontWeight: 700 }}>ReelCheck VLM</span>
          {'creator' in state && state.creator && (
            <span style={{ marginLeft: 'auto', color: c.dim, fontSize: 11 }}>{state.creator}</span>
          )}
        </header>

        <main style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {state.status === 'processing' && <Spinner />}
          {state.status === 'error' && (
            <div style={{ border: `1px solid ${c.red}`, borderRadius: 10, color: '#fecaca', padding: 10, fontSize: 12 }}>
              {state.message}
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
    </>
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
