import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const VAULT_ROOT = path.join(process.env.HOME, 'Desktop', 'WOOZY')
const SKIP = new Set(['node_modules', '.git', 'skills', '.obsidian', '.trash'])

function buildTree(dir, relativePath = '') {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
    .filter(e => !SKIP.has(e.name) && !e.name.startsWith('.'))
    .sort((a, b) => {
      // folders first, then alpha
      if (a.isDirectory() && !b.isDirectory()) return -1
      if (!a.isDirectory() && b.isDirectory()) return 1
      return a.name.localeCompare(b.name)
    })

  return entries.map(e => {
    const rel = path.join(relativePath, e.name)
    if (e.isDirectory()) {
      return { name: e.name, path: rel, type: 'dir', children: buildTree(path.join(dir, e.name), rel) }
    }
    if (e.name.endsWith('.md')) {
      return { name: e.name, path: rel, type: 'file' }
    }
    return null
  }).filter(Boolean)
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const filePath = searchParams.get('file')
  const query = searchParams.get('q')

  // Read a specific file
  if (filePath) {
    const abs = path.join(VAULT_ROOT, filePath)
    if (!abs.startsWith(VAULT_ROOT)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    try {
      const content = fs.readFileSync(abs, 'utf-8')
      return NextResponse.json({ content, path: filePath })
    } catch {
      return NextResponse.json({ error: 'not found' }, { status: 404 })
    }
  }

  // Search
  if (query) {
    const results = []
    const q = query.toLowerCase()
    function search(dir, rel) {
      const entries = fs.readdirSync(dir, { withFileTypes: true }).filter(e => !SKIP.has(e.name) && !e.name.startsWith('.'))
      for (const e of entries) {
        const r = path.join(rel, e.name)
        if (e.isDirectory()) { search(path.join(dir, e.name), r) }
        else if (e.name.endsWith('.md')) {
          if (e.name.toLowerCase().includes(q)) {
            results.push({ name: e.name, path: r, type: 'file', match: 'name' })
          } else {
            try {
              const content = fs.readFileSync(path.join(dir, e.name), 'utf-8')
              if (content.toLowerCase().includes(q)) {
                const idx = content.toLowerCase().indexOf(q)
                const snippet = content.slice(Math.max(0, idx - 40), idx + q.length + 40).replace(/\n/g, ' ')
                results.push({ name: e.name, path: r, type: 'file', match: 'content', snippet })
              }
            } catch {}
          }
        }
        if (results.length >= 50) return
      }
    }
    search(VAULT_ROOT, '')
    return NextResponse.json({ results })
  }

  // Return full tree
  const tree = buildTree(VAULT_ROOT)
  return NextResponse.json({ tree })
}
