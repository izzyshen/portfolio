"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"

interface ReadingItem {
  id: string
  title: string
  url: string
}

interface ArticleContent {
  title: string
  body: string
  readings: ReadingItem[]
}

// ── defaults ──────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 8)

function titleFromSlug(slug: string) {
  return slug
    .replace(/-\d+$/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, l => l.toUpperCase())
}

function defaultContent(slug: string): ArticleContent {
  return { title: titleFromSlug(slug), body: "", readings: [] }
}

function normalize(raw: unknown, slug: string): ArticleContent {
  const base = defaultContent(slug)
  if (!raw || typeof raw !== "object") return base
  const r = raw as Record<string, unknown>
  return {
    title: typeof r.title === "string" ? r.title : base.title,
    body: typeof r.body === "string" ? r.body : "",
    readings: Array.isArray(r.readings) ? (r.readings as ReadingItem[]) : [],
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
const PLACEHOLDER = '<span data-ph style="color:#c2c2bc;pointer-events:none">Start writing…</span>'

function EditBody({
  initial, style, onSave,
}: { initial: string; style: React.CSSProperties; onSave: (v: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const empty = useRef(!initial)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!ref.current) return
    ref.current.innerHTML = initial || PLACEHOLDER
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
          if (!html) e.currentTarget.innerHTML = PLACEHOLDER
          onSave(html === PLACEHOLDER ? "" : html)
        }}
        style={{ outline: "none", cursor: "text", ...style }}
      />
      <FormatToolbar containerRef={ref} />
    </>
  )
}

// ── one reading row ────────────────────────────────────────────────────────
function ReadingRow({
  item, onDelete, onSave,
}: { item: ReadingItem; onDelete: () => void; onSave: (title: string) => void }) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: "1px solid #ebe9e4" }}
    >
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        title={item.url}
        style={{ color: "#aaa", fontSize: 12, flexShrink: 0, textDecoration: "none" }}
      >
        →
      </a>
      <EditLine
        initial={item.title}
        onSave={onSave}
        style={{ fontSize: 13, color: "#333", letterSpacing: "0.01em", flex: 1 }}
      />
      <span style={{ fontSize: 11, color: "#c2c0ba", flexShrink: 0, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {item.url.replace(/^https?:\/\//, "")}
      </span>
      <button
        onClick={onDelete}
        title="delete"
        style={{
          opacity: hov ? 1 : 0, transition: "opacity 0.12s",
          background: "none", border: "none",
          color: "#bbb", fontSize: 14, cursor: "pointer", padding: "0 2px", lineHeight: 1, flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  )
}

const btnStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid #e2e1dc",
  color: "#aaa",
  fontSize: 9, letterSpacing: "0.16em",
  padding: "6px 14px", cursor: "pointer",
}

const fieldStyle: React.CSSProperties = {
  flex: 1, background: "#fff", border: "1px solid #e2e1dc",
  color: "#333", fontSize: 12, padding: "6px 10px", outline: "none",
}

function AddReadingRow({ onAdd }: { onAdd: (title: string, url: string) => void }) {
  const [title, setTitle] = useState("")
  const [url, setUrl] = useState("")

  const submit = () => {
    if (!url.trim()) return
    onAdd(title.trim() || url.trim(), url.trim())
    setTitle("")
    setUrl("")
  }

  return (
    <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
      <input
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Title"
        style={{ ...fieldStyle, flex: "0 0 220px" }}
      />
      <input
        value={url}
        onChange={e => setUrl(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") submit() }}
        placeholder="https://…"
        style={fieldStyle}
      />
      <button onClick={submit} style={btnStyle}>ADD</button>
    </div>
  )
}

// ── main ──────────────────────────────────────────────────────────────────────
export default function ArticleTemplate({ slug }: { slug: string }) {
  const storageKey = `portfolio-article-${slug}`
  const [content, setContent] = useState<ArticleContent | null>(null)
  const [savedMsg, setSavedMsg] = useState(false)
  const [undoneMsg, setUndoneMsg] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Cmd/Ctrl+Z undo history — every change pushes the PRE-change snapshot
  // here first, so undo always has somewhere to go back to. Capped so it
  // can't grow unbounded in a long session.
  const UNDO_LIMIT = 50
  const undoStack = useRef<ArticleContent[]>([])
  const pushUndo = (snapshot: ArticleContent) => {
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

  // the debounce below means a save can be up to 500ms behind the latest
  // edit — pendingRef always holds that latest value so it can be flushed
  // immediately (bypassing the debounce) the instant the tab is hidden or
  // closed, so a quick close right after typing can never lose that edit
  const pendingRef = useRef<ArticleContent | null>(null)

  const persist = (next: ArticleContent) => {
    pendingRef.current = next
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      localStorage.setItem(storageKey, JSON.stringify(next))
      pendingRef.current = null
      setSavedMsg(true)
      setTimeout(() => setSavedMsg(false), 1200)
    }, 500)
  }

  useEffect(() => {
    const flush = () => {
      if (!pendingRef.current) return
      clearTimeout(timer.current)
      localStorage.setItem(storageKey, JSON.stringify(pendingRef.current))
      pendingRef.current = null
    }
    const onVisibilityChange = () => { if (document.visibilityState === "hidden") flush() }
    window.addEventListener("pagehide", flush)
    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => {
      window.removeEventListener("pagehide", flush)
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [storageKey])

  const patch = (updates: Partial<ArticleContent>) => {
    setContent(prev => {
      if (!prev) return prev
      pushUndo(prev)
      const next = { ...prev, ...updates }
      persist(next)
      return next
    })
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isUndo = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !e.shiftKey
      if (!isUndo) return
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
    <main style={{ minHeight: "100vh", background: "#f7f6f3", color: "#111", fontFamily: "'Afacad', sans-serif" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "64px 40px 140px" }}>

        <Link
          href="/"
          style={{ display: "inline-block", marginBottom: 48, color: "#999", fontSize: 12, letterSpacing: "0.15em", textTransform: "uppercase", textDecoration: "none" }}
        >
          ← Back
        </Link>

        <EditLine
          initial={content.title}
          style={{ fontSize: 28, fontWeight: 400, letterSpacing: "0.02em", color: "#111", marginBottom: 36 }}
          onSave={v => patch({ title: v || content.title })}
        />

        <EditBody
          initial={content.body}
          style={{ color: "#444", fontSize: 15, lineHeight: 1.95, minHeight: 240, marginBottom: 64 }}
          onSave={html => patch({ body: html })}
        />

        <div>
          <p style={{
            margin: "0 0 14px", fontSize: 10, color: "#b0aea8",
            letterSpacing: "0.15em", textTransform: "uppercase",
            paddingBottom: 8, borderBottom: "1px solid #ebe9e4",
          }}>
            Appendix — inspirational readings
          </p>

          {content.readings.map((r, i) => (
            <ReadingRow
              key={r.id}
              item={r}
              onDelete={() => patch({ readings: content.readings.filter((_, j) => j !== i) })}
              onSave={title => patch({ readings: content.readings.map((it, j) => j === i ? { ...it, title } : it) })}
            />
          ))}

          <AddReadingRow
            onAdd={(title, url) => patch({ readings: [...content.readings, { id: uid(), title, url }] })}
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
