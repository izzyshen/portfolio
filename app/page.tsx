"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"

// ── types ─────────────────────────────────────────────────────────────────────
interface HourEntry { label: string; pct: number; color: string }
interface RowItem    { id: string; label: string; slug?: string }
interface SectionDef { id: string; label: string; isProjects?: boolean; items: RowItem[] }

interface HomeData {
  name: string
  headline: string
  bio: string
  hours: HourEntry[]
  sections: SectionDef[]
}

// ── defaults ──────────────────────────────────────────────────────────────────
const STORAGE_KEY = "portfolio-home"

const DEFAULT: HomeData = {
  name: "Izzy Shen",
  headline: "A constant product builder, based in Boston, NY, London",
  bio: "London kid, couldn’t stop thinking about how intuition and taste is built. Studied architecture at Bartlett UCL, ended up top of class. But architecture mostly serves the few and that bothered me. So I started building products instead. Now at Harvard master of design engineering, constantly shipping products that redefine the ways we live. Reach me on LinkedIn or over email.",
  hours: [
    { label: "Build and Think", pct: 40, color: "#111" },
    { label: "Sleep",           pct: 33, color: "#555" },
    { label: "Sport",           pct: 12, color: "#999" },
    { label: "Connect",         pct: 15, color: "#ccc" },
  ],
  sections: [
    { id: "projects", label: "Previous Projects", isProjects: true, items: [
      { id: "graphite", label: "Graphite",  slug: "graphite" },
      { id: "peri-ai",  label: "Peri.ai",   slug: "peri-ai"  },
      { id: "sixth",    label: "Sixth",     slug: "sixth"    },
      { id: "drift",    label: "Drift",     slug: "drift"    },
    ]},
    { id: "thoughts", label: "Thoughts", items: [
      { id: "t1", label: "Creative Paradigm in AI Era" },
    ]},
    { id: "creatives", label: "Creatives", items: [
      { id: "c1", label: "Art"         },
      { id: "c2", label: "Photography" },
      { id: "c3", label: "Video"       },
    ]},
    { id: "awards", label: "Awards", items: [
      { id: "a1", label: "President Innovation Challenge" },
      { id: "a2", label: "Photography" },
      { id: "a3", label: "Video"       },
    ]},
  ],
}

// ── helpers ───────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 8)
const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "untitled"

type DragState = { si: number; from: number; over: number } | null

const move = <T,>(arr: T[], from: number, to: number) => {
  const next = [...arr]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

// ── inline contact links inside the bio ───────────────────────────────────────
const LINKEDIN_URL = "https://www.linkedin.com/in/izzy-yingqi-shen-5558201b4/"
const MAILTO_URL = "mailto:izzy_shen@mde.harvard.edu"
const CONTACT_RE = /\b(LinkedIn|e-?mail)\b/gi
const HAS_CONTACT = /\b(LinkedIn|e-?mail)\b/i // stateless: /g regexes carry lastIndex across .test()
const CONTACT_SENTENCE = " Reach me on LinkedIn or over email."

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

/** Turn bare "LinkedIn" / "email" words into real anchors, single pass. */
function linkify(text: string) {
  const style = "color:#222;border-bottom:1px solid #cfcdc7;text-decoration:none"
  let out = ""
  let last = 0
  let m: RegExpExecArray | null
  CONTACT_RE.lastIndex = 0
  while ((m = CONTACT_RE.exec(text))) {
    const word = m[0]
    const isLi = word.toLowerCase() === "linkedin"
    const href = isLi ? LINKEDIN_URL : MAILTO_URL
    const attrs = isLi ? ' target="_blank" rel="noopener noreferrer"' : ""
    out += escapeHtml(text.slice(last, m.index))
    out += `<a contenteditable="false" href="${href}"${attrs} style="${style}">${escapeHtml(word)}</a>`
    last = m.index + word.length
  }
  return out + escapeHtml(text.slice(last))
}

// ── editable paragraph that keeps its contact links live ─────────────────────
function EditRichPara({
  initial, style, onSave,
}: { initial: string; style?: React.CSSProperties; onSave: (v: string) => void }) {
  const ref = useRef<HTMLParagraphElement>(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (ref.current) ref.current.innerHTML = linkify(initial) }, [])
  return (
    <p
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onClick={e => {
        // anchors sit inside a contentEditable region, so navigate by hand
        const a = (e.target as HTMLElement).closest("a")
        if (!a) return
        e.preventDefault()
        if (a.target === "_blank") window.open(a.href, "_blank", "noopener")
        else window.location.href = a.href
      }}
      onBlur={e => {
        const text = e.currentTarget.textContent ?? ""
        e.currentTarget.innerHTML = linkify(text)
        onSave(text)
      }}
      style={{ outline: "none", cursor: "text", ...style }}
    />
  )
}

// ── editable line (single-line contentEditable) ───────────────────────────────
function EditLine({
  initial, style, onSave,
}: { initial: string; style?: React.CSSProperties; onSave: (v: string) => void }) {
  const ref = useRef<HTMLSpanElement>(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (ref.current) ref.current.textContent = initial }, [])
  return (
    <span
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLElement).blur() } }}
      onBlur={e => onSave(e.currentTarget.textContent ?? "")}
      style={{ outline: "none", cursor: "text", ...style }}
    />
  )
}

// ── editable paragraph (multi-line) ──────────────────────────────────────────
function EditPara({
  initial, style, onSave,
}: { initial: string; style?: React.CSSProperties; onSave: (v: string) => void }) {
  const ref = useRef<HTMLParagraphElement>(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (ref.current) ref.current.textContent = initial }, [])
  return (
    <p
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onBlur={e => onSave(e.currentTarget.textContent ?? "")}
      style={{ outline: "none", cursor: "text", ...style }}
    />
  )
}

// ── single row (editable label + project link + delete) ──────────────────────
function RowEl({
  item, onDelete, onSave,
  dragging, dropBefore, onDragStart, onDragEnter, onDrop, onDragEnd,
}: {
  item: RowItem
  onDelete: () => void
  onSave: (v: string) => void
  dragging: boolean
  dropBefore: boolean
  onDragStart: () => void
  onDragEnter: () => void
  onDrop: () => void
  onDragEnd: () => void
}) {
  const [hov, setHov] = useState(false)
  // the row only becomes draggable once the grip is pressed, so the
  // contentEditable label stays selectable with a normal click-drag
  const [armed, setArmed] = useState(false)

  return (
    <div
      draggable={armed}
      onDragStart={e => { e.dataTransfer.effectAllowed = "move"; onDragStart() }}
      onDragEnter={onDragEnter}
      onDragOver={e => e.preventDefault()}
      onDrop={e => { e.preventDefault(); onDrop() }}
      onDragEnd={() => { setArmed(false); onDragEnd() }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "7px 0", position: "relative",
        borderBottom: "1px solid #ebebeb",
        borderTop: dropBefore ? "1px solid #999" : "1px solid transparent",
        opacity: dragging ? 0.35 : 1,
        transition: "opacity 0.12s",
      }}
    >
      <span
        title="drag to reorder"
        onMouseDown={() => setArmed(true)}
        onMouseUp={() => setArmed(false)}
        style={{
          position: "absolute", left: -20,
          opacity: hov ? 1 : 0, transition: "opacity 0.12s",
          color: "#c4c4c4", fontSize: 12, cursor: "grab",
          userSelect: "none", lineHeight: 1,
        }}
      >
        ⠿
      </span>
      <Link
        href={`/projects/${item.slug ?? slugify(item.label)}`}
        title="open"
        style={{ color: "#aaa", fontSize: 12, flexShrink: 0, textDecoration: "none" }}
      >
        →
      </Link>
      <EditLine
        initial={item.label}
        onSave={onSave}
        style={{ fontSize: 13, color: "#222", letterSpacing: "0.01em", flex: 1 }}
      />
      <button
        onClick={onDelete}
        title="delete"
        style={{
          opacity: hov ? 1 : 0,
          transition: "opacity 0.12s",
          background: "none", border: "none",
          color: "#bbb", fontSize: 14,
          cursor: "pointer", padding: "0 2px", lineHeight: 1, flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  )
}

// ── drift icon ────────────────────────────────────────────────────────────────
function DriftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ opacity: 0.6 }}>
      <rect x="1"   y="5"  width="7" height="5" rx="0.5" stroke="#888" strokeWidth="0.8" />
      <rect x="10"  y="5"  width="7" height="5" rx="0.5" stroke="#888" strokeWidth="0.8" />
      <rect x="5.5" y="2"  width="7" height="5" rx="0.5" stroke="#888" strokeWidth="0.8" fill="none" />
      <rect x="5.5" y="11" width="7" height="5" rx="0.5" stroke="#888" strokeWidth="0.8" fill="none" />
    </svg>
  )
}

// ── main ──────────────────────────────────────────────────────────────────────
export default function Home() {
  const [data, setData] = useState<HomeData | null>(null)
  // state drives the drop-indicator; the ref is the source of truth, because the
  // drag handlers can all fire within one render and would read a stale `drag`
  const [drag, setDrag] = useState<DragState>(null)
  const dragRef = useRef<DragState>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      const saved: HomeData = raw ? JSON.parse(raw) : DEFAULT
      // a bio saved before contact links existed has nothing to linkify — give it
      // the sentence once, then leave it alone (it stays editable like any text)
      if (!HAS_CONTACT.test(saved.bio)) saved.bio = saved.bio.trimEnd() + CONTACT_SENTENCE
      setData(saved)
    } catch {
      setData(DEFAULT)
    }
  }, [])

  const persist = (next: HomeData) => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(next)), 400)
  }

  const patch = (up: Partial<HomeData>) => {
    setData(prev => {
      if (!prev) return prev
      const next = { ...prev, ...up }
      persist(next)
      return next
    })
  }

  const patchSection = (si: number, up: Partial<SectionDef>) => {
    setData(prev => {
      if (!prev) return prev
      const sections = prev.sections.map((s, i) => i === si ? { ...s, ...up } : s)
      const next = { ...prev, sections }
      persist(next)
      return next
    })
  }

  const setBothDrag = (next: DragState | ((d: DragState) => DragState)) => {
    setDrag(prev => {
      const resolved = typeof next === "function" ? next(prev) : next
      dragRef.current = resolved
      return resolved
    })
  }

  const commitDrag = () => {
    const d = dragRef.current
    setBothDrag(null)
    if (!d || d.from === d.over) return
    const sec = data?.sections[d.si]
    if (sec) patchSection(d.si, { items: move(sec.items, d.from, d.over) })
  }

  if (!data) return <div style={{ background: "#f7f6f3", minHeight: "100vh" }} />

  return (
    <main style={{ background: "#f7f6f3", minHeight: "100vh", color: "#111", fontFamily: "'Afacad', sans-serif" }}>

      {/* ── fixed header ── */}
      <header style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "28px 40px", background: "#f7f6f3",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.jpg" alt="logo" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }} />
          <EditLine
            initial={data.name}
            onSave={v => patch({ name: v || data.name })}
            style={{ fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: "#666" }}
          />
        </div>
        <Link href="/drift" style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "#888", textDecoration: "none" }}>
          <DriftIcon />
          <span>Projects Space</span>
        </Link>
      </header>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "120px 40px 80px" }}>

        {/* ── headline ── */}
        <EditPara
          initial={data.headline}
          onSave={v => patch({ headline: v })}
          style={{ fontSize: 13, color: "#444", margin: "0 0 28px", letterSpacing: "0.01em", lineHeight: 1.5 }}
        />

        {/* ── bio ── */}
        <EditRichPara
          initial={data.bio}
          onSave={v => patch({ bio: v })}
          style={{ fontSize: 13, color: "#666", margin: "0 0 64px", lineHeight: 1.75, letterSpacing: "0.01em" }}
        />

        {/* ── hours bar ── */}
        <div style={{ marginBottom: 48 }}>
          <p style={{ margin: "0 0 14px", fontSize: 10, color: "#bbb", letterSpacing: "0.15em", textTransform: "uppercase" }}>
            My 24 hours:
          </p>
          <div style={{ display: "flex", height: 6, borderRadius: 2, overflow: "hidden", marginBottom: 10 }}>
            {data.hours.map(h => (
              <div key={h.color} style={{ width: `${h.pct}%`, background: h.color }} />
            ))}
          </div>
          <div style={{ display: "flex" }}>
            {data.hours.map((h, i) => (
              <div key={h.color} style={{ width: `${h.pct}%`, paddingRight: 8 }}>
                <div style={{ fontSize: 9, color: "#999", letterSpacing: "0.06em" }}>{h.pct}%</div>
                <EditLine
                  initial={h.label}
                  onSave={v => {
                    const hours = data.hours.map((e, j) => j === i ? { ...e, label: v } : e)
                    patch({ hours })
                  }}
                  style={{ fontSize: 9, color: "#aaa", letterSpacing: "0.04em", marginTop: "2px", display: "block" }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* ── sections ── */}
        {data.sections.map((sec, si) => (
          <div key={sec.id} style={{ marginBottom: 40 }}>
            <p style={{ margin: "0 0 14px" }}>
              <EditLine
                initial={sec.label}
                onSave={v => patchSection(si, { label: v })}
                style={{ fontSize: 10, color: "#bbb", letterSpacing: "0.15em", textTransform: "uppercase" }}
              />
            </p>

            {sec.items.map((item, ii) => (
              <RowEl
                key={item.id}
                item={item}
                dragging={drag?.si === si && drag.from === ii}
                dropBefore={drag?.si === si && drag.over === ii && drag.from !== ii}
                onDragStart={() => setBothDrag({ si, from: ii, over: ii })}
                onDragEnter={() => setBothDrag(d => (d && d.si === si ? { ...d, over: ii } : d))}
                onDrop={commitDrag}
                onDragEnd={() => setBothDrag(null)}
                onDelete={() => patchSection(si, { items: sec.items.filter((_, j) => j !== ii) })}
                onSave={label => {
                  const items = sec.items.map((it, j) => j === ii
                    ? { ...it, label, slug: slugify(label) }
                    : it)
                  patchSection(si, { items })
                }}
              />
            ))}

            <button
              onClick={() => {
                const id = uid()
                patchSection(si, { items: [...sec.items, { id, label: "New item", slug: `item-${id}` }] })
              }}
              style={{
                marginTop: 8, background: "none", border: "none",
                color: "#ccc", fontSize: 10, letterSpacing: "0.14em",
                cursor: "pointer", padding: "4px 0", display: "block",
              }}
            >
              + ADD
            </button>
          </div>
        ))}

      </div>
    </main>
  )
}
