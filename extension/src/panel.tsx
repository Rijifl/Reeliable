import React, { useEffect, useMemo, useRef, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { AnalyzeReelResponse, ChromeMessage, Discrepancy, ExtractedClaim, TranscriptEntry } from './types'

type PanelState =
  | { status: 'idle' }
  | { status: 'processing'; reelId: string; creator: string }
  | { status: 'done'; reelId: string; creator: string; result: AnalyzeReelResponse; currentMs: number }
  | { status: 'error'; reelId: string; creator: string; message: string }

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
    let best = 0
    let delta = Number.POSITIVE_INFINITY
    for (let i = 0; i < transcript.length; i++) {
      const d = Math.abs(transcript[i].timestampMs - currentMs)
      if (d < delta) {
        best = i
        delta = d
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
      <h3 style={{ color: c.accent, fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
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
        {transcript.length === 0 && (
          <div style={{ color: c.dim, fontSize: 12 }}>No visible text detected.</div>
        )}
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

function DiscrepanciesSection({
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
        <div style={{ border: `1px solid ${c.border}`, borderRadius: 10, padding: 10, color: c.dim, fontSize: 12 }}>
          No major factual claims detected.
        </div>
      )}
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
            <div style={{ color: c.muted, fontSize: 12, lineHeight: 1.55 }}>{claim.reasoning || 'No reasoning provided.'}</div>
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
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function Panel() {
  const [state, setState] = useState<PanelState>({ status: 'idle' })

  useEffect(() => {
    const listener = (message: ChromeMessage) => {
      if (message.type === 'REEL_CHANGED') {
        setState((prev) => ({
          status: 'processing',
          reelId: message.reelId,
          creator: prev.status === 'idle' ? '' : prev.creator,
        }))
      }

      if (message.type === 'ANALYSIS_STARTED') {
        setState({
          status: 'processing',
          reelId: message.reelId,
          creator: message.creator,
        })
      }

      if (message.type === 'ANALYSIS_COMPLETE') {
        setState((prev) => ({
          status: 'done',
          reelId: message.reelId,
          creator: prev.status === 'idle' ? '' : prev.creator,
          result: message.result,
          currentMs: 0,
        }))
      }

      if (message.type === 'ANALYSIS_ERROR') {
        setState((prev) => ({
          status: 'error',
          reelId: message.reelId,
          creator: prev.status === 'idle' ? '' : prev.creator,
          message: message.message,
        }))
      }

      if (message.type === 'VIDEO_TIME') {
        setState((prev) => (
          prev.status === 'done'
            ? { ...prev, currentMs: message.currentMs }
            : prev
        ))
      }
    }

    chrome.runtime.onMessage.addListener(listener)
    return () => chrome.runtime.onMessage.removeListener(listener)
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: c.bg, color: c.text, display: 'flex', flexDirection: 'column' }}>
      <header style={{
        padding: '14px 16px',
        borderBottom: `1px solid ${c.border}`,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.accent }} />
        <span style={{ fontWeight: 700, fontSize: 15 }}>ReelCheck VLM</span>
        {state.status !== 'idle' && <span style={{ color: c.dim, fontSize: 12, marginLeft: 'auto' }}>{state.creator}</span>}
      </header>

      <main style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {state.status === 'idle' && (
          <div style={{ color: c.dim, fontSize: 13, textAlign: 'center', padding: 40 }}>
            Open an Instagram Reel to start analysis.
          </div>
        )}
        {state.status === 'processing' && <Spinner />}
        {state.status === 'error' && (
          <div style={{ border: `1px solid ${c.red}`, borderRadius: 10, color: '#fecaca', padding: 10, fontSize: 12 }}>
            {state.message}
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
