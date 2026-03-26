'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import NavBar from '../components/NavBar'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { FileText, Rocket, Leaf, GraduationCap, Archive, Settings, BookOpen, CheckCircle, Inbox, ChevronDown, ChevronRight, ChevronLeft, Folder, FolderOpen, Pin } from 'lucide-react'

// ─── Folder Tree Item ───
function TreeNode({ node, depth = 0, selectedPath, onSelect }) {
  const [open, setOpen] = useState(depth === 0)

  if (node.type === 'file') {
    return (
      <div
        className={`vault-tree-file ${selectedPath === node.path ? 'vault-tree-active' : ''}`}
        style={{ paddingLeft: `${depth * 16 + 12}px` }}
        onClick={() => onSelect(node.path)}
      >
        <span className="vault-tree-icon"><FileText size={13} /></span>
        {node.name.replace('.md', '')}
      </div>
    )
  }

  const folderIcons = { PROJECTS: <Rocket size={13} />, LIFE: <Leaf size={13} />, UNI: <GraduationCap size={13} />, ARCHIVE: <Archive size={13} />, SYSTEM: <Settings size={13} />, RESOURCES: <BookOpen size={13} /> }

  return (
    <div>
      <div
        className="vault-tree-folder"
        style={{ paddingLeft: `${depth * 16 + 12}px` }}
        onClick={() => setOpen(!open)}
      >
        <span className="vault-tree-chevron">{open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</span>
        <span className="vault-tree-icon">{folderIcons[node.name] || <Folder size={13} />}</span>
        {node.name}
        <span className="vault-tree-count">{node.children?.length || 0}</span>
      </div>
      {open && node.children?.map(child => (
        <TreeNode key={child.path} node={child} depth={depth + 1} selectedPath={selectedPath} onSelect={onSelect} />
      ))}
    </div>
  )
}

export default function VaultPage() {
  const [tree, setTree] = useState([])
  const [selectedPath, setSelectedPath] = useState(null)
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const searchTimeout = useRef(null)

  // Load tree
  useEffect(() => {
    fetch('/api/vault').then(r => r.json()).then(d => setTree(d.tree || []))
  }, [])

  // Load file
  const selectFile = useCallback(async (filePath) => {
    setSelectedPath(filePath)
    setLoading(true)
    setSearchResults(null)
    setSearchQuery('')
    try {
      const r = await fetch(`/api/vault?file=${encodeURIComponent(filePath)}`)
      const d = await r.json()
      setContent(d.content || '')
    } catch { setContent('Failed to load file.') }
    setLoading(false)
  }, [])

  // Search
  const handleSearch = (q) => {
    setSearchQuery(q)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    if (!q.trim()) { setSearchResults(null); return }
    searchTimeout.current = setTimeout(async () => {
      const r = await fetch(`/api/vault?q=${encodeURIComponent(q)}`)
      const d = await r.json()
      setSearchResults(d.results || [])
    }, 300)
  }

  // Separate pinned files and folders
  const pinned = tree.filter(n => n.type === 'file' && (n.name === 'TASKS.md' || n.name === 'INBOX.md'))
  const folders = tree.filter(n => n.type === 'dir')
  const otherFiles = tree.filter(n => n.type === 'file' && n.name !== 'TASKS.md' && n.name !== 'INBOX.md')

  return (
    <div className="vault-layout">
      <NavBar />
      
      {/* Sidebar */}
      <div className={`vault-sidebar ${sidebarOpen ? '' : 'vault-sidebar-collapsed'}`}>
        <div className="vault-sidebar-header">
          <span className="vault-sidebar-title">VAULT</span>
          <button className="vault-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
          </button>
        </div>

        {sidebarOpen && (
          <>
            {/* Search */}
            <div className="vault-search">
              <input
                type="text"
                placeholder="Search vault..."
                value={searchQuery}
                onChange={e => handleSearch(e.target.value)}
                className="vault-search-input"
              />
            </div>

            {/* Search results */}
            {searchResults ? (
              <div className="vault-search-results">
                <div className="vault-section-label">
                  {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
                </div>
                {searchResults.map(r => (
                  <div key={r.path} className="vault-tree-file" onClick={() => selectFile(r.path)}>
                    <span className="vault-tree-icon"><FileText size={13} /></span>
                    <div>
                      <div>{r.name.replace('.md', '')}</div>
                      {r.snippet && <div className="vault-snippet">...{r.snippet}...</div>}
                      <div className="vault-file-path">{r.path}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="vault-tree">
                {/* Pinned */}
                {pinned.length > 0 && (
                  <>
                    <div className="vault-section-label"><Pin size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />PINNED</div>
                    {pinned.map(n => (
                      <div
                        key={n.path}
                        className={`vault-tree-file vault-pinned ${selectedPath === n.path ? 'vault-tree-active' : ''}`}
                        onClick={() => selectFile(n.path)}
                      >
                        <span className="vault-tree-icon">{n.name === 'TASKS.md' ? <CheckCircle size={13} /> : <Inbox size={13} />}</span>
                        {n.name.replace('.md', '')}
                      </div>
                    ))}
                  </>
                )}

                {/* Folders */}
                <div className="vault-section-label" style={{ marginTop: '12px' }}>FOLDERS</div>
                {folders.map(n => (
                  <TreeNode key={n.path} node={n} selectedPath={selectedPath} onSelect={selectFile} />
                ))}

                {/* Other root files */}
                {otherFiles.length > 0 && (
                  <>
                    <div className="vault-section-label" style={{ marginTop: '12px' }}>FILES</div>
                    {otherFiles.map(n => (
                      <div
                        key={n.path}
                        className={`vault-tree-file ${selectedPath === n.path ? 'vault-tree-active' : ''}`}
                        onClick={() => selectFile(n.path)}
                      >
                        <span className="vault-tree-icon"><FileText size={13} /></span>
                        {n.name.replace('.md', '')}
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Content */}
      <div className={`vault-content ${sidebarOpen ? '' : 'vault-content-expanded'}`}>
        {loading ? (
          <div className="vault-empty">Loading...</div>
        ) : selectedPath ? (
          <div className="vault-markdown">
            <div className="vault-content-header">
              <span className="vault-breadcrumb">{selectedPath}</span>
            </div>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        ) : (
          <div className="vault-empty">
            <div className="vault-empty-icon"><FolderOpen size={32} /></div>
            <div>Select a file from the sidebar</div>
            <div className="vault-empty-hint">or search for something</div>
          </div>
        )}
      </div>
    </div>
  )
}
