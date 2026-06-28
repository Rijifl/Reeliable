// Shared UI for the analysis surfaces (side panel + in-page overlay).
// Both render the same green-themed Transcript / Discrepancies / Claims views;
// per-surface differences (overlay is smaller) are passed as props.
//
// CSS animations referenced here (spin, spin-reverse, pulse-opacity, fade-up)
// must be defined by each host: panel.html for the side panel, and the
// shadow-root <style> (SHADOW_STYLES) in overlay.tsx for the overlay.
import React, { useEffect, useMemo, useRef } from 'react'
import { Discrepancy, ExtractedClaim, TranscriptEntry, Verdict } from './types'

export const c = {
  bg: '#040a0e',
  surface: '#0a1520',
  card: '#0d1b28',
  border: '#152030',
  borderActive: 'rgba(6,214,160,0.32)',
  accent: '#06d6a0',
  accentDim: 'rgba(6,214,160,0.09)',
  accentGlow: 'rgba(6,214,160,0.22)',
  amber: '#f4a261',
  amberDim: 'rgba(244,162,97,0.10)',
  red: '#e63946',
  redDim: 'rgba(230,57,70,0.10)',
  text: '#dff2f0',
  muted: '#5a8a99',
  dim: '#1e3545',
}

export const mono = "'IBM Plex Mono', monospace"

export function formatMs(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(total / 60)
  const s = String(total % 60).padStart(2, '0')
  return `${m}:${s}`
}

export function severityConfig(severity: Discrepancy['severity']) {
  if (severity === 'high')   return { color: c.red,   bg: c.redDim,   label: 'HIGH RISK' }
  if (severity === 'medium') return { color: c.amber, bg: c.amberDim, label: 'MEDIUM' }
  return { color: c.muted, bg: 'rgba(90,138,153,0.07)', label: 'LOW' }
}

export function LogoMark({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M10 1.5L2.5 5.5v9l7.5 4 7.5-4v-9L10 1.5z" stroke="#06d6a0" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M7 10.5l2 2 4-4" stroke="#06d6a0" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function SectionLabel({ children, color = c.accent, count }: { children: React.ReactNode; color?: string; count?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <span style={{
        fontFamily: mono,
        fontSize: 9,
        letterSpacing: '0.14em',
        textTransform: 'uppercase' as const,
        color,
      }}>{children}</span>
      {count !== undefined && (
        <span style={{ fontFamily: mono, fontSize: 9, color: c.dim, letterSpacing: '0.06em' }}>
          · {count}
        </span>
      )}
    </div>
  )
}

export function TranscriptSection({ transcript, currentMs, minHeight = 180, maxHeight = 280 }: {
  transcript: TranscriptEntry[]
  currentMs: number
  minHeight?: number
  maxHeight?: number
}) {
  const activeIndex = useMemo(() => {
    if (transcript.length === 0) return -1
    let best = 0
    let delta = Infinity
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
        minHeight,
        maxHeight,
        overflowY: 'auto',
        border: `1px solid ${c.border}`,
        borderRadius: 10,
        background: c.surface,
        padding: '6px 4px',
      }}>
        {transcript.length === 0 ? (
          <div style={{ color: c.dim, fontSize: 11, padding: '8px 8px', fontFamily: mono, letterSpacing: '0.04em' }}>
            no_transcript_data
          </div>
        ) : (
          transcript.map((entry, i) => {
            const active = i === activeIndex
            return (
              <div
                key={`${entry.timestampMs}-${i}`}
                ref={el => { refs.current[i] = el }}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '42px 1fr',
                  gap: 8,
                  padding: '5px 6px',
                  borderRadius: 6,
                  background: active ? c.accentDim : 'transparent',
                  borderLeft: `2px solid ${active ? c.accent : 'transparent'}`,
                  transition: 'all 0.2s ease',
                  marginBottom: 2,
                }}
              >
                <span style={{
                  fontFamily: mono,
                  color: active ? c.accent : c.dim,
                  fontSize: 10,
                  lineHeight: 1.6,
                  transition: 'color 0.2s ease',
                }}>{formatMs(entry.timestampMs)}</span>
                <span style={{
                  color: active ? c.text : c.muted,
                  fontSize: 12,
                  lineHeight: 1.55,
                  transition: 'color 0.2s ease',
                }}>{entry.text}</span>
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}

export function DiscrepanciesSection({ discrepancies, currentMs }: { discrepancies: Discrepancy[]; currentMs: number }) {
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
                <span style={{ fontFamily: mono, fontSize: 9, color: c.dim, letterSpacing: '0.06em' }}>
                  {formatMs(item.frameTimestampMs)}
                </span>
              </div>
              <div style={{ color: c.text, fontSize: 12, lineHeight: 1.55 }}>{item.description}</div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function verdictConfig(status: Verdict['status']) {
  if (status === 'supported')      return { color: c.accent, label: 'SUPPORTED' }
  if (status === 'contradicted')   return { color: c.red,    label: 'CONTRADICTED' }
  if (status === 'partially_true') return { color: c.amber,  label: 'PARTIALLY TRUE' }
  return { color: c.muted, label: 'UNVERIFIED' }
}

function VerdictView({ verdict }: { verdict: Verdict }) {
  const cfg = verdictConfig(verdict.status)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, borderTop: `1px solid ${c.border}`, paddingTop: 9, marginTop: 2 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{
          fontFamily: mono, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
          color: cfg.color, border: `1px solid ${cfg.color}`, borderRadius: 4, padding: '1px 6px',
        }}>{cfg.label}</span>
        <span style={{ fontFamily: mono, fontSize: 8, color: c.dim, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>
          web-checked
        </span>
      </div>
      <div style={{ color: c.text, fontSize: 11, lineHeight: 1.55 }}>{verdict.summary}</div>
      {verdict.sources.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {verdict.sources.map((s, i) => (
            <a
              key={i}
              href={s.url}
              target="_blank"
              rel="noreferrer noopener"
              style={{ color: c.accent, fontSize: 10, lineHeight: 1.4, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >↗ {s.title}</a>
          ))}
        </div>
      )}
    </div>
  )
}

export function ClaimsSection({ claims, currentMs }: { claims: ExtractedClaim[]; currentMs: number }) {
  return (
    <section>
      <SectionLabel count={claims.length}>Claims</SectionLabel>
      {claims.length === 0 && (
        <div style={{
          border: `1px solid ${c.border}`,
          borderRadius: 10,
          padding: '12px 14px',
          color: c.dim,
          fontSize: 11,
          fontFamily: mono,
          letterSpacing: '0.03em',
        }}>
          no_claims_detected
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {claims.map((claim, idx) => {
          const reached = claim.timestampMs <= currentMs
          return (
            <article key={claim.id} style={{
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
              boxShadow: reached ? `0 0 18px rgba(6,214,160,0.055)` : 'none',
              animation: 'fade-up 0.3s ease forwards',
              animationDelay: `${idx * 55}ms`,
              animationFillMode: 'both',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ color: c.text, fontSize: 13, fontWeight: 600, lineHeight: 1.45, flex: 1 }}>
                  {claim.text}
                </div>
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
                    <span key={i} style={{
                      color: c.muted,
                      fontSize: 11,
                      lineHeight: 1.4,
                      paddingLeft: 8,
                      borderLeft: `1px solid ${c.dim}`,
                    }}>{src}</span>
                  ))}
                </div>
              )}

              {claim.verdict && <VerdictView verdict={claim.verdict} />}
            </article>
          )
        })}
      </div>
    </section>
  )
}

export function Spinner({ compact = false }: { compact?: boolean }) {
  const ring = compact ? 28 : 44
  const inner = compact ? 5 : 7
  const label = (
    <div style={{ textAlign: compact ? 'left' : 'center' }}>
      <div style={{ color: c.text, fontSize: compact ? 12 : 13, fontWeight: 600, marginBottom: compact ? 0 : 5 }}>Analyzing Reel</div>
      <div style={{ fontFamily: mono, color: c.muted, fontSize: 10, letterSpacing: '0.06em', animation: 'pulse-opacity 2s ease-in-out infinite' }}>
        VLM pipeline running...
      </div>
    </div>
  )
  return (
    <div style={compact
      ? { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 2px' }
      : { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '48px 0' }}>
      <div style={{ position: 'relative', width: ring, height: ring, flexShrink: 0 }}>
        <div style={{
          position: 'absolute', inset: 0,
          border: `2px solid ${c.border}`,
          borderTop: `2px solid ${c.accent}`,
          borderRadius: '50%',
          animation: 'spin 0.9s linear infinite',
        }} />
        <div style={{
          position: 'absolute', inset: inner,
          border: `1px solid ${c.dim}`,
          borderBottom: `1px solid ${c.accent}`,
          borderRadius: '50%',
          animation: 'spin-reverse 1.5s linear infinite',
          opacity: 0.5,
        }} />
      </div>
      {label}
    </div>
  )
}
