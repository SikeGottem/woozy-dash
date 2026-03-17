import { NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

const UPLOAD_DIR = join(process.cwd(), 'public/uploads')
const MAX_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
const ALLOWED_FILE_TYPES = [...ALLOWED_IMAGE_TYPES, 'application/pdf', 'text/plain', 'text/markdown']

function getExt(mime) {
  const map = {
    'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif',
    'image/webp': '.webp', 'image/svg+xml': '.svg',
    'application/pdf': '.pdf', 'text/plain': '.txt', 'text/markdown': '.md'
  }
  return map[mime] || '.bin'
}

export async function POST(request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    if (file.size > MAX_SIZE) return NextResponse.json({ error: 'File too large (10MB max)' }, { status: 413 })
    if (!ALLOWED_FILE_TYPES.includes(file.type)) return NextResponse.json({ error: `Type not allowed: ${file.type}` }, { status: 415 })

    if (!existsSync(UPLOAD_DIR)) await mkdir(UPLOAD_DIR, { recursive: true })

    const ext = getExt(file.type)
    const rand = Math.random().toString(36).slice(2, 8)
    const filename = `${Date.now()}-${rand}${ext}`
    const filepath = join(UPLOAD_DIR, filename)

    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(filepath, buffer)

    const isImage = ALLOWED_IMAGE_TYPES.includes(file.type)
    return NextResponse.json({
      url: `/uploads/${filename}`,
      filename: file.name || filename,
      size: file.size,
      type: file.type,
      isImage
    })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
