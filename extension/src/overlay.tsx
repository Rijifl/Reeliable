import React from 'react'
import ReactDOM from 'react-dom/client'
import { AnalyzeReelResponse } from './types'
import { c, mono, LogoMark, Spinner, TranscriptSection, DiscrepanciesSection, ClaimsSection } from './ui'

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

const sans = "'Syne', sans-serif"

// Injected into the overlay's shadow root. Mirrors the keyframes panel.html
// provides for the side panel, so the shared <Spinner>/card animations work here too.
const SHADOW_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500&family=Syne:wght@400;500;600;700;800&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #152030; border-radius: 4px; }
  ::-webkit-scrollbar-thumb:hover { background: #1e3545; }

  @keyframes spin         { to { transform: rotate(360deg); } }
  @keyframes spin-reverse { to { transform: rotate(-360deg); } }
  @keyframes pulse-opacity { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
  @keyframes fade-up {
    from { opacity:0; transform:translateY(8px); }
    to   { opacity:1; transform:translateY(0); }
  }
`

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
          <LogoMark size={14} />
        </div>
        <span style={{ fontWeight: 700, fontSize: 13, letterSpacing: '-0.01em' }}>
          Reeli<span style={{ color: c.accent }}>able</span>
        </span>
        {'creator' in state && state.creator && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 5, height: 5, borderRadius: '50%',
              background: statusColor,
              boxShadow: `0 0 6px ${statusColor}`,
              animation: state.status === 'processing' ? 'pulse-opacity 1.5s ease-in-out infinite' : 'none',
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
        {state.status === 'processing' && <Spinner compact />}
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
            <TranscriptSection transcript={state.result.transcript} currentMs={state.currentMs} minHeight={0} maxHeight={160} />
            <DiscrepanciesSection discrepancies={state.result.discrepancies} currentMs={state.currentMs} />
            <ClaimsSection claims={state.result.claims} currentMs={state.currentMs} />
          </>
        )}
      </main>
    </div>
  )
}

export class ReeliableOverlay {
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
    this.host.id = 'reeliable-overlay-host'
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
