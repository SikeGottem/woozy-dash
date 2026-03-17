// Normalize task data from SQLite API

export function normalizeTask(t) {
  const categoryMap = { freelance: 'work', product: 'work' }
  const rawCategory = t.category || t.project_type || 'personal'
  
  return {
    ...t,
    text: t.text || t.title || '',
    section: t.section || '',
    subsection: t.subsection || '',
    category: categoryMap[rawCategory] || rawCategory,
    status: t.status || 'todo',
    energy_required: t.energy_required || 'medium',
    parent_id: t.parent_id || null,
    blocked_reason: t.blocked_reason || null,
    actual_minutes: t.actual_minutes || null,
    estimated_minutes: t.estimated_minutes || null,
    context: t.context || null,
    completed_by: t.completed_by || null,
    subtasks: (t.subtasks || []).map(normalizeTask),
  }
}

export function normalizeTasks(tasks) {
  return (tasks || []).map(normalizeTask)
}
