// Listens for verdicts from content.ts and renders verdict cards
import React, { useEffect, useState } from 'react'
import { SSEEvent, Verdict } from '../types'
import FactCheckCard from './FactCheckCard'

export default function App() {
  const [verdicts, setVerdicts] = useState<Verdict[]>([])

  useEffect(() => {
    const handler = (e: Event) => {
      const event = (e as CustomEvent<SSEEvent>).detail
      if (event.type === 'verdict') {
        setVerdicts((prev) => {
          const exists = prev.find((v) => v.claimId === event.verdict.claimId)
          if (exists) return prev.map((v) => v.claimId === event.verdict.claimId ? event.verdict : v)
          return [...prev, event.verdict]
        })
      }
      if (event.type === 'no_claims') {
        setVerdicts([])
      }
    }

    window.addEventListener('reelcheck:event', handler)
    return () => window.removeEventListener('reelcheck:event', handler)
  }, [])

  if (verdicts.length === 0) return null

  return (
    <div style={{ position: 'fixed', bottom: 80, right: 16, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'auto' }}>
      {verdicts.map((v) => (
        <FactCheckCard key={v.claimId} verdict={v} />
      ))}
    </div>
  )
}
