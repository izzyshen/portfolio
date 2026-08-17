"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { PROJECTS } from "@/lib/projects"
import {
  useMediaSrc,
  storeImageFile,
  storeVideoFile,
  migrateDataUrl,
  pruneOrphanedMedia,
  storageHeadroomMB,
} from "@/lib/mediaStore"

const FONT_OPTIONS = [
  { label: "Afacad", value: "'Afacad', sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Courier", value: "'Courier New', monospace" },
  { label: "Helvetica", value: "'Helvetica Neue', sans-serif" },
]

const SECTION_TITLES = [
  "Problem Defining",
  "Design Decision",
  "Engineer Decision",
  "Prototype Outcome",
  "Reflection",
]

interface MediaBlock {
  id: string
  type: "image" | "video"
  src: string
  caption: string
  /** optional still for a video block, shown until hover starts playback —
   *  worth setting on long/heavy clips that would otherwise sit black */
  poster?: string
}

interface Section {
  id: string
  title: string
  body: string
  blocks: MediaBlock[]
}

interface ProjectContent {
  tag: string
  title: string
  font: string
  /** free text under the title, before any section — the one-or-two-line
   *  framing of what the project is, the way the compare pages already do it */
  summary?: string
  coverSrc: string
  /** media shown above the first section, before any section heading — for a
   *  project whose whole story is one demo reel rather than per-stage clips */
  heroBlocks?: MediaBlock[]
  sections: Section[]
  /** ids of seed blocks (e.g. Graphite's demo clips) someone deliberately
   *  deleted — tracked per-clip so an unrelated edit elsewhere, a storage
   *  reset, or a fresh browser can never lose one that wasn't actually
   *  removed on purpose. Anything not listed here gets re-added if missing. */
  dismissedSeeds?: string[]
}

// ── defaults + migration ──────────────────────────────────────────────────────
const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "untitled"

function defaultSections(): Section[] {
  return SECTION_TITLES.map(t => ({ id: slugify(t), title: t, body: "", blocks: [] }))
}

function titleFromSlug(slug: string) {
  return slug
    .replace(/-\d+$/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, l => l.toUpperCase())
}

function defaultContent(slug: string): ProjectContent {
  return {
    tag: "project",
    title: titleFromSlug(slug),
    font: "'Afacad', sans-serif",
    summary: "",
    coverSrc: "",
    heroBlocks: [],
    sections: defaultSections(),
  }
}

// ── legacy-slug content recovery ─────────────────────────────────────────────
// A project's slug used to be regenerated every time its landing-page label
// was edited (fixed now — slug is assigned once and frozen), so a browser
// that visited before the fix may still have a drifted slug like
// "graphite-build-taste-with-ai" saved. If nothing exists yet under that
// drifted slug, check whether the ORIGINAL default slug has content — if so,
// adopt it instead of starting blank, so a rename never looks like data loss.
const ORIGINAL_SLUGS = ["graphite", "peri-ai", "sixth", "drift"]

function isSlugOrVariant(slug: string, base: string) {
  return slug === base || slug.startsWith(`${base}-`)
}

function legacySlugFor(slug: string): string | null {
  if (ORIGINAL_SLUGS.includes(slug)) return null
  return ORIGINAL_SLUGS.find(s => slug.startsWith(`${s}-`)) ?? null
}

// ── content seeds ─────────────────────────────────────────────────────────
// Short clips cut from the raw Graphite demo recording, placed in the section
// each moment actually illustrates. Re-checked on every load: any clip that's
// missing (fresh browser, storage got reset, wasn't there before this feature
// shipped) is added back, unless its id is in dismissedSeeds — i.e. someone
// clicked its own ✕ on purpose. That's the only way a clip stays gone.
type SeedBlock = { id: string; src: string; caption: string; poster?: string }
/** keyed by section id, or HERO_KEY for the slot above the first section */
type SeedSet = Record<string, SeedBlock[]>

const GRAPHITE_DEMO_BLOCKS: SeedSet = {
  "problem-defining": [
    { id: "seed-problem-defining-0", src: "/graphite-clip-1-brief.mp4", caption: "Setting the creative brief" },
  ],
  "design-decision": [
    { id: "seed-design-decision-0", src: "/graphite-clip-2-curate.mp4", caption: "AI curates matching references" },
  ],
  "engineer-decision": [
    { id: "seed-engineer-decision-0", src: "/graphite-clip-3-arrange.mp4", caption: "Arranging the moodboard canvas" },
    { id: "seed-engineer-decision-1", src: "/graphite-clip-4-detail.mp4", caption: "Opening a reference for detail" },
  ],
  "prototype-outcome": [
    { id: "seed-prototype-outcome-0", src: "/graphite-clip-5-reveal.mp4", caption: "The generated design playbook" },
  ],
}

/** Reserved seed key for the hero slot above the first section, as opposed to
 *  the section ids every other key refers to. */
const HERO_KEY = "__hero"

// The full Peri.ai MVP walkthrough at 2x, kept as one continuous take rather
// than cut into per-feature clips — cutting dropped the transitions between
// moments, which is most of what the demo is showing. Sits in the hero slot so
// it leads the page instead of belonging to one stage. Loops on hover like the
// Graphite clips above, and follows the same re-check/dismiss behavior.
// Its id differs from the earlier in-section one so that a browser which
// dismissed it there doesn't suppress it in its new position.
const PERI_DEMO_BLOCKS: SeedSet = {
  [HERO_KEY]: [
    { id: "seed-peri-hero-demo-0", src: "/peri-mvp-demo.mp4", caption: "Full MVP walkthrough (2x) — inquiries, agent chat, and approving/rejecting deals" },
  ],
}

// The SIXTH concept film, in the hero slot so it opens the page ahead of
// Problem Defining — it frames the whole project rather than evidencing one
// stage. Re-encoded from the 5K HEVC master (which Chrome and Firefox can't
// decode at all) down to 1440-wide H.264 with faststart, so it streams on
// hover instead of forcing a 206MB download. Carries a poster because at
// 15MB the first frame won't paint instantly on a cold load.
const SIXTH_DEMO_BLOCKS: SeedSet = {
  [HERO_KEY]: [
    {
      id: "seed-sixth-hero-film-0",
      src: "/sixth-film.mp4",
      poster: "/sixth-film-poster.jpg",
      caption: "SIXTH — concept film",
    },
  ],
}

function seedDemoClips(content: ProjectContent, slug: string): ProjectContent {
  // matches each project's base slug and any older/renamed variant like
  // "graphite-build-taste-with-ai" from back when editing a project's label
  // also regenerated its slug (fixed on the landing page, but existing
  // browsers may already have the renamed slug saved)
  const seedSet = isSlugOrVariant(slug, "graphite")
    ? GRAPHITE_DEMO_BLOCKS
    : isSlugOrVariant(slug, "peri-ai")
    ? PERI_DEMO_BLOCKS
    : isSlugOrVariant(slug, "sixth")
    ? SIXTH_DEMO_BLOCKS
    : null
  if (!seedSet) return content
  const dismissed = new Set(content.dismissedSeeds ?? [])

  /** Reconciles one location's saved blocks against the seeds defined for that
   *  location: adds any that are missing, and drops seed- blocks that no longer
   *  belong here — either because the seed set stopped defining them at all, or
   *  because it now defines them somewhere else (a clip moved from a section up
   *  to the hero slot must not linger in both). Anything added by hand keeps the
   *  id AddRow gave it and is never touched. Returns the original array when
   *  nothing changed, so unchanged sections keep their identity. */
  const applySeeds = (
    blocks: MediaBlock[],
    wanted: SeedBlock[] = [],
  ): MediaBlock[] => {
    const validHere = new Set(wanted.map(b => b.id))
    const pruned = blocks.filter(b => !b.id.startsWith("seed-") || validHere.has(b.id))
    const present = new Set(pruned.map(b => b.id))
    const missing: MediaBlock[] = wanted
      .filter(b => !dismissed.has(b.id) && !present.has(b.id))
      .map(b => ({ id: b.id, type: "video", src: b.src, caption: b.caption, poster: b.poster }))
    // a seed already saved from before it gained a poster (or whose poster
    // path changed) keeps the stale value otherwise — the seed set is the
    // source of truth for its own blocks, so re-apply it on every load
    const synced = pruned.map(b => {
      const seed = wanted.find(w => w.id === b.id)
      return seed && b.poster !== seed.poster ? { ...b, poster: seed.poster } : b
    })
    const changed =
      missing.length || synced.length !== blocks.length || synced.some((b, i) => b !== blocks[i])
    if (!changed) return blocks
    return [...missing, ...synced]
  }

  const heroBlocks = applySeeds(content.heroBlocks ?? [], seedSet[HERO_KEY])
  const sections = content.sections.map(s => {
    const blocks = applySeeds(s.blocks, seedSet[s.id])
    return blocks === s.blocks ? s : { ...s, blocks }
  })
  return { ...content, heroBlocks, sections }
}

/** Accepts old-format saved content (top-level body/blocks) and upgrades it. */
function normalize(raw: unknown, slug: string): ProjectContent {
  const base = defaultContent(slug)
  if (!raw || typeof raw !== "object") return seedDemoClips(base, slug)
  const r = raw as Record<string, unknown>

  const sections = Array.isArray(r.sections) && r.sections.length
    ? (r.sections as Section[]).map(s => ({ ...s, blocks: s.blocks ?? [] }))
    : defaultSections()

  // legacy: single body + blocks lived at the top level — fold into section 1
  if (!Array.isArray(r.sections)) {
    if (typeof r.body === "string" && r.body) sections[0].body = r.body
    if (Array.isArray(r.blocks) && r.blocks.length) sections[0].blocks = r.blocks as MediaBlock[]
  }

  return seedDemoClips({
    tag: typeof r.tag === "string" ? r.tag : base.tag,
    title: typeof r.title === "string" ? r.title : base.title,
    font: typeof r.font === "string" ? r.font : base.font,
    summary: typeof r.summary === "string" ? r.summary : "",
    coverSrc: typeof r.coverSrc === "string" ? r.coverSrc : "",
    heroBlocks: Array.isArray(r.heroBlocks) ? (r.heroBlocks as MediaBlock[]) : [],
    sections,
    dismissedSeeds: Array.isArray(r.dismissedSeeds) ? (r.dismissedSeeds as string[]) : [],
  }, slug)
}

/** One-time upgrade for pages saved before media moved to IndexedDB: rewrites
 *  every inline base64 `data:` URL to an `idb:` ref. This is what actually
 *  frees a jammed localStorage — the old payloads were megabytes each, and
 *  until they're out of the way every save keeps hitting the quota ceiling.
 *  Returns null when there was nothing to migrate. */
async function migrateContentMedia(c: ProjectContent): Promise<ProjectContent | null> {
  let changed = false

  const conv = async (src: string): Promise<string> => {
    if (typeof src !== "string" || !src.startsWith("data:")) return src
    const ref = await migrateDataUrl(src)
    if (ref !== src) changed = true
    return ref
  }

  const convBlocks = (blocks: MediaBlock[]) => Promise.all(blocks.map(async b => {
    const src = await conv(b.src)
    const poster = b.poster ? await conv(b.poster) : b.poster
    return src === b.src && poster === b.poster ? b : { ...b, src, poster }
  }))

  const coverSrc = await conv(c.coverSrc)
  const heroBlocks = c.heroBlocks ? await convBlocks(c.heroBlocks) : c.heroBlocks
  const sections = await Promise.all(c.sections.map(async s => {
    const blocks = await convBlocks(s.blocks)
    return blocks.some((b, i) => b !== s.blocks[i]) ? { ...s, blocks } : s
  }))

  return changed ? { ...c, coverSrc, heroBlocks, sections } : null
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
// Applied by wrapping the current selection in a <span style="...">, toggled
// off again if the selection is already exactly wrapped by a matching span —
// so clicking the same button twice undoes it, same as any rich text editor.
const LIGHT_COLOR = "#999999"
const BOLD_COLOR = "#111111"

function commonAncestorElement(range: Range): HTMLElement | null {
  let node: Node | null = range.commonAncestorContainer
  if (node.nodeType === Node.TEXT_NODE) node = node.parentElement
  return node as HTMLElement | null
}

// the browser normalizes style values on write (e.g. "#111111" -> "rgb(17, 17,
// 17)"), so comparing a raw target string against a live element's computed
// value never matches — run the target through the same normalization first
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
  // if the selection exactly matches an existing size-adjusted span, resize it
  // in place instead of wrapping again — otherwise repeated clicks nest deeper
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
      <button
        title="Light"
        style={{ ...formatBtnStyle, color: LIGHT_COLOR }}
        onClick={() => run(el => toggleSpanStyle(el, { color: LIGHT_COLOR }))}
      >
        Aa
      </button>
      <button
        title="Bold"
        style={{ ...formatBtnStyle, fontWeight: 700, color: "#fff" }}
        onClick={() => run(el => toggleSpanStyle(el, { "font-weight": "700", color: BOLD_COLOR }))}
      >
        B
      </button>
      <button
        title="Italic"
        style={{ ...formatBtnStyle, fontStyle: "italic", color: "#fff" }}
        onClick={() => run(el => toggleSpanStyle(el, { "font-style": "italic" }))}
      >
        I
      </button>
      <button
        title="Underline"
        style={{ ...formatBtnStyle, textDecoration: "underline", color: "#fff" }}
        onClick={() => run(el => toggleSpanStyle(el, { "text-decoration": "underline" }))}
      >
        U
      </button>
      <div style={{ width: 1, height: 14, background: "rgba(255,255,255,0.15)", margin: "0 2px" }} />
      <button title="Smaller" style={{ ...formatBtnStyle, color: "#fff" }} onClick={() => run(el => stepFontSize(el, -2))}>
        A−
      </button>
      <button title="Larger" style={{ ...formatBtnStyle, color: "#fff" }} onClick={() => run(el => stepFontSize(el, 2))}>
        A+
      </button>
    </div>
  )
}

// ── editable multi-line body ──────────────────────────────────────────────────
const placeholderHtml = (text: string) =>
  `<span data-ph style="color:#c9c9c9;pointer-events:none">${text}</span>`

const PLACEHOLDER = placeholderHtml("Write something here…")

function EditBody({
  initial, style, onSave, placeholder,
}: {
  initial: string
  style: React.CSSProperties
  onSave: (v: string) => void
  placeholder?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const empty = useRef(!initial)
  const ph = placeholder ? placeholderHtml(placeholder) : PLACEHOLDER

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

// ── cover image ───────────────────────────────────────────────────────────────
function CoverZone({ src, onChange }: { src: string; onChange: (s: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const displaySrc = useMediaSrc(src)
  const readFile = (f: File) => { storeImageFile(f).then(onChange) }
  return (
    <div
      onClick={() => !src && inputRef.current?.click()}
      style={{
        marginBottom: 48,
        position: "relative",
        ...(src ? {} : {
          height: 170,
          background: "#f1f0ec",
          border: "1px dashed #ddd",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer",
        }),
      }}
    >
      {src ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={displaySrc} alt="" style={{ width: "100%", display: "block" }} />
          <button onClick={() => onChange("")} style={overlayBtn}>✕ remove</button>
        </>
      ) : (
        <span style={{ color: "#c2c2c2", fontSize: 9, letterSpacing: "0.2em" }}>+ COVER IMAGE</span>
      )}
      <input
        ref={inputRef} type="file" accept="image/*" style={{ display: "none" }}
        onChange={e => { const f = e.target.files?.[0]; if (f) readFile(f) }}
      />
    </div>
  )
}

const overlayBtn: React.CSSProperties = {
  position: "absolute", top: 8, right: 8,
  background: "rgba(255,255,255,0.9)", border: "1px solid #e4e4e4",
  color: "#888", fontSize: 10,
  padding: "4px 8px", cursor: "pointer", letterSpacing: "0.1em",
}

// ── media block ───────────────────────────────────────────────────────────────
/** true for youtube.com/youtu.be/vimeo.com links — everything else (a local
 *  upload's data: URL, or a direct .mp4 link) plays via a native <video> tag. */
function isEmbedUrl(url: string) {
  return /(?:youtube\.com|youtu\.be|vimeo\.com)/.test(url)
}

function toEmbedUrl(url: string) {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/)
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`
  const vm = url.match(/vimeo\.com\/(\d+)/)
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`
  return url
}

/** Plays like a GIF: muted, looping, no controls — starts on hover (or tap on
 *  touch devices, since there's no hover event there) and resets when it ends.
 *  `poster` is optional: with preload="metadata" a browser isn't obliged to
 *  paint a first frame, so a big clip can sit as a black box until hover. A
 *  poster gives it something to show immediately for a few tens of KB. */
function HoverVideo({ src, poster }: { src: string; poster?: string }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [hover, setHover] = useState(false)
  const displaySrc = useMediaSrc(src)
  const displayPoster = useMediaSrc(poster ?? "")

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const v = ref.current
    if (!v) return
    if (hover) {
      v.currentTime = 0
      v.play().catch(() => {}) // autoplay can reject before the element is ready; harmless
    } else {
      v.pause()
      v.currentTime = 0
    }
  }, [hover])

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => setHover(h => !h)}
      style={{ position: "relative", cursor: "pointer", border: "1px solid #e2e1dc" }}
    >
      <video
        ref={ref}
        src={displaySrc}
        poster={displayPoster || undefined}
        muted
        loop
        playsInline
        preload="metadata"
        style={{ width: "100%", display: "block", background: "#000" }}
      />
      {/* dims the (often pale) first frame so the box always reads as media,
       *  and gives the hover affordance somewhere to sit */}
      <div
        style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8,
          background: "rgba(0,0,0,0.28)",
          opacity: hover ? 0 : 1, transition: "opacity 0.15s",
          pointerEvents: "none",
        }}
      >
        <div style={{
          width: 40, height: 40, borderRadius: "50%",
          border: "1px solid rgba(255,255,255,0.85)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontSize: 13, paddingLeft: 2,
        }}>
          ▶
        </div>
        <span style={{ color: "#fff", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase" }}>
          Hover to preview
        </span>
      </div>
    </div>
  )
}

function BlockView({
  block, onDelete, onCaptionSave, onHandlePointerDown, isDragging, isDropTarget,
}: {
  block: MediaBlock
  onDelete: () => void
  onCaptionSave: (c: string) => void
  onHandlePointerDown: (e: React.PointerEvent) => void
  isDragging: boolean
  isDropTarget: boolean
}) {
  const imageSrc = useMediaSrc(block.type === "image" ? block.src : "")
  return (
    <div
      data-block-id={block.id}
      style={{
        marginBottom: 28,
        position: "relative",
        opacity: isDragging ? 0.4 : 1,
        outline: isDropTarget ? "2px dashed #b6b4ae" : "none",
        outlineOffset: 4,
        transition: "opacity 0.15s",
      }}
    >
      <div
        onPointerDown={onHandlePointerDown}
        title="Drag to reorder"
        style={{
          // explicit z-index (not "auto") so this always paints above the
          // media below it: HoverVideo/the embed iframe wrapper are
          // themselves position:relative and come later in the DOM, so
          // without this they'd win the stacking tie-break and silently eat
          // every click/drag aimed at the handle (image blocks are static,
          // not positioned, so they never had this problem — only video and
          // embed blocks did)
          position: "absolute", top: 8, left: 8, zIndex: 2,
          background: "rgba(255,255,255,0.9)", border: "1px solid #e4e4e4",
          color: "#888", fontSize: 11, letterSpacing: "0.1em",
          padding: "4px 7px", cursor: "grab", userSelect: "none",
          touchAction: "none",
        }}
      >
        ⠿
      </div>
      {block.type === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageSrc} alt="" style={{ width: "100%", display: "block" }} />
      ) : isEmbedUrl(block.src) ? (
        <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, overflow: "hidden" }}>
          <iframe
            src={toEmbedUrl(block.src)}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
          />
        </div>
      ) : (
        <HoverVideo src={block.src} poster={block.poster} />
      )}
      <EditLine
        initial={block.caption || "Caption…"}
        style={{ color: "#aaa", fontSize: 11, letterSpacing: "0.04em", marginTop: 8 }}
        onSave={onCaptionSave}
      />
      <button onClick={onDelete} style={overlayBtn}>✕</button>
    </div>
  )
}

// ── add media row ─────────────────────────────────────────────────────────────
const btnStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid #e2e1dc",
  color: "#aaa",
  fontSize: 9, letterSpacing: "0.16em",
  padding: "5px 12px", cursor: "pointer",
}

// Media goes to IndexedDB (a ~6GB budget here) rather than localStorage's
// ~12MB, so ordinary uploads have room to spare. This only guards against a
// clip large enough to matter against the whole-disk quota.
const VIDEO_WARN_BYTES = 300 * 1024 * 1024

function AddRow({
  visible, onAddImage, onAddVideo,
}: { visible: boolean; onAddImage: (s: string) => void; onAddVideo: (u: string) => void }) {
  const imgRef = useRef<HTMLInputElement>(null)
  const videoFileRef = useRef<HTMLInputElement>(null)
  const [videoMode, setVideoMode] = useState(false)
  const [url, setUrl] = useState("")
  const [busy, setBusy] = useState(false)

  // a big image gets decoded and re-encoded before it lands, which is fast but
  // not instant — flag it so a second click can't queue a duplicate upload
  const withBusy = (p: Promise<string>, onDone: (ref: string) => void) => {
    setBusy(true)
    p.then(onDone).finally(() => setBusy(false))
  }

  const readVideoFile = (f: File) => {
    if (f.size > VIDEO_WARN_BYTES) {
      const mb = (f.size / (1024 * 1024)).toFixed(0)
      const proceed = window.confirm(
        `This video is ${mb}MB. Files this large can exhaust the browser's storage budget. Continue anyway?`
      )
      if (!proceed) return
    }
    withBusy(storeVideoFile(f), onAddVideo)
  }

  return (
    // opacity, not display:none — keeps this row's height reserved at all
    // times so nothing else in the section reflows when it fades in/out
    <div style={{ marginTop: 14, opacity: visible ? 1 : 0, pointerEvents: visible ? "auto" : "none", transition: "opacity 0.15s" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button onClick={() => imgRef.current?.click()} style={btnStyle} disabled={busy}>+ IMAGE</button>
        <button onClick={() => videoFileRef.current?.click()} style={btnStyle} disabled={busy}>+ VIDEO FILE</button>
        <button onClick={() => setVideoMode(v => !v)} style={btnStyle}>+ VIDEO URL</button>
        {busy && (
          <span style={{ color: "#b0aea8", fontSize: 9, letterSpacing: "0.16em" }}>ADDING…</span>
        )}
        <input
          ref={imgRef} type="file" accept="image/*" style={{ display: "none" }}
          onChange={e => { const f = e.target.files?.[0]; if (f) withBusy(storeImageFile(f), onAddImage); e.target.value = "" }}
        />
        <input
          ref={videoFileRef} type="file" accept="video/*" style={{ display: "none" }}
          onChange={e => { const f = e.target.files?.[0]; if (f) readVideoFile(f); e.target.value = "" }}
        />
      </div>
      {videoMode && (
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="YouTube or Vimeo URL"
            style={{
              flex: 1, background: "#fff", border: "1px solid #e2e1dc",
              color: "#333", fontSize: 12, padding: "6px 10px", outline: "none",
            }}
          />
          <button
            style={btnStyle}
            onClick={() => { if (url.trim()) { onAddVideo(url.trim()); setUrl(""); setVideoMode(false) } }}
          >
            ADD
          </button>
        </div>
      )}
    </div>
  )
}

// ── cross-section drag ───────────────────────────────────────────────────────
/** Which list a block lives in: the hero strip, or a section by index. */
const HERO_CONTAINER = "hero"

interface DragOrigin { blockId: string; from: string }
/** Where a drop would land. `blockId: null` means "past the last block in this
 *  container", i.e. append — which is also how an empty section is targeted. */
interface DropTarget { container: string; blockId: string | null }

/**
 * Owns dragging for the whole page rather than per-section, so a block picked
 * up in one section can be dropped into another. Hit-testing walks every
 * block/container rect in the document instead of asking what's topmost at the
 * cursor, so overlaying media (videos, embeds) can't intercept the drop.
 *
 * Pointer events rather than native HTML5 drag-and-drop: `draggable="true"`
 * needs the browser to recognize an OS-level drag, which is unreliable on
 * trackpads and absent on touch.
 */
function useBlockDrag(
  onMove: (from: string, blockId: string, to: string, beforeBlockId: string | null) => void,
) {
  const [dragging, setDragging] = useState<DragOrigin | null>(null)
  const [target, setTarget] = useState<DropTarget | null>(null)
  const draggingRef = useRef<DragOrigin | null>(null)
  const targetRef = useRef<DropTarget | null>(null)
  // keeps the latest callback reachable without re-subscribing listeners on
  // every parent re-render (which an inline arrow prop causes constantly)
  const onMoveRef = useRef(onMove)
  onMoveRef.current = onMove

  const start = (blockId: string, from: string) => {
    const origin = { blockId, from }
    draggingRef.current = origin
    setDragging(origin)
  }

  useEffect(() => {
    if (!dragging) return

    const inside = (r: DOMRect, x: number, y: number) =>
      y >= r.top && y <= r.bottom && x >= r.left && x <= r.right

    /** Recomputed from the last pointer position rather than the event, so
     *  auto-scrolling (where the cursor is still but the page moves under it)
     *  keeps the highlighted target honest. */
    const updateTarget = (x: number, y: number) => {
      const dragged = draggingRef.current
      if (!dragged) return
      let hit: DropTarget | null = null

      // a block under the cursor wins — the dragged block lands at its index
      for (const el of document.querySelectorAll<HTMLElement>("[data-block-id]")) {
        const id = el.getAttribute("data-block-id")
        if (!id || id === dragged.blockId) continue
        if (!inside(el.getBoundingClientRect(), x, y)) continue
        const containerId = el
          .closest<HTMLElement>("[data-container-id]")
          ?.getAttribute("data-container-id")
        if (containerId) { hit = { container: containerId, blockId: id }; break }
      }

      // otherwise fall back to whichever container the cursor is inside, so
      // dropping onto a section's empty space appends to it
      if (!hit) {
        for (const el of document.querySelectorAll<HTMLElement>("[data-container-id]")) {
          if (!inside(el.getBoundingClientRect(), x, y)) continue
          hit = { container: el.getAttribute("data-container-id")!, blockId: null }
          break
        }
      }

      targetRef.current = hit
      setTarget(hit)
    }

    let pointerX = 0
    let pointerY = 0
    const onPointerMove = (e: PointerEvent) => {
      pointerX = e.clientX
      pointerY = e.clientY
      updateTarget(pointerX, pointerY)
    }

    // Media blocks are tall enough that the section you're aiming for is
    // usually off-screen when you pick something up, and a held pointer
    // generates no scroll of its own — without this, dragging between
    // sections simply can't reach its destination.
    const EDGE = 110
    const MAX_SPEED = 22
    // a timer rather than requestAnimationFrame: rAF is suspended whenever the
    // document isn't being painted, which silently freezes the scroll instead
    // of just slowing it. 16ms tracks the frame rate closely enough that the
    // motion still reads as smooth.
    const scroller = setInterval(() => {
      if (!draggingRef.current) return
      const h = window.innerHeight
      if (!h) return
      let dy = 0
      if (pointerY < EDGE) dy = -MAX_SPEED * (1 - pointerY / EDGE)
      else if (pointerY > h - EDGE) dy = MAX_SPEED * (1 - (h - pointerY) / EDGE)
      if (!dy) return
      // the proportional term passes 1 once the pointer goes beyond the edge
      // (dragging toward the very top/bottom, or off the window entirely), and
      // unclamped that scrolls the page hundreds of pixels per tick — fast
      // enough to yank the drop target out from under the cursor
      dy = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, dy))
      const before = window.scrollY
      window.scrollBy(0, dy)
      if (window.scrollY !== before) updateTarget(pointerX, pointerY)
    }, 16)

    const finish = () => {
      const dragged = draggingRef.current
      const drop = targetRef.current
      if (dragged && drop && !(drop.container === dragged.from && drop.blockId === dragged.blockId)) {
        onMoveRef.current(dragged.from, dragged.blockId, drop.container, drop.blockId)
      }
      draggingRef.current = null
      targetRef.current = null
      setDragging(null)
      setTarget(null)
    }

    window.addEventListener("pointermove", onPointerMove)
    window.addEventListener("pointerup", finish)
    window.addEventListener("pointercancel", finish)
    return () => {
      clearInterval(scroller)
      window.removeEventListener("pointermove", onPointerMove)
      window.removeEventListener("pointerup", finish)
      window.removeEventListener("pointercancel", finish)
    }
  }, [dragging])

  return { dragging, target, start }
}

type BlockDrag = ReturnType<typeof useBlockDrag>

/** Wraps a section's media blocks + AddRow, revealing the add-buttons only
 *  while the cursor is anywhere over this area — keeps the page clean when
 *  just viewing, without losing the ability to add more later. */
function SectionMedia({
  containerId, blocks, drag, onDeleteBlock, onCaptionSave, onAddImage, onAddVideo,
}: {
  containerId: string
  blocks: MediaBlock[]
  drag: BlockDrag
  onDeleteBlock: (block: MediaBlock) => void
  onCaptionSave: (block: MediaBlock, caption: string) => void
  onAddImage: (src: string) => void
  onAddVideo: (url: string) => void
}) {
  const [hover, setHover] = useState(false)
  const isDragActive = drag.dragging !== null
  const isAppendTarget =
    drag.target?.container === containerId && drag.target.blockId === null

  return (
    <div
      data-container-id={containerId}
      style={{
        marginTop: 20,
        // while a drag is in flight every container needs enough area to be
        // aimed at, otherwise a section holding nothing is nearly unhittable
        minHeight: isDragActive ? 56 : undefined,
        outline: isAppendTarget ? "2px dashed #b6b4ae" : "none",
        outlineOffset: 6,
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {blocks.map(block => (
        <BlockView
          key={block.id}
          block={block}
          onDelete={() => onDeleteBlock(block)}
          onCaptionSave={cap => onCaptionSave(block, cap)}
          isDragging={drag.dragging?.blockId === block.id}
          isDropTarget={
            drag.target?.container === containerId &&
            drag.target.blockId === block.id &&
            drag.dragging !== null &&
            drag.dragging.blockId !== block.id
          }
          onHandlePointerDown={e => {
            e.preventDefault()
            drag.start(block.id, containerId)
          }}
        />
      ))}
      <AddRow visible={hover && !isDragActive} onAddImage={onAddImage} onAddVideo={onAddVideo} />
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
export default function ProjectTemplate({ slug }: { slug: string }) {
  const storageKey = `portfolio-project-${slug}`
  const [content, setContent] = useState<ProjectContent | null>(null)
  const [savedMsg, setSavedMsg] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const [undoneMsg, setUndoneMsg] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Cmd/Ctrl+Z undo history — every change (edits, deletions, everything)
  // pushes the PRE-change snapshot here first, so undo always has somewhere
  // to go back to. Capped so it can't grow unbounded in a long session.
  const UNDO_LIMIT = 50
  const undoStack = useRef<ProjectContent[]>([])
  const pushUndo = (snapshot: ProjectContent) => {
    undoStack.current.push(snapshot)
    if (undoStack.current.length > UNDO_LIMIT) undoStack.current.shift()
  }

  useEffect(() => {
    const load = () => {
      try {
        let raw = localStorage.getItem(storageKey)
        if (!raw) {
          const legacySlug = legacySlugFor(slug)
          if (legacySlug) raw = localStorage.getItem(`portfolio-project-${legacySlug}`)
        }
        setContent(normalize(raw ? JSON.parse(raw) : null, slug))
      } catch {
        setContent(defaultContent(slug))
      }
    }
    load()
    // Safari/Chrome can restore this page from the back-forward cache on a
    // "back" navigation without re-running React — that frozen snapshot can
    // predate this load, or predate a clip that got seeded since. Re-sync
    // from storage whenever that happens so it never looks stale.
    const onPageShow = (e: PageTransitionEvent) => { if (e.persisted) load() }
    window.addEventListener("pageshow", onPageShow)
    return () => window.removeEventListener("pageshow", onPageShow)
  }, [storageKey, slug])

  // the debounce below means a save can be up to 500ms behind the latest
  // edit — pendingRef always holds that latest value so it can be flushed
  // immediately (bypassing the debounce) the instant the tab is hidden or
  // closed, so a quick close right after typing can never lose that edit
  const pendingRef = useRef<ProjectContent | null>(null)

  /** The single write path — used by the debounce, the Save button, and the
   *  tab-hidden flush, so all three behave identically. */
  const writeNow = async (next: ProjectContent): Promise<boolean> => {
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
      // Quota exceeded. Media now lives in IndexedDB, so what's left here is
      // small — but a page that still holds pre-migration base64, or blobs
      // orphaned by deletes, can keep it wedged. Reclaim, then retry once
      // rather than making someone reset storage by hand.
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

  const persist = (next: ProjectContent) => {
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
        // quota exceeded — nothing more we can do at unload time
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

  // Once per page load, after content first appears: pull any legacy inline
  // base64 out into IndexedDB, then drop blobs nothing points at any more.
  const migratedRef = useRef(false)
  useEffect(() => {
    if (!content || migratedRef.current) return
    migratedRef.current = true
    ;(async () => {
      const migrated = await migrateContentMedia(content)
      if (migrated) {
        setContent(migrated)
        // write straight through: the whole point is to free the space now,
        // and going via the debounce would leave the bloated copy in place
        try { localStorage.setItem(storageKey, JSON.stringify(migrated)) } catch { /* retried on next save */ }
      }
      await pruneOrphanedMedia()
    })()
  }, [content, storageKey])

  const patch = (updates: Partial<ProjectContent>) => {
    setContent(prev => {
      if (!prev) return prev
      pushUndo(prev)
      const next = { ...prev, ...updates }
      persist(next)
      return next
    })
  }

  const patchSection = (si: number, up: Partial<Section>) => {
    setContent(prev => {
      if (!prev) return prev
      pushUndo(prev)
      const sections = prev.sections.map((s, i) => i === si ? { ...s, ...up } : s)
      const next = { ...prev, sections }
      persist(next)
      return next
    })
  }

  // hero slot (above the first section) — same operations as a section's media,
  // just against the top-level heroBlocks list instead of a section's
  const patchHero = (blocks: MediaBlock[]) => {
    setContent(prev => {
      if (!prev) return prev
      pushUndo(prev)
      const next = { ...prev, heroBlocks: blocks }
      persist(next)
      return next
    })
  }

  const deleteHeroBlock = (block: MediaBlock) => {
    setContent(prev => {
      if (!prev) return prev
      pushUndo(prev)
      const dismissedSeeds = block.id.startsWith("seed-")
        ? [...(prev.dismissedSeeds ?? []), block.id]
        : prev.dismissedSeeds
      const next = {
        ...prev,
        heroBlocks: (prev.heroBlocks ?? []).filter(b => b.id !== block.id),
        dismissedSeeds,
      }
      persist(next)
      return next
    })
  }

  // deleting a seeded clip (id starts with "seed-") records it as dismissed so
  // seedDemoClips won't re-add just that one; deleting anything else is unaffected
  const deleteBlock = (si: number, block: MediaBlock) => {
    setContent(prev => {
      if (!prev) return prev
      pushUndo(prev)
      const sections = prev.sections.map((s, i) =>
        i === si ? { ...s, blocks: s.blocks.filter(b => b.id !== block.id) } : s
      )
      const dismissedSeeds = block.id.startsWith("seed-")
        ? [...(prev.dismissedSeeds ?? []), block.id]
        : prev.dismissedSeeds
      const next = { ...prev, sections, dismissedSeeds }
      persist(next)
      return next
    })
  }

  /** Moves a block within its own list or across to another section/the hero
   *  strip. `beforeBlockId` is the block it should land in front of, or null
   *  to append to the end of the destination. */
  const moveBlock = (from: string, blockId: string, to: string, beforeBlockId: string | null) => {
    setContent(prev => {
      if (!prev) return prev

      const read = (c: string): MediaBlock[] =>
        c === HERO_CONTAINER ? (prev.heroBlocks ?? []) : (prev.sections[Number(c)]?.blocks ?? [])

      const original = read(from)
      const idx = original.findIndex(b => b.id === blockId)
      if (idx === -1) return prev

      // Index of the drop target measured BEFORE the dragged block is pulled
      // out. Computing it afterwards shifts every position past the removal by
      // one, which silently turned a drop onto the next block into a no-op.
      const targetList = from === to ? original : read(to)
      const at = beforeBlockId
        ? targetList.findIndex(b => b.id === beforeBlockId)
        : targetList.length

      const source = [...original]
      let [moved] = source.splice(idx, 1)

      const sameContainer = from === to
      let dismissedSeeds = prev.dismissedSeeds ?? []

      // A seeded clip is re-added to — and only kept in — the section its seed
      // set declares, so carrying one into a different section would see it
      // deleted there and reinstated back here on the next load. Promote it to
      // an ordinary block (fresh id) and mark the seed dismissed, so the move
      // is permanent and nothing reappears.
      if (!sameContainer && moved.id.startsWith("seed-")) {
        dismissedSeeds = [...dismissedSeeds, moved.id]
        moved = { ...moved, id: `moved-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }
      }

      const destination = sameContainer ? source : [...read(to)]
      destination.splice(at === -1 ? destination.length : at, 0, moved)

      pushUndo(prev)
      let heroBlocks = prev.heroBlocks ?? []
      let sections = prev.sections
      const write = (c: string, list: MediaBlock[]) => {
        if (c === HERO_CONTAINER) heroBlocks = list
        else sections = sections.map((s, i) => (i === Number(c) ? { ...s, blocks: list } : s))
      }
      write(from, source)
      if (!sameContainer) write(to, destination)

      const next = { ...prev, heroBlocks, sections, dismissedSeeds }
      persist(next)
      return next
    })
  }

  const drag = useBlockDrag(moveBlock)

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

      <div style={{ maxWidth: 680, marginLeft: 300, marginRight: 40, padding: "80px 0 140px" }}>

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
          style={{ fontSize: 30, fontWeight: 400, letterSpacing: "0.02em", color: "#111", marginBottom: 14 }}
          onSave={v => patch({ title: v || content.title })}
        />

        {/* summary — the framing line(s) under the title, matching the
         *  compare-style project pages */}
        <EditBody
          initial={content.summary ?? ""}
          placeholder="Add a short description…"
          style={{
            fontSize: 15, color: "#555", lineHeight: 1.6,
            paddingBottom: 20, marginBottom: 40,
            borderBottom: "1px solid #ebe9e4",
          }}
          onSave={html => patch({ summary: html })}
        />

        <CoverZone src={content.coverSrc} onChange={s => patch({ coverSrc: s })} />

        {/* hero media — sits above the first section heading */}
        <div style={{ marginBottom: 56 }}>
          <SectionMedia
            blocks={content.heroBlocks ?? []}
            onDeleteBlock={deleteHeroBlock}
            onCaptionSave={(block, cap) =>
              patchHero((content.heroBlocks ?? []).map(b => b.id === block.id ? { ...b, caption: cap } : b))
            }
            onAddImage={src =>
              patchHero([...(content.heroBlocks ?? []), { id: `${Date.now()}`, type: "image", src, caption: "" }])
            }
            onAddVideo={url =>
              patchHero([...(content.heroBlocks ?? []), { id: `${Date.now()}`, type: "video", src: url, caption: "" }])
            }
            containerId={HERO_CONTAINER}
            drag={drag}
          />
        </div>

        {/* sections */}
        {content.sections.map((sec, si) => (
          <section key={sec.id} style={{ marginBottom: 56 }}>
            <EditLine
              initial={sec.title}
              style={{
                fontSize: 10, color: "#b0aea8", letterSpacing: "0.15em",
                textTransform: "uppercase", marginBottom: 12,
                paddingBottom: 8, borderBottom: "1px solid #ebe9e4",
              }}
              onSave={v => patchSection(si, { title: v || sec.title })}
            />

            <EditBody
              initial={sec.body}
              style={{ color: "#5c5c5c", fontSize: 14, lineHeight: 1.9, minHeight: 44 }}
              onSave={html => patchSection(si, { body: html })}
            />

            <SectionMedia
              blocks={sec.blocks}
              onDeleteBlock={block => deleteBlock(si, block)}
              onCaptionSave={(block, cap) =>
                patchSection(si, { blocks: sec.blocks.map(b => b.id === block.id ? { ...b, caption: cap } : b) })
              }
              onAddImage={src =>
                patchSection(si, { blocks: [...sec.blocks, { id: `${Date.now()}`, type: "image", src, caption: "" }] })
              }
              onAddVideo={url =>
                patchSection(si, { blocks: [...sec.blocks, { id: `${Date.now()}`, type: "video", src: url, caption: "" }] })
              }
              containerId={String(si)}
              drag={drag}
            />
          </section>
        ))}

        <div style={{ display: "flex", justifyContent: "center", marginTop: 24 }}>
          <button
            onClick={() => {
              // blur any focused contentEditable field first so its onBlur
              // (which calls patch/patchSection) fires and lands in `content`
              // before this reads it — otherwise a save right after typing
              // could persist a stale, pre-edit snapshot
              const active = document.activeElement
              if (active instanceof HTMLElement && active.isContentEditable) active.blur()
              // give the blur handler's state update a tick to land, then
              // force an immediate, un-debounced write of whatever is current
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
          unused media. Removing a large video should free it up.
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
