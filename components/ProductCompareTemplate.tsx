"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { PROJECTS } from "@/lib/projects"
import {
  useMediaSrc,
  storeImageFile,
  migrateDataUrl,
  pruneOrphanedMedia,
} from "@/lib/mediaStore"

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
  /** true once the one-time Smartlead content recovery has run, so it never
   *  overwrites a later deliberate edit or re-deletion of that same column */
  restoredSmartlead?: boolean
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

// ── one-time content recovery ─────────────────────────────────────────────
// The Smartlead column's text was accidentally deleted and had no backup —
// reconstructed as best as possible from a screenshot the user shared right
// before it happened. Runs once (see restoredSmartlead): if that column is
// still empty, this fills it back in; if the user has since retyped
// something else there, it's left alone and just marked handled.
const SMARTLEAD_RESTORE_HTML =
  '<div>completed product design&amp;engineer, launched</div>' +
  '<div><br></div>' +
  '<div>The Design:</div>' +
  '<div>Important Feature 1: Location Auto Selection</div>' +
  '<div>Before: one ad group was bound to a single destination (Website, 1P Form, or DM). Advertisers had to judge for themselves which path performed better, and in practice a given advertiser usually only ever used one.</div>' +
  '<div><br></div>' +
  '<div>After: Under the Leads goal, Optimization Location supports multi-select by default; the delivery system automatically picks the best path/component based on user preference.</div>' +
  '<div><br></div>' +
  '<div>Results: advv +24%, daily revenue increased from $4k to $39k</div>' +
  '<div><br></div>' +
  '<div>Search Design:</div>' +
  '<div><br></div>' +
  '<div><span style="font-weight: 700; color: rgb(17, 17, 17);">a) Use query intent analysis to make location selection more accurate</span></div>' +
  '<div>Use query embeddings to understand user intent and serve ads across a more diverse set of ad locations.</div>' +
  '<div><span style="font-style: italic;">Example:</span> 28 y/o &middot; female &middot; New York &middot; interest tags include "wedding dress, wedding ring" searches "wedding photography New York pricing"</div>' +
  '<div>The model receives (user, query="wedding photography New York pricing", ad)</div>' +
  '<div><br></div>' +
  '<div style="color: rgb(153,153,153); font-size: 12px;">— reconstructed from a screenshot after an accidental deletion; anything below this point in the original could not be recovered</div>'

function restoreSmartleadIfNeeded(content: CompareContent, slug: string): CompareContent {
  if (slug !== "ai-commercial-product" || content.restoredSmartlead) return content
  const [first, second] = content.columns
  // the default column always has one placeholder block with empty html —
  // that still counts as "nothing written here yet", not "has content"
  const hasRealContent = second.blocks.some(b => b.kind === "image" || b.html.trim())
  if (hasRealContent) return { ...content, restoredSmartlead: true }
  const block: TextBlock = { id: `restore-${Date.now()}`, kind: "text", html: SMARTLEAD_RESTORE_HTML }
  return {
    ...content,
    columns: [first, { ...second, blocks: [block] }],
    restoredSmartlead: true,
  }
}

/** Reuses the same storage key a plain ProjectTemplate visit would have used,
 *  so a title/tag/font already typed there before this template existed carries over. */
function normalize(raw: unknown, slug: string): CompareContent {
  const base = defaultContent(slug)
  if (!raw || typeof raw !== "object") return restoreSmartleadIfNeeded(base, slug)
  const r = raw as Record<string, unknown>

  const cols = Array.isArray(r.columns) && r.columns.length === 2
    ? (r.columns as Column[]).map((c, i) => ({
        name: typeof c?.name === "string" ? c.name : base.columns[i].name,
        blocks: Array.isArray(c?.blocks) ? c.blocks : [],
      }))
    : base.columns

  return restoreSmartleadIfNeeded({
    tag: typeof r.tag === "string" ? r.tag : base.tag,
    title: typeof r.title === "string" ? r.title : base.title,
    font: typeof r.font === "string" ? r.font : base.font,
    summary: typeof r.summary === "string" ? r.summary : "",
    columns: [cols[0], cols[1]],
    restoredSmartlead: r.restoredSmartlead === true,
  }, slug)
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

/** True only if EVERY bit of visible text in the range already carries all of
 *  `styles` (via some ancestor within the range). A selection that only
 *  partially overlaps existing formatting — e.g. it includes a trailing
 *  space, or spans across a boundary — counts as "not fully applied", so the
 *  button applies rather than removes, matching how Docs/Notion handle a
 *  mixed selection. */
function selectionFullyHasStyle(range: Range, styles: Record<string, string>): boolean {
  // walk the LIVE dom, not a clone: Range.cloneContents() drops the wrapping
  // ancestor entirely when start/end sit inside a single text node (the
  // common case — e.g. the selection is exactly one already-formatted
  // span's full text), which made this always report "not styled" for
  // exactly the selections a toggle-off needs to recognize
  const root = range.commonAncestorContainer
  const scanRoot = root.nodeType === Node.TEXT_NODE ? root.parentNode! : root
  const walker = document.createTreeWalker(scanRoot, NodeFilter.SHOW_TEXT)
  let sawText = false
  let node: Node | null
  while ((node = walker.nextNode())) {
    if (!range.intersectsNode(node)) continue
    if (!node.textContent || !node.textContent.trim()) continue
    sawText = true
    const hasAll = Object.entries(styles).every(([prop, target]) => {
      let el: HTMLElement | null = node!.parentElement
      while (el) {
        if (el.style?.getPropertyValue(prop) === target) return true
        el = el.parentElement
      }
      return false
    })
    if (!hasAll) return false
  }
  return sawText
}

/** Removes spans that ended up with no text at all — debris left behind when
 *  extractContents() splits a partially-overlapped ancestor. */
function pruneEmptySpans(root: ParentNode) {
  root.querySelectorAll("span").forEach(el => {
    if (!el.hasChildNodes() && !el.textContent) el.remove()
  })
}

/** Range.extractContents()/insertNode() only clone a wrapping ancestor into
 *  the fragment when the range's boundary is a TEXT NODE partway through it.
 *  If a boundary is the ELEMENT itself instead — e.g. from
 *  `range.selectNodeContents(span)`, which is exactly what re-selecting an
 *  already-formatted span for a second toggle produces — extraction pulls
 *  out only the bare children, leaves the (now-empty) span behind live in
 *  the DOM, and insertNode() puts the content right back inside that same
 *  surviving span: a silent no-op that looks like "toggle off did nothing".
 *  Real browsers can also produce element-boundary selections in some cases
 *  (not just this app's own re-selection code), so this isn't just a test
 *  artifact — normalizing to text-node boundaries first avoids it entirely. */
function textBoundary(container: Node, offset: number, atEnd: boolean): [Node, number] {
  if (container.nodeType === Node.TEXT_NODE) return [container, offset]
  const children = container.childNodes
  if (children.length === 0) return [container, offset]
  const idx = atEnd ? Math.max(0, offset - 1) : Math.min(offset, children.length - 1)
  const child = children[idx]
  if (child.nodeType === Node.TEXT_NODE) {
    return atEnd ? [child, (child as Text).length] : [child, 0]
  }
  const walker = document.createTreeWalker(child, NodeFilter.SHOW_TEXT)
  if (atEnd) {
    let last: Text | null = null
    let n: Node | null
    while ((n = walker.nextNode())) last = n as Text
    return last ? [last, last.length] : [container, offset]
  }
  const first = walker.nextNode() as Text | null
  return first ? [first, 0] : [container, offset]
}

function normalizeRangeToText(range: Range): Range {
  const [startNode, startOffset] = textBoundary(range.startContainer, range.startOffset, false)
  const [endNode, endOffset] = textBoundary(range.endContainer, range.endOffset, true)
  const r = document.createRange()
  r.setStart(startNode, startOffset)
  r.setEnd(endNode, endOffset)
  return r
}

/** Strips `styles` from every LIVE element in `container` that carries them
 *  AND is entirely inside `range` (checked via proper Range boundary
 *  comparison, not text-node walking). Unwraps an element left with no
 *  inline style at all. This never goes through extractContents()/
 *  insertNode() — deliberately: that pairing only clones a wrapping
 *  ancestor into the extracted fragment when the range's start and end
 *  containers DIFFER. Whenever a selection sits entirely within one text
 *  node — which is exactly what "re-select the word you just formatted"
 *  produces — start and end are the SAME node, no ancestor gets cloned, the
 *  styled span is left behind live and empty, and the extracted (unstyled)
 *  text gets reinserted right back inside that same span: a silent no-op
 *  that looks like the toggle button does nothing. Modifying the real
 *  elements in place sidesteps that extractContents quirk entirely. */
function stripStyleInPlace(range: Range, container: HTMLElement, styles: Record<string, string>) {
  const candidates: HTMLElement[] = []
  container.querySelectorAll<HTMLElement>("*").forEach(el => {
    const hasAny = Object.entries(styles).some(([k, v]) => el.style?.getPropertyValue(k) === v)
    if (!hasAny) return
    // compareBoundaryPoints gives unreliable results comparing a text-node
    // boundary against an element/child-index boundary (the two ranges here
    // would otherwise be built differently) — normalize both to text-node
    // boundaries first so the comparison is apples-to-apples
    const elRange = normalizeRangeToText((() => {
      const r = document.createRange()
      r.selectNodeContents(el)
      return r
    })())
    const contained = range.compareBoundaryPoints(Range.START_TO_START, elRange) <= 0
      && range.compareBoundaryPoints(Range.END_TO_END, elRange) >= 0
    if (contained) candidates.push(el)
  })
  candidates.forEach(el => {
    Object.keys(styles).forEach(k => el.style.removeProperty(k))
    if (!el.getAttribute("style")) {
      const parent = el.parentNode
      if (!parent) return
      while (el.firstChild) parent.insertBefore(el.firstChild, el)
      parent.removeChild(el)
    }
  })
}

function toggleSpanStyle(container: HTMLElement, rawStyles: Record<string, string>) {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return
  const range = normalizeRangeToText(sel.getRangeAt(0))
  if (!container.contains(range.commonAncestorContainer)) return

  const styles = Object.fromEntries(
    Object.entries(rawStyles).map(([k, v]) => [k, normalizedStyleValue(k, v)])
  )
  const startNode = range.startContainer
  const startOffset = range.startOffset
  const endNode = range.endContainer
  const endOffset = range.endOffset

  if (selectionFullyHasStyle(range, styles)) {
    stripStyleInPlace(range, container, styles)
    pruneEmptySpans(container)
    // the text nodes themselves survive unwrapping (only their parent
    // changes), so the original boundary references are still valid
    const newRange = document.createRange()
    newRange.setStart(startNode, startOffset)
    newRange.setEnd(endNode, endOffset)
    sel.removeAllRanges()
    sel.addRange(newRange)
    return
  }

  const span = document.createElement("span")
  Object.entries(styles).forEach(([k, v]) => span.style.setProperty(k, v))
  const frag = range.extractContents()
  span.appendChild(frag)
  range.insertNode(span)
  pruneEmptySpans(container)
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
/** Resolves an `idb:` ref to a displayable blob URL; plain URLs pass through. */
function BlockImage({ src }: { src: string }) {
  const resolved = useMediaSrc(src)
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={resolved} alt="" style={{ width: "100%", display: "block" }} />
}

function ColumnView({
  column, onChange,
}: { column: Column; onChange: (c: Column) => void }) {
  const imgRef = useRef<HTMLInputElement>(null)

  // stored in IndexedDB, with only an `idb:` ref kept in localStorage — see
  // lib/mediaStore for why base64-in-localStorage ran out of room
  const addImage = (f: File) => {
    storeImageFile(f).then(src => {
      const block: ImageBlock = { id: uid(), kind: "image", src, caption: "" }
      onChange({ ...column, blocks: [...column.blocks, block] })
    })
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
              <BlockImage src={block.src} />
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
  const [saveError, setSaveError] = useState(false)
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

  // the debounce below means a save can be up to 500ms behind the latest
  // edit — pendingRef always holds that latest value so it can be flushed
  // immediately (bypassing the debounce) the instant the tab is hidden or
  // closed, so a quick close right after typing can never lose that edit
  const pendingRef = useRef<CompareContent | null>(null)

  const writeNow = async (next: CompareContent): Promise<boolean> => {
    const payload = JSON.stringify(next)
    const attempt = () => {
      localStorage.setItem(storageKey, payload)
      pendingRef.current = null
      setSaveError(false)
      setSavedMsg(true)
      setTimeout(() => setSavedMsg(false), 1200)
    }
    try {
      attempt()
      return true
    } catch {
      // quota exceeded — reclaim unreferenced media and retry once before
      // giving up (this used to throw uncaught and silently lose the edit)
      try {
        await pruneOrphanedMedia()
        attempt()
        return true
      } catch {
        setSaveError(true)
        return false
      }
    }
  }

  const persist = (next: CompareContent) => {
    pendingRef.current = next
    clearTimeout(timer.current)
    timer.current = setTimeout(() => { void writeNow(next) }, 500)
  }

  useEffect(() => {
    const flush = () => {
      if (!pendingRef.current) return
      clearTimeout(timer.current)
      try {
        localStorage.setItem(storageKey, JSON.stringify(pendingRef.current))
        pendingRef.current = null
      } catch {
        // quota exceeded at unload time — nothing more we can do here
      }
    }
    const onVisibilityChange = () => { if (document.visibilityState === "hidden") flush() }
    window.addEventListener("pagehide", flush)
    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => {
      window.removeEventListener("pagehide", flush)
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [storageKey])

  // one-time upgrade of legacy inline base64 into IndexedDB (see ProjectTemplate)
  const migratedRef = useRef(false)
  useEffect(() => {
    if (!content || migratedRef.current) return
    migratedRef.current = true
    ;(async () => {
      let changed = false
      const columns = await Promise.all(content.columns.map(async col => {
        const blocks = await Promise.all(col.blocks.map(async b => {
          if (b.kind !== "image" || !b.src.startsWith("data:")) return b
          const src = await migrateDataUrl(b.src)
          if (src === b.src) return b
          changed = true
          return { ...b, src }
        }))
        return changed ? { ...col, blocks } : col
      }))
      if (changed) {
        const migrated = { ...content, columns: columns as [Column, Column] }
        setContent(migrated)
        try { localStorage.setItem(storageKey, JSON.stringify(migrated)) } catch { /* retried on next save */ }
      }
      await pruneOrphanedMedia()
    })()
  }, [content, storageKey])

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

        <div style={{ display: "flex", justifyContent: "center", marginTop: 56 }}>
          <button
            onClick={() => {
              // blur the focused field first so its onBlur lands in `content`
              // before this reads it, then write immediately (no debounce)
              const active = document.activeElement
              if (active instanceof HTMLElement && active.isContentEditable) active.blur()
              setTimeout(() => {
                clearTimeout(timer.current)
                setContent(prev => {
                  if (prev) void writeNow(prev)
                  return prev
                })
              }, 0)
            }}
            style={{
              background: "#1a1a1a", border: "none", color: "#fff",
              fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase",
              padding: "11px 30px", cursor: "pointer",
            }}
          >
            Save
          </button>
        </div>
      </div>

      {savedMsg && (
        <div style={{
          position: "fixed", bottom: 28, right: 32,
          color: "#fff", fontSize: 11, letterSpacing: "0.14em", fontWeight: 500,
          background: "#1a1a1a", padding: "9px 16px", borderRadius: 3,
          boxShadow: "0 4px 14px rgba(0,0,0,0.18)", pointerEvents: "none",
        }}>
          ✓ SAVED
        </div>
      )}
      {saveError && (
        <div style={{
          position: "fixed", bottom: 28, right: 32, maxWidth: 280,
          color: "#fff", fontSize: 12, letterSpacing: "0.02em", lineHeight: 1.5,
          background: "#a15c4a", padding: "10px 14px", borderRadius: 3,
          boxShadow: "0 4px 14px rgba(0,0,0,0.18)", pointerEvents: "none",
        }}>
          Couldn&apos;t save — this browser&apos;s storage is full even after clearing
          unused media. Removing a large image should free it up.
        </div>
      )}
      {undoneMsg && (
        <div style={{
          position: "fixed", bottom: 28, right: 32,
          color: "#fff", fontSize: 11, letterSpacing: "0.1em", fontWeight: 500,
          background: "#8a6d2f", padding: "9px 16px", borderRadius: 3,
          boxShadow: "0 4px 14px rgba(0,0,0,0.18)", pointerEvents: "none",
        }}>
          UNDONE — ⌘Z AGAIN FOR MORE
        </div>
      )}
    </main>
  )
}
