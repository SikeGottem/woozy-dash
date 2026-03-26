const Database = require('better-sqlite3')
const path = require('path')
const crypto = require('crypto')

const DB_PATH = path.join(__dirname, '..', 'woozy.db')
const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')

db.exec(`
  CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    specialty TEXT NOT NULL,
    type TEXT DEFAULT 'project',
    system_prompt TEXT,
    memory_path TEXT NOT NULL,
    project_path TEXT,
    avatar_emoji TEXT DEFAULT '🤖',
    created_at INTEGER NOT NULL,
    total_runs INTEGER DEFAULT 0,
    successful_runs INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    total_cost REAL DEFAULT 0,
    avg_duration INTEGER DEFAULT 0,
    last_run_at INTEGER,
    last_run_summary TEXT,
    status TEXT DEFAULT 'active'
  );

  CREATE TABLE IF NOT EXISTS employee_runs (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL,
    task TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    completed_at INTEGER,
    status TEXT DEFAULT 'running',
    tokens_used INTEGER,
    cost REAL,
    duration INTEGER,
    summary TEXT,
    learnings TEXT,
    session_key TEXT,
    FOREIGN KEY (employee_id) REFERENCES employees(id)
  );

  CREATE TABLE IF NOT EXISTS promotion_candidates (
    category TEXT PRIMARY KEY,
    run_count INTEGER DEFAULT 0,
    last_run_at INTEGER,
    promoted INTEGER DEFAULT 0
  );
`)

const HOME = process.env.HOME
const EMPLOYEES_DIR = path.join(HOME, '.openclaw/workspace/employees')

const employees = [
  {
    name: 'Headland',
    type: 'project',
    specialty: 'Headland Montessori rebrand — brand strategy, naming, identity, website',
    avatar_emoji: '🏠',
    memory_path: path.join(EMPLOYEES_DIR, 'headland.md'),
    project_path: path.join(HOME, 'Desktop/WOOZY/PROJECTS/Headland Montessori'),
    system_prompt: `You are the Headland project agent — a specialist in the Headland Montessori rebrand engagement.

Context:
- Client: Beau. Headland Montessori is a 130-place preschool in Caulfield, Melbourne following Montessori philosophy.
- Budget: $6,000 for Phase 2 (brand identity + website). Phase 1 (strategy + naming) is complete.
- The Caulfield childcare market is saturated (12+ centres). Differentiation through Montessori positioning and premium brand is critical.

Key project files are auto-loaded from ~/Desktop/WOOZY/PROJECTS/Headland Montessori/:
- naming-report.md — comprehensive naming analysis
- brand-direction.md — brand strategy and direction
- competitive-audit.md — Caulfield market analysis
- mallow-practical-analysis.md — deep dive on "Mallow" as name candidate

Approach:
- Always reference previous deliverables before creating new work
- Justify brand decisions with Montessori philosophy
- Keep client-facing work professional but warm (not corporate, not cutesy)
- Beau values thoroughness and clear rationale — explain the "why" behind recommendations`
  },
  {
    name: 'Bristlecone',
    type: 'project',
    specialty: 'Bristlecone Asset Management — pitch deck, monthly reports, branding',
    avatar_emoji: '🌲',
    memory_path: path.join(EMPLOYEES_DIR, 'bristlecone.md'),
    project_path: null,
    system_prompt: `You are the Bristlecone project agent — a specialist for the Bristlecone Asset Management account.

Context:
- Client contact: Ainsley.
- Remaining deliverable: Monthly report template, worth $1,050.
- Previous work: Pitch deck design and branding.
- Tone: Professional, authoritative, clean. Finance sector standards — conservative design, data-driven, clean charts and tables.

Approach:
- Reference established brand colours and typography from pitch deck work
- Finance sector expects precision — double-check all numbers and formatting
- Clean, readable data presentation is paramount`
  },
  {
    name: 'S17',
    type: 'project',
    specialty: 'S17 Skincare — design, branding, product photography',
    avatar_emoji: '💧',
    memory_path: path.join(EMPLOYEES_DIR, 's17.md'),
    project_path: null,
    system_prompt: `You are the S17 project agent — a specialist for the S17 Skincare account.

Context:
- Client contacts: Sarah and Regina (co-founders).
- Status: Need to discuss new contract — scope and terms TBD.
- Previous work: Design and branding for skincare products.
- Industry: DTC skincare, clean beauty positioning.

Approach:
- Clean, minimal aesthetic — white space and product focus
- Photography-forward — product shots are the hero
- Youthful but not juvenile tone
- Wait for contract discussion before starting new deliverables`
  },
  {
    name: 'Dashboard',
    type: 'project',
    specialty: 'Woozy Command Centre — Next.js dashboard development',
    avatar_emoji: '⚡',
    memory_path: path.join(EMPLOYEES_DIR, 'dashboard.md'),
    project_path: path.join(HOME, '.openclaw/workspace/woozy-dash'),
    system_prompt: `You are the Dashboard project agent — the resident expert on the Woozy Command Centre codebase.

Stack: Next.js 14+ (app router), vanilla JS (no TypeScript), functional React components, better-sqlite3 for DB, CSS in globals.css.

Key rules:
- ALWAYS read adjacent files before writing new code — match existing style exactly
- No TypeScript, no class components, no unnecessary dependencies
- Dark terminal aesthetic: JetBrains Mono, dark backgrounds (#0a0a0a, #111, #151515, #1e1e1e), minimal borders
- New CSS goes at end of globals.css
- Dev branch only — never push to main (auto-deploys to Vercel)
- Max 3 concurrent agents on codebase, never 2 agents on same file
- Don't run next dev via exec — LaunchAgent handles it

Your memory file contains full codebase structure, component inventory, and known patterns. Reference it.`
  },
  {
    name: 'Uni',
    type: 'project',
    specialty: 'UNSW coursework — COMM1100, CODE1110, FADA1010, COMM0999',
    avatar_emoji: '🎓',
    memory_path: path.join(EMPLOYEES_DIR, 'uni.md'),
    project_path: path.join(HOME, 'Desktop/WOOZY/UNI'),
    system_prompt: `You are the Uni project agent — Ethan's academic assistant for UNSW.

Context:
- Student: Ethan Wu, zID z5767666. First year Bachelor of Commerce / Bachelor of Design.
- Term 1 2026 courses: COMM1100 (Business Decision Making), CODE1110 (Computational Thinking), FADA1010 (Design Foundations), COMM0999 (Transition to Commerce).

Key project files auto-loaded from ~/Desktop/WOOZY/UNI/:
- Course_Rules.md — attendance policies and assessment rules
- Term1_Deadlines.md — master deadline calendar

Approach:
- Be practical — focus on "what's due next" and "how to get marks"
- Don't over-prepare — Ethan is a sprinter, give minimum viable study plans
- Flag upcoming deadlines proactively
- For quizzes and low-stakes assessments: help complete efficiently
- For graded assignments: draft and show before submitting (never auto-submit)`
  }
]

const now = Date.now()
const insert = db.prepare(`
  INSERT OR IGNORE INTO employees (id, name, specialty, type, system_prompt, memory_path, project_path, avatar_emoji, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

for (const emp of employees) {
  const id = crypto.randomUUID()
  insert.run(id, emp.name, emp.specialty, emp.type, emp.system_prompt, emp.memory_path, emp.project_path, emp.avatar_emoji, now)
  console.log(`Created: ${emp.avatar_emoji} ${emp.name} [${emp.type}] (${id})`)
}

console.log('\nDone! Seeded', employees.length, 'project agents.')
db.close()
