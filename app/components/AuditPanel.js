'use client'
import { useState, useEffect } from 'react'
import { Check, X, ArrowRight } from 'lucide-react'

const TYPE_META = {
  redundant: { label: 'REDUNDANT', color: '#ef4444' },
  automatable: { label: 'AI CAN HELP', color: '#8b5cf6' },
  missing: { label: 'MISSING TASK', color: '#22c55e' },
  priority: { label: 'PRIORITY', color: '#eab308' },
}

function SuggestionCard({ type, text, onYes, onNo, actioned }) {
  const [removing, setRemoving] = useState(false)
  const [actionLabel, setActionLabel] = useState(null)
  const meta = TYPE_META[type] || TYPE_META.redundant

  const handleAction = (cb, label) => {
    setActionLabel(label)
    cb()
    setTimeout(() => setRemoving(true), 400)
  }

  if (removing) return null

  return (
    <div className={`suggestion-card ${actionLabel ? 'suggestion-card-done' : ''}`}>
      <span className="suggestion-type" style={{ color: meta.color }}>{meta.label}</span>
      <span className="suggestion-text">{text}</span>
      <div className="suggestion-btns">
        {actionLabel ? (
          <span className="suggestion-actioned">{actionLabel}</span>
        ) : (
          <>
            <button className="suggestion-yes" onClick={() => handleAction(onYes, '✓')}><Check size={14} /></button>
            <button className="suggestion-no" onClick={() => handleAction(onNo, '✗')}><X size={14} /></button>
          </>
        )}
      </div>
    </div>
  )
}

export default function AuditSuggestions({ results, onRemoveTask, onAddTask, onSpawnAgent, onApplyPriority, onClear }) {
  const [dismissed, setDismissed] = useState(new Set())

  if (!results) return null
  const { redundant = [], automatable = [], missing = [], priority_adjustments = [] } = results

  const dismiss = (key) => setDismissed(prev => new Set([...prev, key]))

  const allKeys = [
    ...redundant.map((_, i) => `r-${i}`),
    ...automatable.map((_, i) => `a-${i}`),
    ...missing.map((_, i) => `m-${i}`),
    ...priority_adjustments.map((_, i) => `p-${i}`),
  ]

  const visibleCount = allKeys.filter(k => !dismissed.has(k)).length
  if (visibleCount === 0) return null

  return (
    <div className="suggestions-area">
      {redundant.map((r, i) => {
        const key = `r-${i}`
        if (dismissed.has(key)) return null
        return (
          <SuggestionCard
            key={key}
            type="redundant"
            text={`Remove duplicate: ${r.taskTitles?.join(' & ')}`}
            onYes={() => { r.taskIds?.slice(1).forEach(id => onRemoveTask(id)); dismiss(key) }}
            onNo={() => dismiss(key)}
          />
        )
      })}
      {automatable.map((a, i) => {
        const key = `a-${i}`
        if (dismissed.has(key)) return null
        return (
          <SuggestionCard
            key={key}
            type="automatable"
            text={`AI can help: "${a.taskTitle}"`}
            onYes={() => { onSpawnAgent(a); dismiss(key) }}
            onNo={() => dismiss(key)}
          />
        )
      })}
      {missing.map((m, i) => {
        const key = `m-${i}`
        if (dismissed.has(key)) return null
        return (
          <SuggestionCard
            key={key}
            type="missing"
            text={`Add task: "${m.title}"`}
            onYes={() => { onAddTask(m); dismiss(key) }}
            onNo={() => dismiss(key)}
          />
        )
      })}
      {priority_adjustments.map((p, i) => {
        const key = `p-${i}`
        if (dismissed.has(key)) return null
        return (
          <SuggestionCard
            key={key}
            type="priority"
            text={<>Change &quot;{p.taskTitle}&quot; priority: {p.currentPriority} <ArrowRight size={10} style={{ verticalAlign: 'middle' }} /> {p.suggestedPriority}</>}
            onYes={() => { onApplyPriority(p.taskId, p.suggestedPriority); dismiss(key) }}
            onNo={() => dismiss(key)}
          />
        )
      })}
    </div>
  )
}
