"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"

const FONT_OPTIONS = [
  { label: "Afacad", value: "'Afacad', sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Courier", value: "'Courier New', monospace" },
  { label: "Helvetica", value: "'Helvetica Neue', sans-serif" },
]

interface MediaBlock {
  id: string
  type: "image" | "video"
  src: string
  caption: string
}

interface ProjectContent {
  tag: string
  title: string
  font: string
  body: string
  coverSrc: string
  blocks: MediaBlock[]
}

function defaultContent(slug: string): ProjectContent {
  const title = slug
    .replace(/-\d+$/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, l => l.toUpperCase())
  return { tag: "project", title, font: "'Afacad', sans-serif", body: "", coverSrc: "", blocks: [] }
}

// ── Editable single-line element ──────────────────────────────────────────────
function EditLine({
  initial, style, onSave,
}: { initial: string; style: React.CSSProperties; onSave: (v: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { if (ref.current) ref.current.textContent = initial }, [])
  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onBlur={e => onSave(e.currentTarget.textContent ?? "")}
      style={{ outline: "none", cursor: "text", whiteSpace: "pre-wrap", ...style }}
    />
  )
}

// ── Editable multi-line body ──────────────────────────────────────────────────
function EditBody({
  initial, style, onSave,
}: { initial: string; style: React.CSSProperties; onSave: (v: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const empty = useRef(!initial)

  useEffect(() => {
    if (!ref.current) return
    if (initial) {
      ref.current.innerHTML = initial
    } else {
      ref.current.innerHTML = '<span data-ph style="color:rgba(255,255,255,0.18);pointer-events:none">Write something here…</span>'
    }
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
        empty.current = !html || html === ""
        onSave(html)
      }}
      style={{ outline: "none", cursor: "text", ...style }}
    />
  )
}

// ── Cover image zone ──────────────────────────────────────────────────────────
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
        marginBottom: 36,
        position: "relative",
        ...(src
          ? {}
          : {
              height: 180,
              background: "rgba(255,255,255,0.02)",
              border: "1px dashed rgba(255,255,255,0.08)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
            }),
      }}
    >
      {src ? (
        <>
          <img src={src} alt="" style={{ width: "100%", display: "block" }} />
          <button
            onClick={() => onChange("")}
            style={{
              position: "absolute", top: 8, right: 8,
              background: "rgba(0,0,0,0.6)", border: "none",
              color: "rgba(255,255,255,0.5)", fontSize: 10,
              padding: "4px 8px", cursor: "pointer", letterSpacing: "0.1em",
            }}
          >
            ✕ remove
          </button>
        </>
      ) : (
        <span style={{ color: "rgba(255,255,255,0.14)", fontSize: 9, letterSpacing: "0.2em" }}>
          + COVER IMAGE
        </span>
      )}
      <input
        ref={inputRef} type="file" accept="image/*" style={{ display: "none" }}
        onChange={e => { const f = e.target.files?.[0]; if (f) readFile(f) }}
      />
    </div>
  )
}

// ── Single media block ────────────────────────────────────────────────────────
function toEmbedUrl(url: string) {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/)
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`
  const vm = url.match(/vimeo\.com\/(\d+)/)
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`
  return url
}

function BlockView({
  block, onDelete, onCaptionSave,
}: { block: MediaBlock; onDelete: () => void; onCaptionSave: (c: string) => void }) {
  return (
    <div style={{ marginBottom: 36, position: "relative" }}>
      {block.type === "image" ? (
        <img src={block.src} alt="" style={{ width: "100%", display: "block" }} />
      ) : (
        <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, overflow: "hidden" }}>
          <iframe
            src={toEmbedUrl(block.src)}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
          />
        </div>
      )}
      <EditLine
        initial={block.caption || "Caption…"}
        style={{ color: "rgba(255,255,255,0.22)", fontSize: 11, letterSpacing: "0.04em", marginTop: 8 }}
        onSave={onCaptionSave}
      />
      <button
        onClick={onDelete}
        style={{
          position: "absolute", top: 8, right: 8,
          background: "rgba(0,0,0,0.65)", border: "none",
          color: "rgba(255,255,255,0.45)", fontSize: 10,
          padding: "4px 8px", cursor: "pointer",
        }}
      >
        ✕
      </button>
    </div>
  )
}

// ── Add block row ─────────────────────────────────────────────────────────────
const btnStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "rgba(255,255,255,0.28)",
  fontSize: 9, letterSpacing: "0.16em",
  padding: "6px 14px", cursor: "pointer",
}

function AddRow({
  onAddImage, onAddVideo,
}: { onAddImage: (s: string) => void; onAddVideo: (u: string) => void }) {
  const imgRef = useRef<HTMLInputElement>(null)
  const [videoMode, setVideoMode] = useState(false)
  const [url, setUrl] = useState("")

  const readFile = (f: File) => {
    const r = new FileReader()
    r.onload = () => onAddImage(r.result as string)
    r.readAsDataURL(f)
  }

  return (
    <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 24, marginTop: 8 }}>
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={() => imgRef.current?.click()} style={btnStyle}>+ IMAGE</button>
        <button onClick={() => setVideoMode(v => !v)} style={btnStyle}>+ VIDEO</button>
        <input
          ref={imgRef} type="file" accept="image/*" style={{ display: "none" }}
          onChange={e => { const f = e.target.files?.[0]; if (f) readFile(f) }}
        />
      </div>
      {videoMode && (
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="YouTube or Vimeo URL"
            style={{
              flex: 1,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#e8e8e8", fontSize: 12,
              padding: "6px 10px", outline: "none",
            }}
          />
          <button
            style={btnStyle}
            onClick={() => {
              if (url.trim()) { onAddVideo(url.trim()); setUrl(""); setVideoMode(false) }
            }}
          >
            ADD
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main template ─────────────────────────────────────────────────────────────
export default function ProjectTemplate({ slug }: { slug: string }) {
  const storageKey = `portfolio-project-${slug}`
  const [content, setContent] = useState<ProjectContent | null>(null)
  const [savedMsg, setSavedMsg] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      setContent(raw ? JSON.parse(raw) : defaultContent(slug))
    } catch {
      setContent(defaultContent(slug))
    }
  }, [storageKey, slug])

  const persist = (next: ProjectContent) => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      localStorage.setItem(storageKey, JSON.stringify(next))
      setSavedMsg(true)
      setTimeout(() => setSavedMsg(false), 1200)
    }, 500)
  }

  const patch = (updates: Partial<ProjectContent>) => {
    if (!content) return
    const next = { ...content, ...updates }
    setContent(next)
    persist(next)
  }

  if (!content) return <div style={{ background: "#0c0c0c", minHeight: "100vh" }} />

  return (
    <main style={{ minHeight: "100vh", background: "#0c0c0c", color: "#e8e8e8", fontFamily: content.font }}>
      <div style={{ maxWidth: 680, marginLeft: "max(15%, 40px)", marginRight: 40, padding: "80px 0 120px" }}>

        <Link
          href="/drift"
          style={{ display: "inline-block", marginBottom: 56, color: "rgba(255,255,255,0.28)", fontSize: 11, letterSpacing: "0.15em" }}
        >
          ← drift
        </Link>

        {/* Tag + font picker */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <EditLine
            initial={`// ${content.tag}`}
            style={{ color: "rgba(255,255,255,0.18)", fontSize: 10, letterSpacing: "0.18em", fontFamily: "monospace" }}
            onSave={v => patch({ tag: v.replace(/^\/\/\s*/, "") || "project" })}
          />
          <select
            value={content.font}
            onChange={e => patch({ font: e.target.value })}
            style={{
              background: "transparent",
              border: "none", borderBottom: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.28)", fontSize: 10,
              padding: "2px 4px", cursor: "pointer", outline: "none",
            }}
          >
            {FONT_OPTIONS.map(f => (
              <option key={f.value} value={f.value} style={{ background: "#111", color: "#ccc" }}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        {/* Title */}
        <EditLine
          initial={content.title}
          style={{ fontSize: 28, fontWeight: 400, letterSpacing: "0.03em", color: "rgba(255,255,255,0.82)", marginBottom: 40 }}
          onSave={v => patch({ title: v || content.title })}
        />

        {/* Cover image */}
        <CoverZone src={content.coverSrc} onChange={s => patch({ coverSrc: s })} />

        {/* Body */}
        <EditBody
          initial={content.body}
          style={{ color: "rgba(255,255,255,0.45)", fontSize: 14, lineHeight: 2, marginBottom: 48, minHeight: 80 }}
          onSave={html => patch({ body: html })}
        />

        {/* Media blocks */}
        {content.blocks.map((block, i) => (
          <BlockView
            key={block.id}
            block={block}
            onDelete={() => patch({ blocks: content.blocks.filter((_, j) => j !== i) })}
            onCaptionSave={cap => patch({ blocks: content.blocks.map((b, j) => j === i ? { ...b, caption: cap } : b) })}
          />
        ))}

        {/* Add block row */}
        <AddRow
          onAddImage={src => patch({ blocks: [...content.blocks, { id: Date.now().toString(), type: "image", src, caption: "" }] })}
          onAddVideo={url => patch({ blocks: [...content.blocks, { id: Date.now().toString(), type: "video", src: url, caption: "" }] })}
        />
      </div>

      {savedMsg && (
        <div style={{ position: "fixed", bottom: 28, right: 32, color: "rgba(255,255,255,0.2)", fontSize: 9, letterSpacing: "0.2em", pointerEvents: "none" }}>
          SAVED
        </div>
      )}
    </main>
  )
}
