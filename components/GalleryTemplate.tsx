"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useMediaSrc, storeImageFile, pruneOrphanedMedia } from "@/lib/mediaStore"
import { useEditMode } from "@/lib/editMode"
import { seedGallery } from "@/lib/seed"

/**
 * Art / Photography: an edge-aligned image grid. Every cell is the same size
 * with the image cropped to fill it, so edges line up however many images are
 * added; clicking a cell opens the uncropped image. Always editable by its
 * owner — outside edit mode the upload and delete controls shrink to a few
 * faint pixels so readers don't notice them.
 */

interface GalleryImage { id: string; src: string; caption: string }
interface GalleryContent { title: string; images: GalleryImage[] }

const uid = () => Math.random().toString(36).slice(2, 8)

function titleFromSlug(slug: string) {
  return slug.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase())
}

function normalize(raw: unknown, slug: string): GalleryContent {
  const base: GalleryContent = { title: titleFromSlug(slug), images: [] }
  if (!raw || typeof raw !== "object") return base
  const r = raw as Record<string, unknown>
  return {
    title: typeof r.title === "string" && r.title ? r.title : base.title,
    images: Array.isArray(r.images)
      ? (r.images as GalleryImage[]).filter(i => i && typeof i.src === "string")
      : [],
  }
}

// ── one cell ──────────────────────────────────────────────────────────────────
function Cell({
  image, subtle, onOpen, onDelete,
}: { image: GalleryImage; subtle: boolean; onOpen: () => void; onDelete: () => void }) {
  const src = useMediaSrc(image.src)
  const [hov, setHov] = useState(false)
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ position: "relative", aspectRatio: "1 / 1", overflow: "hidden", background: "#eeede9" }}
    >
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={image.caption}
          onClick={onOpen}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", cursor: "zoom-in" }}
        />
      )}
      <button
        onClick={e => { e.stopPropagation(); onDelete() }}
        title="remove"
        style={{
          position: "absolute", top: subtle ? 3 : 6, right: subtle ? 3 : 6,
          opacity: hov ? (subtle ? 0.45 : 1) : 0, transition: "opacity 0.12s",
          background: subtle ? "none" : "rgba(255,255,255,0.9)",
          border: subtle ? "none" : "1px solid #e4e4e4",
          color: subtle ? "#f2f2f2" : "#888", fontSize: subtle ? 7 : 11,
          padding: subtle ? 0 : "3px 7px", lineHeight: 1, cursor: "pointer",
          textShadow: subtle ? "0 0 2px rgba(0,0,0,0.4)" : "none",
        }}
      >
        ×
      </button>
    </div>
  )
}

// ── full-size viewer ──────────────────────────────────────────────────────────
function Lightbox({ image, onClose }: { image: GalleryImage; onClose: () => void }) {
  const src = useMediaSrc(image.src)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 300, background: "rgba(247,246,243,0.96)",
        display: "flex", alignItems: "center", justifyContent: "center", cursor: "zoom-out", padding: 40,
      }}
    >
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={image.caption} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", display: "block" }} />
      )}
    </div>
  )
}

// ── main ──────────────────────────────────────────────────────────────────────
export default function GalleryTemplate({ slug }: { slug: string }) {
  const storageKey = `portfolio-gallery-${slug}`
  const editMode = useEditMode()
  const subtle = !editMode
  const [content, setContent] = useState<GalleryContent | null>(null)
  const [open, setOpen] = useState<GalleryImage | null>(null)
  const [busy, setBusy] = useState(false)
  const [savedMsg, setSavedMsg] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const pendingRef = useRef<GalleryContent | null>(null)

  useEffect(() => {
    const load = () => {
      try {
        const raw = localStorage.getItem(storageKey)
        setContent(normalize(raw ? JSON.parse(raw) : seedGallery(slug), slug))
      } catch {
        setContent(normalize(seedGallery(slug), slug))
      }
    }
    load()
    const onPageShow = (e: PageTransitionEvent) => { if (e.persisted) load() }
    window.addEventListener("pageshow", onPageShow)
    return () => window.removeEventListener("pageshow", onPageShow)
  }, [storageKey, slug])

  const write = (next: GalleryContent) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(next))
      pendingRef.current = null
      setSavedMsg(true)
      setTimeout(() => setSavedMsg(false), 1200)
    } catch {
      void pruneOrphanedMedia()
    }
  }

  const persist = (next: GalleryContent) => {
    pendingRef.current = next
    clearTimeout(timer.current)
    timer.current = setTimeout(() => write(next), 400)
  }

  useEffect(() => {
    const flush = () => { if (pendingRef.current) { clearTimeout(timer.current); write(pendingRef.current) } }
    const onVis = () => { if (document.visibilityState === "hidden") flush() }
    window.addEventListener("pagehide", flush)
    document.addEventListener("visibilitychange", onVis)
    return () => {
      window.removeEventListener("pagehide", flush)
      document.removeEventListener("visibilitychange", onVis)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  const patch = (up: Partial<GalleryContent>) => {
    setContent(prev => {
      if (!prev) return prev
      const next = { ...prev, ...up }
      persist(next)
      return next
    })
  }

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true)
    try {
      const added: GalleryImage[] = []
      for (const f of Array.from(files)) {
        if (!f.type.startsWith("image/")) continue
        added.push({ id: uid(), src: await storeImageFile(f), caption: "" })
      }
      setContent(prev => {
        if (!prev) return prev
        const next = { ...prev, images: [...prev.images, ...added] }
        persist(next)
        return next
      })
    } finally {
      setBusy(false)
    }
  }

  if (!content) return <div style={{ background: "#f7f6f3", minHeight: "100vh" }} />

  return (
    <main style={{ minHeight: "100vh", background: "#f7f6f3", color: "#111", fontFamily: "'Afacad', sans-serif" }}>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "64px 40px 140px" }}>

        <Link
          href="/"
          style={{ display: "inline-block", marginBottom: 48, color: "#999", fontSize: 12, letterSpacing: "0.15em", textTransform: "uppercase", textDecoration: "none" }}
        >
          ← Back
        </Link>

        <h1 style={{ fontSize: 28, fontWeight: 400, letterSpacing: "0.02em", color: "#111", margin: "0 0 36px" }}>
          {content.title}
        </h1>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
          {content.images.map(img => (
            <Cell
              key={img.id}
              image={img}
              subtle={subtle}
              onOpen={() => setOpen(img)}
              onDelete={() => patch({ images: content.images.filter(i => i.id !== img.id) })}
            />
          ))}
        </div>

        {/* upload — a normal button in edit mode, a few faint pixels otherwise */}
        <div style={{ marginTop: subtle ? 4 : 18, display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            title="add images"
            style={subtle ? {
              background: "none", border: "none", cursor: "pointer", padding: "2px 0",
              color: "#e4e4e4", fontSize: 6, letterSpacing: "0.1em", opacity: 0.6,
            } : {
              background: "transparent", border: "1px solid #e2e1dc", color: "#aaa",
              fontSize: 9, letterSpacing: "0.16em", padding: "6px 14px", cursor: "pointer",
            }}
          >
            + IMAGE
          </button>
          {busy && <span style={{ color: "#c4c2bc", fontSize: subtle ? 6 : 9, letterSpacing: "0.16em" }}>ADDING…</span>}
          <input
            ref={inputRef} type="file" accept="image/*" multiple style={{ display: "none" }}
            onChange={e => { void addFiles(e.target.files); e.target.value = "" }}
          />
        </div>
      </div>

      {open && <Lightbox image={open} onClose={() => setOpen(null)} />}

      {savedMsg && (
        <div style={{ position: "fixed", bottom: 28, right: 32, color: subtle ? "#e6e4de" : "#c4c2bc", fontSize: subtle ? 6 : 9, letterSpacing: "0.2em", pointerEvents: "none" }}>
          SAVED
        </div>
      )}
    </main>
  )
}
