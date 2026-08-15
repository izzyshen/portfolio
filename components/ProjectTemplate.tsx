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
  coverSrc: string
  sections: Section[]
  /** true once a one-time content seed (e.g. Graphite's demo clips) has run,
   *  so it never reappears after someone deliberately deletes it */
  seededDemo?: boolean
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
    coverSrc: "",
    sections: defaultSections(),
  }
}

// ── one-time content seeds ──────────────────────────────────────────────────
// Short clips cut from the raw Graphite demo recording, placed in the section
// each moment actually illustrates. Runs once per browser (see seededDemo)
// so deleting a clip later doesn't bring it back.
const GRAPHITE_DEMO_BLOCKS: Record<string, { src: string; caption: string }[]> = {
  "problem-defining": [
    { src: "/graphite-clip-1-brief.mp4", caption: "Setting the creative brief" },
  ],
  "design-decision": [
    { src: "/graphite-clip-2-curate.mp4", caption: "AI curates matching references" },
  ],
  "engineer-decision": [
    { src: "/graphite-clip-3-arrange.mp4", caption: "Arranging the moodboard canvas" },
    { src: "/graphite-clip-4-detail.mp4", caption: "Opening a reference for detail" },
  ],
  "prototype-outcome": [
    { src: "/graphite-clip-5-reveal.mp4", caption: "The generated design playbook" },
  ],
}

function seedDemoClips(content: ProjectContent, slug: string): ProjectContent {
  if (slug !== "graphite" || content.seededDemo) return content
  const sections = content.sections.map(s => {
    const extra = GRAPHITE_DEMO_BLOCKS[s.id]
    if (!extra) return s
    const blocks: MediaBlock[] = extra.map((b, i) => ({
      id: `seed-${s.id}-${i}`, type: "video", src: b.src, caption: b.caption,
    }))
    return { ...s, blocks: [...blocks, ...s.blocks] }
  })
  return { ...content, sections, seededDemo: true }
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
    coverSrc: typeof r.coverSrc === "string" ? r.coverSrc : "",
    sections,
    seededDemo: r.seededDemo === true,
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

// ── editable multi-line body ──────────────────────────────────────────────────
const PLACEHOLDER = '<span data-ph style="color:#c9c9c9;pointer-events:none">Write something here…</span>'

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
  )
}

// ── cover image ───────────────────────────────────────────────────────────────
function CoverZone({ src, onChange }: { src: string; onChange: (s: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const readFile = (f: File) => {
    const r = new FileReader()
    r.onload = () => onChange(r.result as string)
    r.readAsDataURL(f)
  }
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
          <img src={src} alt="" style={{ width: "100%", display: "block" }} />
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
 *  touch devices, since there's no hover event there) and resets when it ends. */
function HoverVideo({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [hover, setHover] = useState(false)

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
        src={src}
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
  block, onDelete, onCaptionSave,
}: { block: MediaBlock; onDelete: () => void; onCaptionSave: (c: string) => void }) {
  return (
    <div style={{ marginBottom: 28, position: "relative" }}>
      {block.type === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={block.src} alt="" style={{ width: "100%", display: "block" }} />
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
        <HoverVideo src={block.src} />
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

// videos are stored as base64 in localStorage (same as images) — the browser's
// per-origin quota is typically 5-10MB total, so a big upload can silently fail
// to persist. Warn early rather than let someone lose an edit without knowing why.
const VIDEO_WARN_BYTES = 15 * 1024 * 1024

function AddRow({
  onAddImage, onAddVideo,
}: { onAddImage: (s: string) => void; onAddVideo: (u: string) => void }) {
  const imgRef = useRef<HTMLInputElement>(null)
  const videoFileRef = useRef<HTMLInputElement>(null)
  const [videoMode, setVideoMode] = useState(false)
  const [url, setUrl] = useState("")

  const readFile = (f: File, onDone: (dataUrl: string) => void) => {
    const r = new FileReader()
    r.onload = () => onDone(r.result as string)
    r.readAsDataURL(f)
  }

  const readVideoFile = (f: File) => {
    if (f.size > VIDEO_WARN_BYTES) {
      const mb = (f.size / (1024 * 1024)).toFixed(1)
      const proceed = window.confirm(
        `This video is ${mb}MB. Large videos can exceed the browser's local storage limit and fail to save. Continue anyway?`
      )
      if (!proceed) return
    }
    readFile(f, onAddVideo)
  }

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => imgRef.current?.click()} style={btnStyle}>+ IMAGE</button>
        <button onClick={() => videoFileRef.current?.click()} style={btnStyle}>+ VIDEO FILE</button>
        <button onClick={() => setVideoMode(v => !v)} style={btnStyle}>+ VIDEO URL</button>
        <input
          ref={imgRef} type="file" accept="image/*" style={{ display: "none" }}
          onChange={e => { const f = e.target.files?.[0]; if (f) readFile(f, onAddImage); e.target.value = "" }}
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
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      setContent(normalize(raw ? JSON.parse(raw) : null, slug))
    } catch {
      setContent(defaultContent(slug))
    }
  }, [storageKey, slug])

  const persist = (next: ProjectContent) => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(next))
        setSaveError(false)
        setSavedMsg(true)
        setTimeout(() => setSavedMsg(false), 1200)
      } catch {
        // most likely QuotaExceededError from a large video's base64 payload
        setSaveError(true)
      }
    }, 500)
  }

  const patch = (updates: Partial<ProjectContent>) => {
    setContent(prev => {
      if (!prev) return prev
      const next = { ...prev, ...updates }
      persist(next)
      return next
    })
  }

  const patchSection = (si: number, up: Partial<Section>) => {
    setContent(prev => {
      if (!prev) return prev
      const sections = prev.sections.map((s, i) => i === si ? { ...s, ...up } : s)
      const next = { ...prev, sections }
      persist(next)
      return next
    })
  }

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
          style={{ fontSize: 30, fontWeight: 400, letterSpacing: "0.02em", color: "#111", marginBottom: 36 }}
          onSave={v => patch({ title: v || content.title })}
        />

        <CoverZone src={content.coverSrc} onChange={s => patch({ coverSrc: s })} />

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

            <div style={{ marginTop: 20 }}>
              {sec.blocks.map((block, bi) => (
                <BlockView
                  key={block.id}
                  block={block}
                  onDelete={() => patchSection(si, { blocks: sec.blocks.filter((_, j) => j !== bi) })}
                  onCaptionSave={cap =>
                    patchSection(si, { blocks: sec.blocks.map((b, j) => j === bi ? { ...b, caption: cap } : b) })
                  }
                />
              ))}
              <AddRow
                onAddImage={src =>
                  patchSection(si, { blocks: [...sec.blocks, { id: `${Date.now()}`, type: "image", src, caption: "" }] })
                }
                onAddVideo={url =>
                  patchSection(si, { blocks: [...sec.blocks, { id: `${Date.now()}`, type: "video", src: url, caption: "" }] })
                }
              />
            </div>
          </section>
        ))}
      </div>

      {savedMsg && (
        <div style={{ position: "fixed", bottom: 28, right: 32, color: "#c4c2bc", fontSize: 9, letterSpacing: "0.2em", pointerEvents: "none" }}>
          SAVED
        </div>
      )}
      {saveError && (
        <div style={{
          position: "fixed", bottom: 28, right: 32, maxWidth: 260,
          color: "#a15c4a", fontSize: 10, letterSpacing: "0.04em",
          background: "#fbf1ee", border: "1px solid #eeded9",
          padding: "8px 12px", pointerEvents: "none",
        }}>
          Couldn&apos;t save — local storage is full. Try a smaller or shorter video.
        </div>
      )}
    </main>
  )
}
