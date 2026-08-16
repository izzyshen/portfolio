"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { PROJECTS } from "@/lib/projects"

const FONT_OPTIONS = [
  { label: "Afacad", value: "'Afacad', sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Courier", value: "'Courier New', monospace" },
  { label: "Helvetica", value: "'Helvetica Neue', sans-serif" },
]

interface TextBlock { id: string; kind: "text"; html: string }
interface ImageBlock { id: string; kind: "image"; src: string; caption: string }
type ColumnBlock = TextBlock | ImageBlock

interface Column {
  name: string
  blocks: ColumnBlock[]
}

interface CompareContent {
  tag: string
  title: string
  font: string
  summary: string
  columns: [Column, Column]
}

// ── defaults + migration ──────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 8)
const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "untitled"

function titleFromSlug(slug: string) {
  return slug
    .replace(/-\d+$/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, l => l.toUpperCase())
}

function defaultColumn(name: string): Column {
  return { name, blocks: [{ id: uid(), kind: "text", html: "" }] }
}

function defaultContent(slug: string): CompareContent {
  return {
    tag: "project",
    title: titleFromSlug(slug),
    font: "'Afacad', sans-serif",
    summary: "",
    columns: [defaultColumn("Product One"), defaultColumn("Product Two")],
  }
}

/** Reuses the same storage key a plain ProjectTemplate visit would have used,
 *  so a title/tag/font already typed there before this template existed carries over. */
function normalize(raw: unknown, slug: string): CompareContent {
  const base = defaultContent(slug)
  if (!raw || typeof raw !== "object") return base
  const r = raw as Record<string, unknown>

  const cols = Array.isArray(r.columns) && r.columns.length === 2
    ? (r.columns as Column[]).map((c, i) => ({
        name: typeof c?.name === "string" ? c.name : base.columns[i].name,
        blocks: Array.isArray(c?.blocks) ? c.blocks : [],
      }))
    : base.columns

  return {
    tag: typeof r.tag === "string" ? r.tag : base.tag,
    title: typeof r.title === "string" ? r.title : base.title,
    font: typeof r.font === "string" ? r.font : base.font,
    summary: typeof r.summary === "string" ? r.summary : "",
    columns: [cols[0], cols[1]],
  }
}

/** Read the project list the landing page is actually showing. */
function readProjectRail(): { label: string; slug: string }[] {
  const fallback = PROJECTS.map(p => ({ label: p.title, slug: p.slug }))
  try {
    const raw = localStorage.getItem("portfolio-home")
    if (!raw) return fallback
    const home = JSON.parse(raw)
    const sec = home?.sections?.find((s: { isProjects?: boolean }) => s.isProjects)
    if (!sec?.items?.length) return fallback
    return sec.items.map((it: { label: string; slug?: string }) => ({
      label: it.label,
      slug: it.slug ?? slugify(it.label),
    }))
  } catch {
    return fallback
  }
}

// ── editable single line ──────────────────────────────────────────────────────
function EditLine({
  initial, style, onSave,
}: { initial: string; style: React.CSSProperties; onSave: (v: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (ref.current) ref.current.textContent = initial }, [])
  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLElement).blur() } }}
      onBlur={e => onSave(e.currentTarget.textContent ?? "")}
      style={{ outline: "none", cursor: "text", whiteSpace: "pre-wrap", ...style }}
    />
  )
}

// ── text formatting (light / bold / italic / underline / size) ───────────────
// Same mechanism as ProjectTemplate's — see that file for the reasoning behind
// the normalization fix and the exact-match resize-in-place fix.
const LIGHT_COLOR = "#999999"
const BOLD_COLOR = "#111111"

function commonAncestorElement(range: Range): HTMLElement | null {
  let node: Node | null = range.commonAncestorContainer
  if (node.nodeType === Node.TEXT_NODE) node = node.parentElement
  return node as HTMLElement | null
}

function normalizedStyleValue(prop: string, value: string): string {
  const probe = document.createElement("span")
  probe.style.setProperty(prop, value)
  return probe.style.getPropertyValue(prop)
}

function toggleSpanStyle(container: HTMLElement, styles: Record<string, string>) {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return
  const range = sel.getRangeAt(0)
  if (!container.contains(range.commonAncestorContainer)) return

  const el = commonAncestorElement(range)
  const alreadyApplied = !!el && el.tagName === "SPAN" && el.textContent === range.toString()
    && Object.entries(styles).every(([k, v]) => el.style.getPropertyValue(k) === normalizedStyleValue(k, v))

  if (alreadyApplied && el) {
    const parent = el.parentNode!
    while (el.firstChild) parent.insertBefore(el.firstChild, el)
    parent.removeChild(el)
    return
  }

  const span = document.createElement("span")
  Object.entries(styles).forEach(([k, v]) => span.style.setProperty(k, v))
  const frag = range.extractContents()
  span.appendChild(frag)
  range.insertNode(span)
  const newRange = document.createRange()
  newRange.selectNodeContents(span)
  sel.removeAllRanges()
  sel.addRange(newRange)
}

function stepFontSize(container: HTMLElement, delta: number) {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return
  const range = sel.getRangeAt(0)
  if (!container.contains(range.commonAncestorContainer)) return

  const el = commonAncestorElement(range)
  const exactSpan = el && el.tagName === "SPAN" && el.textContent === range.toString() && el.style.fontSize
    ? el
    : null

  const current = parseFloat(getComputedStyle(exactSpan ?? el ?? container).fontSize) || 14
  const next = Math.max(10, Math.min(36, current + delta))

  const span = exactSpan ?? document.createElement("span")
  span.style.setProperty("font-size", `${next}px`)
  if (exactSpan) {
    const newRange = document.createRange()
    newRange.selectNodeContents(span)
    sel.removeAllRanges()
    sel.addRange(newRange)
    return
  }

  const frag = range.extractContents()
  span.appendChild(frag)
  range.insertNode(span)
  const newRange = document.createRange()
  newRange.selectNodeContents(span)
  sel.removeAllRanges()
  sel.addRange(newRange)
}

const formatBtnStyle: React.CSSProperties = {
  background: "none", border: "none", cursor: "pointer",
  color: "#eee", fontSize: 12, padding: "5px 8px", lineHeight: 1,
}

/** Floating toolbar that appears above whatever text is selected inside
 *  `containerRef`, and only then — hidden the rest of the time. */
function FormatToolbar({ containerRef }: { containerRef: React.RefObject<HTMLDivElement | null> }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => {
    const update = () => {
      const container = containerRef.current
      const sel = window.getSelection()
      if (!container || !sel || sel.rangeCount === 0 || sel.isCollapsed) {
        setPos(null)
        return
      }
      const range = sel.getRangeAt(0)
      if (!container.contains(range.commonAncestorContainer)) {
        setPos(null)
        return
      }
      const r = range.getBoundingClientRect()
      if (r.width === 0 && r.height === 0) { setPos(null); return }
      setPos({ top: r.top - 38, left: r.left + r.width / 2 })
    }
    document.addEventListener("selectionchange", update)
    return () => document.removeEventListener("selectionchange", update)
  }, [containerRef])

  if (!pos) return null

  const run = (fn: (el: HTMLElement) => void) => {
    const container = containerRef.current
    if (!container) return
    fn(container)
  }

  return (
    <div
      onMouseDown={e => e.preventDefault()}
      style={{
        position: "fixed", top: pos.top, left: pos.left, transform: "translateX(-50%)",
        display: "flex", alignItems: "center", gap: 2,
        background: "#222", borderRadius: 4, padding: "3px 4px",
        boxShadow: "0 4px 14px rgba(0,0,0,0.18)", zIndex: 200,
      }}
    >
      <button title="Light" style={{ ...formatBtnStyle, color: LIGHT_COLOR }} onClick={() => run(el => toggleSpanStyle(el, { color: LIGHT_COLOR }))}>Aa</button>
      <button title="Bold" style={{ ...formatBtnStyle, fontWeight: 700, color: "#fff" }} onClick={() => run(el => toggleSpanStyle(el, { "font-weight": "700", color: BOLD_COLOR }))}>B</button>
      <button title="Italic" style={{ ...formatBtnStyle, fontStyle: "italic", color: "#fff" }} onClick={() => run(el => toggleSpanStyle(el, { "font-style": "italic" }))}>I</button>
      <button title="Underline" style={{ ...formatBtnStyle, textDecoration: "underline", color: "#fff" }} onClick={() => run(el => toggleSpanStyle(el, { "text-decoration": "underline" }))}>U</button>
      <div style={{ width: 1, height: 14, background: "rgba(255,255,255,0.15)", margin: "0 2px" }} />
      <button title="Smaller" style={{ ...formatBtnStyle, color: "#fff" }} onClick={() => run(el => stepFontSize(el, -2))}>A−</button>
      <button title="Larger" style={{ ...formatBtnStyle, color: "#fff" }} onClick={() => run(el => stepFontSize(el, 2))}>A+</button>
    </div>
  )
}

// ── editable multi-line body ────────────────────────────────────────────────
function makePlaceholder(text: string) {
  return `<span data-ph style="color:#c9c9c9;pointer-events:none">${text}</span>`
}

function EditBody({
  initial, placeholder, style, onSave,
}: { initial: string; placeholder: string; style: React.CSSProperties; onSave: (v: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const empty = useRef(!initial)
  const ph = makePlaceholder(placeholder)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!ref.current) return
    ref.current.innerHTML = initial || ph
  }, [])

  return (
    <>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onFocus={() => {
          if (empty.current && ref.current?.querySelector("[data-ph]")) {
            ref.current.innerHTML = ""
            empty.current = false
          }
        }}
        onBlur={e => {
          const html = e.currentTarget.innerHTML
          empty.current = !html
          if (!html) e.currentTarget.innerHTML = ph
          onSave(html === ph ? "" : html)
        }}
        style={{ outline: "none", cursor: "text", ...style }}
      />
      <FormatToolbar containerRef={ref} />
    </>
  )
}

const overlayBtn: React.CSSProperties = {
  position: "absolute", top: 8, right: 8,
  background: "rgba(255,255,255,0.9)", border: "1px solid #e4e4e4",
  color: "#888", fontSize: 10,
  padding: "4px 8px", cursor: "pointer", letterSpacing: "0.1em",
}

const btnStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid #e2e1dc",
  color: "#aaa",
  fontSize: 9, letterSpacing: "0.16em",
  padding: "5px 12px", cursor: "pointer",
}

// ── one column ─────────────────────────────────────────────────────────────
function ColumnView({
  column, onChange,
}: { column: Column; onChange: (c: Column) => void }) {
  const imgRef = useRef<HTMLInputElement>(null)

  const addImage = (f: File) => {
    const r = new FileReader()
    r.onload = () => {
      const block: ImageBlock = { id: uid(), kind: "image", src: r.result as string, caption: "" }
      onChange({ ...column, blocks: [...column.blocks, block] })
    }
    r.readAsDataURL(f)
  }

  const addText = () => {
    const block: TextBlock = { id: uid(), kind: "text", html: "" }
    onChange({ ...column, blocks: [...column.blocks, block] })
  }

  const updateBlock = (id: string, up: Partial<ColumnBlock>) => {
    onChange({ ...column, blocks: column.blocks.map(b => b.id === id ? { ...b, ...up } as ColumnBlock : b) })
  }

  const deleteBlock = (id: string) => {
    onChange({ ...column, blocks: column.blocks.filter(b => b.id !== id) })
  }

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <EditLine
        initial={column.name}
        style={{ fontSize: 17, color: "#222", letterSpacing: "0.01em", marginBottom: 24 }}
        onSave={v => onChange({ ...column, name: v || column.name })}
      />

      {column.blocks.map(block => (
        <div key={block.id} style={{ marginBottom: 24, position: "relative" }}>
          {block.kind === "text" ? (
            <EditBody
              initial={block.html}
              placeholder="Write something here…"
              style={{ color: "#5c5c5c", fontSize: 14, lineHeight: 1.85, minHeight: 32 }}
              onSave={html => updateBlock(block.id, { html })}
            />
          ) : (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={block.src} alt="" style={{ width: "100%", display: "block" }} />
              <EditLine
                initial={block.caption || "Caption…"}
                style={{ color: "#aaa", fontSize: 11, letterSpacing: "0.04em", marginTop: 8 }}
                onSave={caption => updateBlock(block.id, { caption })}
              />
            </>
          )}
          <button onClick={() => deleteBlock(block.id)} style={overlayBtn}>✕</button>
        </div>
      ))}

      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button onClick={addText} style={btnStyle}>+ TEXT</button>
        <button onClick={() => imgRef.current?.click()} style={btnStyle}>+ IMAGE</button>
        <input
          ref={imgRef} type="file" accept="image/*" style={{ display: "none" }}
          onChange={e => { const f = e.target.files?.[0]; if (f) addImage(f); e.target.value = "" }}
        />
      </div>
    </div>
  )
}

// ── left rail: back + other projects ──────────────────────────────────────────
function ProjectRail({ slug }: { slug: string }) {
  const [rail, setRail] = useState<{ label: string; slug: string }[]>([])
  useEffect(() => { setRail(readProjectRail()) }, [])

  return (
    <nav
      style={{
        position: "fixed", top: 0, left: 0, bottom: 0, width: 210,
        padding: "44px 0 40px 40px",
        display: "flex", flexDirection: "column", gap: 22,
        borderRight: "1px solid #eceae5",
        background: "#f7f6f3",
      }}
    >
      <Link
        href="/"
        style={{
          color: "#333", fontSize: 12, letterSpacing: "0.18em",
          textTransform: "uppercase", textDecoration: "none",
        }}
      >
        ← Back
      </Link>

      <div style={{ display: "flex", flexDirection: "column", gap: 13, marginTop: 12 }}>
        {rail.map(p => {
          const current = p.slug === slug
          return (
            <Link
              key={p.slug}
              href={`/projects/${p.slug}`}
              title={p.label}
              style={{
                fontSize: 14,
                color: current ? "#1a1a1a" : "#b6b4ae",
                textDecoration: "none",
                transition: "color 0.15s",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}
              onMouseEnter={e => { if (!current) e.currentTarget.style.color = "#666" }}
              onMouseLeave={e => { if (!current) e.currentTarget.style.color = "#b6b4ae" }}
            >
              {p.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

// ── main ──────────────────────────────────────────────────────────────────────
export default function ProductCompareTemplate({ slug }: { slug: string }) {
  const storageKey = `portfolio-project-${slug}`
  const [content, setContent] = useState<CompareContent | null>(null)
  const [savedMsg, setSavedMsg] = useState(false)
  const [undoneMsg, setUndoneMsg] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Cmd/Ctrl+Z undo history — every change (edits, deletions, everything)
  // pushes the PRE-change snapshot here first, so undo always has somewhere
  // to go back to. Capped so it can't grow unbounded in a long session.
  const UNDO_LIMIT = 50
  const undoStack = useRef<CompareContent[]>([])
  const pushUndo = (snapshot: CompareContent) => {
    undoStack.current.push(snapshot)
    if (undoStack.current.length > UNDO_LIMIT) undoStack.current.shift()
  }

  useEffect(() => {
    const load = () => {
      try {
        const raw = localStorage.getItem(storageKey)
        setContent(normalize(raw ? JSON.parse(raw) : null, slug))
      } catch {
        setContent(defaultContent(slug))
      }
    }
    load()
    // re-sync after a back-forward-cache restore (see ProjectTemplate for why)
    const onPageShow = (e: PageTransitionEvent) => { if (e.persisted) load() }
    window.addEventListener("pageshow", onPageShow)
    return () => window.removeEventListener("pageshow", onPageShow)
  }, [storageKey, slug])

  const persist = (next: CompareContent) => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      localStorage.setItem(storageKey, JSON.stringify(next))
      setSavedMsg(true)
      setTimeout(() => setSavedMsg(false), 1200)
    }, 500)
  }

  const patch = (updates: Partial<CompareContent>) => {
    setContent(prev => {
      if (!prev) return prev
      pushUndo(prev)
      const next = { ...prev, ...updates }
      persist(next)
      return next
    })
  }

  // reads the sibling column from `prev`, not the outer closure, so two
  // near-simultaneous edits (one per column) can never clobber each other
  const patchColumn = (index: 0 | 1, column: Column) => {
    setContent(prev => {
      if (!prev) return prev
      pushUndo(prev)
      const columns: [Column, Column] = [...prev.columns]
      columns[index] = column
      const next = { ...prev, columns }
      persist(next)
      return next
    })
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isUndo = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !e.shiftKey
      if (!isUndo) return
      // typing inside a text field: let the browser's own native undo run
      // (undoing a keystroke, not rolling back the whole page's content)
      const active = document.activeElement
      const isEditingText = active instanceof HTMLElement &&
        (active.isContentEditable || active.tagName === "INPUT" || active.tagName === "TEXTAREA")
      if (isEditingText) return

      if (undoStack.current.length === 0) return
      e.preventDefault()
      const restored = undoStack.current.pop()!
      setContent(restored)
      persist(restored)
      setUndoneMsg(true)
      setTimeout(() => setUndoneMsg(false), 1200)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  if (!content) return <div style={{ background: "#f7f6f3", minHeight: "100vh" }} />

  return (
    <main style={{ minHeight: "100vh", background: "#f7f6f3", color: "#111", fontFamily: content.font }}>
      <ProjectRail slug={slug} />

      <div style={{ maxWidth: 900, marginLeft: 300, marginRight: 40, padding: "80px 0 140px" }}>

        {/* tag + font picker */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <EditLine
            initial={`// ${content.tag}`}
            style={{ color: "#bbb", fontSize: 10, letterSpacing: "0.18em", fontFamily: "monospace" }}
            onSave={v => patch({ tag: v.replace(/^\/\/\s*/, "") || "project" })}
          />
          <select
            value={content.font}
            onChange={e => patch({ font: e.target.value })}
            style={{
              background: "transparent", border: "none", borderBottom: "1px solid #e2e1dc",
              color: "#aaa", fontSize: 10, padding: "2px 4px", cursor: "pointer", outline: "none",
            }}
          >
            {FONT_OPTIONS.map(f => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>

        {/* title */}
        <EditLine
          initial={content.title}
          style={{ fontSize: 30, fontWeight: 400, letterSpacing: "0.02em", color: "#111", marginBottom: 20 }}
          onSave={v => patch({ title: v || content.title })}
        />

        {/* summary bar */}
        <EditBody
          initial={content.summary}
          placeholder="Add a product summary…"
          style={{
            fontSize: 15, color: "#555", lineHeight: 1.6,
            paddingBottom: 20, marginBottom: 48,
            borderBottom: "1px solid #ebe9e4",
          }}
          onSave={html => patch({ summary: html })}
        />

        {/* two products, split down the middle */}
        <div style={{ display: "flex", alignItems: "stretch" }}>
          <ColumnView
            column={content.columns[0]}
            onChange={c => patchColumn(0, c)}
          />
          <div style={{ width: 1, background: "#e2e1dc", margin: "0 40px", flexShrink: 0 }} />
          <ColumnView
            column={content.columns[1]}
            onChange={c => patchColumn(1, c)}
          />
        </div>
      </div>

      {savedMsg && (
        <div style={{ position: "fixed", bottom: 28, right: 32, color: "#c4c2bc", fontSize: 9, letterSpacing: "0.2em", pointerEvents: "none" }}>
          SAVED
        </div>
      )}
      {undoneMsg && (
        <div style={{ position: "fixed", bottom: 28, right: 32, color: "#a08c5c", fontSize: 9, letterSpacing: "0.2em", pointerEvents: "none" }}>
          UNDONE — ⌘Z AGAIN FOR MORE
        </div>
      )}
    </main>
  )
}
