// Verdict card — shows status, summary, and sources
import React, { useState } from 'react'
import { Verdict } from '../types'

const STATUS_COLOR: Record<Verdict['status'], string> = {
  supported: '#22c55e',
  contradicted: '#ef4444',
  partially_true: '#eab308',
  unverified: '#94a3b8',
}

const STATUS_LABEL: Record<Verdict['status'], string> = {
  supported: '✓ Supported',
  contradicted: '✗ Contradicted',
  partially_true: '~ Partially True',
  unverified: '? Unverified',
}

interface Props {
  verdict: Verdict
}

export default function FactCheckCard({ verdict }: Props) {
  const [expanded, setExpanded] = useState(false)
  const color = STATUS_COLOR[verdict.status]

  return (
    <div style={{
      background: '#12121a',
      border: `1.5px solid ${color}`,
      borderRadius: 10,
      padding: '10px 14px',
      maxWidth: 280,
      boxShadow: `0 0 16px ${color}33`,
      fontFamily: 'system-ui, sans-serif',
      color: '#e2e8f0',
    }}>
      <div style={{ color, fontWeight: 700, fontSize: 12, marginBottom: 4 }}>
        {STATUS_LABEL[verdict.status]}
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.5, color: '#94a3b8' }}>
        {verdict.summary}
      </div>

      {verdict.sources.length > 0 && (
        <button
          onClick={() => setExpanded((e) => !e)}
          style={{ background: 'none', border: 'none', color, cursor: 'pointer', fontSize: 11, marginTop: 6, padding: 0 }}
        >
          {expanded ? '▲ Hide sources' : `▼ ${verdict.sources.length} source(s)`}
        </button>
      )}

      {expanded && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {verdict.sources.map((s, i) => (
            <a
              key={i}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 11, color: '#6366f1', textDecoration: 'none' }}
            >
              [{s.sourceName}] {s.title}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
