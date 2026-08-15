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
  bio: "London kid, couldn’t stop thinking about how intuition and taste is built. Studied architecture at Bartlett UCL, ended up top of class. But architecture mostly serves the few and that bothered me. So I started building products instead. Now at Harvard master of design engineering, constantly shipping products that redefine the ways we live.",
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
}: { item: RowItem; onDelete: () => void; onSave: (v: string) => void }) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: "1px solid #ebebeb", position: "relative" }}
    >
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

// ── contact link style ────────────────────────────────────────────────────────
const contactLink: React.CSSProperties = {
  fontSize: 13,
  color: "#222",
  textDecoration: "none",
  borderBottom: "1px solid #cfcdc7",
  paddingBottom: 1,
  letterSpacing: "0.01em",
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
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      setData(raw ? JSON.parse(raw) : DEFAULT)
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
        <EditPara
          initial={data.bio}
          onSave={v => patch({ bio: v })}
          style={{ fontSize: 13, color: "#666", margin: "0 0 22px", lineHeight: 1.75, letterSpacing: "0.01em" }}
        />

        {/* ── contact ── */}
        <div style={{ display: "flex", gap: 18, margin: "0 0 64px" }}>
          <a
            href="https://www.linkedin.com/in/izzy-yingqi-shen-5558201b4/"
            target="_blank"
            rel="noopener noreferrer"
            style={contactLink}
          >
            LinkedIn
          </a>
          <a href="mailto:izzy_shen@mde.harvard.edu" style={contactLink}>
            Email
          </a>
        </div>

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
