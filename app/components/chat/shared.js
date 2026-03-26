'use client'
import { useState, useEffect } from 'react'
import { FileText, X } from 'lucide-react'

// === SHARED UTILITIES ===

export function formatRelativeTime(timestamp) {
  const now = Date.now()
  const diff = Math.floor((now - timestamp) / 1000)
  
  if (diff < 60) return 'now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return new Date(timestamp).toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })
}

export function truncateText(text, maxLength = 50) {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - 3) + '...'
}

export async function uploadFile(file) {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch('/api/upload', { method: 'POST', body: formData })
  if (!res.ok) { 
    const data = await res.json()
    throw new Error(data.error || 'Upload failed') 
  }
  return res.json()
}

// === MEDIA DETECTION HELPERS ===

const IMAGE_EXT_RE = /\.(jpg|jpeg|png|gif|webp|svg)(\?[^\s]*)?$/i
const AUDIO_EXT_RE = /\.(mp3|wav|ogg|m4a|aac)(\?[^\s]*)?$/i
const MEDIA_LINE_RE = /^MEDIA:\s*(.+)$/gm
const MD_IMAGE_RE = /!\[([^\]]*)\]\(([^)]+)\)/g
const RAW_URL_RE = /(?:^|\s)(https?:\/\/[^\s]+)/g
const UPLOAD_PATH_RE = /\/uploads\/[^\s]+/g

export function extractMediaElements(text) {
  const elements = []
  const processedRanges = []

  // Extract MEDIA: lines
  let match
  while ((match = MEDIA_LINE_RE.exec(text)) !== null) {
    const path = match[1].trim()
    if (IMAGE_EXT_RE.test(path) || path.startsWith('data:image/')) {
      elements.push({ type: 'image', src: path, start: match.index, end: match.index + match[0].length })
    } else if (AUDIO_EXT_RE.test(path)) {
      elements.push({ type: 'audio', src: path, start: match.index, end: match.index + match[0].length })
    }
    processedRanges.push([match.index, match.index + match[0].length])
  }

  // Extract markdown images
  MD_IMAGE_RE.lastIndex = 0
  while ((match = MD_IMAGE_RE.exec(text)) !== null) {
    if (!isInRange(match.index, processedRanges)) {
      elements.push({ type: 'image', src: match[2], alt: match[1], start: match.index, end: match.index + match[0].length })
      processedRanges.push([match.index, match.index + match[0].length])
    }
  }

  // Extract raw image/audio URLs
  RAW_URL_RE.lastIndex = 0
  while ((match = RAW_URL_RE.exec(text)) !== null) {
    const url = match[1]
    if (!isInRange(match.index, processedRanges)) {
      if (IMAGE_EXT_RE.test(url)) {
        elements.push({ type: 'image', src: url, start: match.index, end: match.index + match[0].length })
        processedRanges.push([match.index, match.index + match[0].length])
      } else if (AUDIO_EXT_RE.test(url)) {
        elements.push({ type: 'audio', src: url, start: match.index, end: match.index + match[0].length })
        processedRanges.push([match.index, match.index + match[0].length])
      }
    }
  }

  // Extract /uploads/ paths
  UPLOAD_PATH_RE.lastIndex = 0
  while ((match = UPLOAD_PATH_RE.exec(text)) !== null) {
    if (!isInRange(match.index, processedRanges)) {
      const path = match[0]
      if (IMAGE_EXT_RE.test(path)) {
        elements.push({ type: 'image', src: path, start: match.index, end: match.index + match[0].length })
      } else if (AUDIO_EXT_RE.test(path)) {
        elements.push({ type: 'audio', src: path, start: match.index, end: match.index + match[0].length })
      } else {
        elements.push({ type: 'file', url: path, filename: path.split('/').pop(), start: match.index, end: match.index + match[0].length })
      }
      processedRanges.push([match.index, match.index + match[0].length])
    }
  }

  return elements
}

function isInRange(index, ranges) {
  return ranges.some(([start, end]) => index >= start && index < end)
}

export function stripMediaFromText(text, elements) {
  let result = text
  const sorted = [...elements].sort((a, b) => b.start - a.start)
  for (const el of sorted) {
    result = result.slice(0, el.start) + result.slice(el.end)
  }
  return result.trim()
}

// === SHARED COMPONENTS ===

export function CodeBlock({ content, stylePrefix = 'wchat' }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <div className={`${stylePrefix}-code-block-wrapper`}>
      <button className={`${stylePrefix}-code-copy`} onClick={handleCopy}>
        {copied ? 'copied' : 'copy'}
      </button>
      <pre className={`${stylePrefix}-code-block`}><code>{content}</code></pre>
    </div>
  )
}

export function Lightbox({ src, alt, onClose, stylePrefix = 'wchat' }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])
  return (
    <div className={`${stylePrefix}-lightbox`} onClick={onClose}>
      <img src={src} alt={alt || ''} className={`${stylePrefix}-lightbox-img`} onClick={e => e.stopPropagation()} />
      <button className={`${stylePrefix}-lightbox-close`} onClick={onClose}><X size={18} /></button>
    </div>
  )
}

export function ImageComponent({ src, alt, stylePrefix = 'wchat' }) {
  const [lightbox, setLightbox] = useState(false)
  return (
    <>
      <div className={`${stylePrefix}-image-container`} onClick={() => setLightbox(true)}>
        <img src={src} alt={alt || ''} className={`${stylePrefix}-image`} loading="lazy" />
      </div>
      {lightbox && <Lightbox src={src} alt={alt} onClose={() => setLightbox(false)} stylePrefix={stylePrefix} />}
    </>
  )
}

export function AudioComponent({ src, stylePrefix = 'wchat' }) {
  return (
    <div className={`${stylePrefix}-audio-container`}>
      <audio controls src={src} className={`${stylePrefix}-audio`} preload="metadata" />
    </div>
  )
}

export function FileCard({ filename, size, url, stylePrefix = 'wchat' }) {
  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes}B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={`${stylePrefix}-file-card`}>
      <span className={`${stylePrefix}-file-icon`}><FileText size={13} /></span>
      <span className={`${stylePrefix}-file-info`}>
        <span className={`${stylePrefix}-file-name`}>{filename}</span>
        {size && <span className={`${stylePrefix}-file-size`}>{formatSize(size)}</span>}
      </span>
    </a>
  )
}

// === MARKDOWN RENDERER ===

export function MarkdownRenderer({ content, stylePrefix = 'wchat' }) {
  // Extract artifacts first
  const artifactRegex = /```artifact-html(?:\s+title="([^"]*)")?\s*\n([\s\S]*?)```/g
  const artifacts = []
  let match
  while ((match = artifactRegex.exec(content)) !== null) {
    artifacts.push({
      title: match[1] || 'Untitled',
      content: match[2].trim(),
      start: match.index,
      end: match.index + match[0].length
    })
  }

  // Remove artifacts from content for markdown processing
  let markdownContent = content
  const sortedArtifacts = [...artifacts].sort((a, b) => b.start - a.start)
  for (const artifact of sortedArtifacts) {
    markdownContent = markdownContent.slice(0, artifact.start) + markdownContent.slice(artifact.end)
  }

  const parseMarkdown = (text) => {
    const lines = text.split('\n')
    const elements = []
    let inCodeBlock = false
    let currentCodeBlock = []
    let currentList = []

    const flushCodeBlock = () => {
      if (currentCodeBlock.length > 0) {
        elements.push({ type: 'code-block', content: currentCodeBlock.join('\n'), key: `code-${elements.length}` })
        currentCodeBlock = []
      }
    }

    const flushList = () => {
      if (currentList.length > 0) {
        elements.push({ type: 'list', items: currentList, key: `list-${elements.length}` })
        currentList = []
      }
    }

    lines.forEach((line) => {
      if (line.startsWith('```')) {
        if (inCodeBlock) { flushCodeBlock(); inCodeBlock = false } else { flushList(); inCodeBlock = true }
        return
      }
      if (inCodeBlock) { currentCodeBlock.push(line); return }
      if (line.startsWith('## ')) { flushList(); elements.push({ type: 'heading', level: 2, content: line.slice(3).trim(), key: `h2-${elements.length}` }); return }
      if (line.startsWith('### ')) { flushList(); elements.push({ type: 'heading', level: 3, content: line.slice(4).trim(), key: `h3-${elements.length}` }); return }
      if (line.match(/^[-*•] /)) { currentList.push(parseBoldAndInlineCode(line.replace(/^[-*•] /, '').trim())); return }
      if (line.trim()) { flushList(); elements.push({ type: 'paragraph', content: parseBoldAndInlineCode(line), key: `p-${elements.length}` }) }
      else if (elements.length > 0) { elements.push({ type: 'spacing', key: `space-${elements.length}` }) }
    })
    flushCodeBlock()
    flushList()
    return elements
  }

  const parseBoldAndInlineCode = (text) => {
    const parts = []
    let remaining = text
    let key = 0
    const patterns = [
      { regex: /\*\*(.*?)\*\*/g, type: 'bold' },
      { regex: /`(.*?)`/g, type: 'code' },
      { regex: /https?:\/\/[^\s]+/g, type: 'link' }
    ]

    while (remaining.length > 0) {
      let earliestMatch = null, earliestIndex = Infinity, matchedPattern = null
      patterns.forEach(pattern => {
        pattern.regex.lastIndex = 0
        const match = pattern.regex.exec(remaining)
        if (match && match.index < earliestIndex) { earliestMatch = match; earliestIndex = match.index; matchedPattern = pattern }
      })
      if (!earliestMatch) { if (remaining.trim()) parts.push({ type: 'text', content: remaining, key: `text-${key++}` }); break }
      if (earliestIndex > 0) { const beforeText = remaining.slice(0, earliestIndex); if (beforeText.trim()) parts.push({ type: 'text', content: beforeText, key: `text-${key++}` }) }
      if (matchedPattern.type === 'link') { parts.push({ type: 'link', content: earliestMatch[0], href: earliestMatch[0], key: `link-${key++}` }) }
      else { parts.push({ type: matchedPattern.type, content: earliestMatch[1], key: `${matchedPattern.type}-${key++}` }) }
      remaining = remaining.slice(earliestMatch.index + earliestMatch[0].length)
    }
    return parts
  }

  const renderInlineElements = (elements) => {
    if (typeof elements === 'string') return elements
    return elements.map(element => {
      switch (element.type) {
        case 'bold': return <strong key={element.key}>{element.content}</strong>
        case 'code': return <code key={element.key} className={`${stylePrefix}-inline-code`}>{element.content}</code>
        case 'link': return <a key={element.key} href={element.href} className={`${stylePrefix}-link`} target="_blank" rel="noopener noreferrer">{element.content}</a>
        default: return element.content
      }
    })
  }

  const renderElement = (element) => {
    switch (element.type) {
      case 'heading': { const Tag = `h${element.level}`; return <Tag key={element.key} className={`${stylePrefix}-heading ${stylePrefix}-heading-${element.level}`}>{element.content}</Tag> }
      case 'code-block': return <CodeBlock key={element.key} content={element.content} stylePrefix={stylePrefix} />
      case 'list': return <ul key={element.key} className={`${stylePrefix}-list`}>{element.items.map((item, i) => <li key={`item-${i}`} className={`${stylePrefix}-list-item`}>{renderInlineElements(item)}</li>)}</ul>
      case 'paragraph': return <div key={element.key} className={`${stylePrefix}-paragraph`}>{renderInlineElements(element.content)}</div>
      case 'spacing': return <div key={element.key} className={`${stylePrefix}-spacing`} />
      default: return null
    }
  }

  return (
    <div className={`${stylePrefix}-markdown`}>
      {parseMarkdown(markdownContent).map(renderElement)}
      {/* Artifacts would go here if needed */}
    </div>
  )
}

export function RichContent({ content, stylePrefix = 'wchat' }) {
  const mediaElements = extractMediaElements(content)
  const cleanText = stripMediaFromText(content, mediaElements)

  return (
    <>
      {cleanText && <MarkdownRenderer content={cleanText} stylePrefix={stylePrefix} />}
      {mediaElements.map((el, i) => {
        if (el.type === 'image') return <ImageComponent key={`media-${i}`} src={el.src} alt={el.alt} stylePrefix={stylePrefix} />
        if (el.type === 'audio') return <AudioComponent key={`media-${i}`} src={el.src} stylePrefix={stylePrefix} />
        if (el.type === 'file') return <FileCard key={`media-${i}`} filename={el.filename} url={el.url} stylePrefix={stylePrefix} />
        return null
      })}
    </>
  )
}

// === ATTACHMENT PREVIEW ===
export function AttachmentPreview({ attachments, onRemove, stylePrefix = 'wchat' }) {
  if (!attachments.length) return null
  return (
    <div className={`${stylePrefix}-attachment-strip`}>
      {attachments.map((att, i) => (
        <div key={i} className={`${stylePrefix}-attachment-preview`}>
          {att.isImage
            ? <img src={att.dataUrl || att.url} alt={att.filename} className={`${stylePrefix}-attachment-thumb`} />
            : <div className={`${stylePrefix}-attachment-file-thumb`}><FileText size={13} /></div>
          }
          <span className={`${stylePrefix}-attachment-name`}>{att.filename}</span>
          <button className={`${stylePrefix}-attachment-remove`} onClick={() => onRemove(i)}><X size={12} /></button>
        </div>
      ))}
    </div>
  )
}