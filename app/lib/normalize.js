// Normalize task data from SQLite API
// The DB returns `title`, frontend expects `text`
// section/subsection may be undefined

export function normalizeTask(t) {
  return {
    ...t,
    text: t.text || t.title || '',
    section: t.section || '',
    subsection: t.subsection || '',
    category: t.category || t.project_type || 'personal',
    status: t.status || '',
  }
}

export function normalizeTasks(tasks) {
  return (tasks || []).map(normalizeTask)
}
