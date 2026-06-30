import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { AnalyzeReelResponse, ChromeMessage } from './types'
import { c, mono, LogoMark, Spinner, TranscriptSection, DiscrepanciesSection, ClaimsSection } from './ui'

type PanelState =
  | { status: 'idle' }
  | { status: 'processing'; reelId: string; creator: string }
  | { status: 'done'; reelId: string; creator: string; result: AnalyzeReelResponse; currentMs: number }
  | { status: 'error'; reelId: string; creator: string; message: string }

function Panel() {
  const [state, setState] = useState<PanelState>({ status: 'idle' })

  useEffect(() => {
    const listener = (message: ChromeMessage) => {
      if (message.type === 'REEL_CHANGED') {
        setState(prev => ({
          status: 'processing',
          reelId: message.reelId,
          creator: prev.status !== 'idle' ? prev.creator : '',
        }))
      }
      if (message.type === 'ANALYSIS_STARTED') {
        setState({ status: 'processing', reelId: message.reelId, creator: message.creator })
      }
      if (message.type === 'ANALYSIS_COMPLETE') {
        setState({
          status: 'done',
          reelId: message.reelId,
          creator: message.creator,
          result: message.result,
          currentMs: 0,
        })
      }
      if (message.type === 'ANALYSIS_ERROR') {
        setState(prev => ({
          status: 'error',
          reelId: message.reelId,
          creator: prev.status !== 'idle' ? prev.creator : '',
          message: message.message,
        }))
      }
      if (message.type === 'VIDEO_TIME') {
        setState(prev => prev.status === 'done' ? { ...prev, currentMs: message.currentMs } : prev)
      }
    }

    chrome.runtime.onMessage.addListener(listener)
    return () => chrome.runtime.onMessage.removeListener(listener)
  }, [])

  const statusDot = state.status === 'processing' ? c.amber : state.status === 'done' ? c.accent : c.red

  return (
    <div style={{ minHeight: '100vh', background: c.bg, color: c.text, display: 'flex', flexDirection: 'column' }}>

      {/* ── Header ── */}
      <header style={{
        padding: '11px 14px',
        borderBottom: `1px solid ${c.border}`,
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        background: `linear-gradient(180deg, rgba(6,214,160,0.04) 0%, transparent 100%)`,
        flexShrink: 0,
      }}>
        <div style={{
          width: 28,
          height: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(6,214,160,0.09)',
          border: '1px solid rgba(6,214,160,0.22)',
          borderRadius: 7,
          flexShrink: 0,
        }}>
          <LogoMark />
        </div>
        <span style={{ fontWeight: 700, fontSize: 13, letterSpacing: '-0.01em' }}>
          Reeli<span style={{ color: c.accent }}>able</span>
        </span>

        {state.status !== 'idle' && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: statusDot,
              boxShadow: `0 0 6px ${statusDot}`,
              animation: state.status === 'processing' ? 'pulse-opacity 1.5s ease-in-out infinite' : 'none',
            }} />
            <span style={{
              fontFamily: mono,
              fontSize: 10,
              color: c.muted,
              letterSpacing: '0.04em',
              maxWidth: 110,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {state.creator || 'analyzing...'}
            </span>
          </div>
        )}
      </header>

      {/* ── Main ── */}
      <main style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>

        {state.status === 'idle' && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '64px 24px',
            gap: 14,
            textAlign: 'center',
          }}>
            <div style={{ opacity: 0.25 }}>
              <LogoMark size={40} />
            </div>
            <div>
              <div style={{ color: c.muted, fontSize: 13, marginBottom: 5 }}>No reel detected</div>
              <div style={{ fontFamily: mono, color: c.dim, fontSize: 10, letterSpacing: '0.06em' }}>
                Open an Instagram Reel to begin
              </div>
            </div>
          </div>
        )}

        {state.status === 'processing' && <Spinner />}

        {state.status === 'error' && (
          <div style={{
            background: c.redDim,
            border: `1px solid ${c.red}`,
            borderRadius: 10,
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
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
            <DiscrepanciesSection discrepancies={state.result.discrepancies} currentMs={state.currentMs} />
            <ClaimsSection claims={state.result.claims} currentMs={state.currentMs} />
          </>
        )}

      </main>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Panel />
  </React.StrictMode>,
)
