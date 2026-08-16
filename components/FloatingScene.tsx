"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import gsap from "gsap"
import { PROJECTS } from "@/lib/projects"

type PatternType = "dots" | "grid" | "rings" | "code"

interface CardDef {
  id: string
  title: string
  tag: string
  x: number
  y: number
  z: number
  width: number
  height: number
  pattern: PatternType
  speed: number
  amount: number
}

const TITLE_POOL = [
  "Graphite", "Pulse",   "Mesa",    "Drift",  "Thread", "Atlas",
  "Beacon",   "Crate",   "Kernel",  "Loom",   "Nano",   "Orbit",
  "Prism",    "Quartz",  "Ridge",   "Spire",  "Tide",   "Vector",
  "Wisp",     "Yarn",    "Alpha",   "Beta",   "Gamma",  "Delta",
  "Echo",     "Foxtrot", "Hotel",   "India",  "Juliet", "Kilo",
]

const TAG_POOL = [
  "design system", "web app",  "tooling",  "viz",      "cli",      "research",
  "api",           "devops",   "systems",  "editor",   "embedded", "scheduler",
  "graphics",      "db",       "monitor",  "protocol", "stream",   "math",
  "experiment",    "game",     "archive",  "sketch",   "note",     "idea",
  "signal",        "audio",    "compiler", "runtime",  "test",     "deploy",
]

const PATTERNS_LIST: PatternType[] = ["dots", "grid", "rings", "code"]

// ── live project data ─────────────────────────────────────────────────────────
// The scene used to zip a static, build-time PROJECTS list into its fixed
// slot positions — so a renamed project never updated here and a newly added
// one never appeared at all. Now it reads whatever's actually in the landing
// page's "Previous Projects" section, same as the project rail elsewhere.
interface LiveProject { title: string; tag: string; slug: string }

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "untitled"

// the 4 projects this site shipped with — used both as a fallback before
// portfolio-home exists, and to recover a thumbnail/title saved under the
// original slug if a project's slug later drifted from an old label edit
const ORIGINAL_SLUGS = ["graphite", "peri-ai", "sixth", "drift"]

function legacySlugFor(slug: string): string | null {
  if (ORIGINAL_SLUGS.includes(slug)) return null
  return ORIGINAL_SLUGS.find(s => slug.startsWith(`${s}-`)) ?? null
}

function readLiveProjects(): LiveProject[] {
  const fallback: LiveProject[] = PROJECTS
  try {
    const raw = localStorage.getItem("portfolio-home")
    if (!raw) return fallback
    const home = JSON.parse(raw)
    const sec = home?.sections?.find((s: { isProjects?: boolean }) => s.isProjects)
    if (!sec?.items?.length) return fallback
    return sec.items.map((it: { label: string; slug?: string }) => ({
      title: it.label,
      tag: "project",
      slug: it.slug ?? slugify(it.label),
    }))
  } catch {
    return fallback
  }
}

function buildCards(liveProjects: LiveProject[]): CardDef[] {
  return POSITIONS.map((pos, i) => {
    const real = i < liveProjects.length ? liveProjects[i] : null
    const sizeVar = 1 + ((i * 13) % 7 - 3) / 80
    return {
      id:      real ? real.slug : `${TITLE_POOL[i % TITLE_POOL.length].toLowerCase()}-${i}`,
      title:   real ? real.title : TITLE_POOL[i % TITLE_POOL.length],
      tag:     real ? `// ${real.tag}` : `// ${TAG_POOL[i % TAG_POOL.length]}`,
      x: pos.x, y: pos.y, z: pos.z,
      width:   Math.round(265 * sizeVar),
      height:  Math.round(170 * sizeVar),
      pattern: PATTERNS_LIST[i % PATTERNS_LIST.length],
      speed:   6.5 + ((i * 11) % 7),
      amount:  8  + ((i * 17) % 10),
    }
  })
}

function makeShell(radius: number, rotY = 0) {
  const phi = (1 + Math.sqrt(5)) / 2
  const norm = Math.sqrt(1 + phi * phi)
  const a = radius / norm
  const b = (radius * phi) / norm
  const cos = Math.cos((rotY * Math.PI) / 180)
  const sin = Math.sin((rotY * Math.PI) / 180)
  return [
    { x:  0, y: -a, z: -b }, { x:  0, y:  a, z: -b },
    { x:  b, y:  0, z: -a }, { x: -b, y:  0, z: -a },
    { x:  a, y: -b, z:  0 }, { x: -a, y: -b, z:  0 },
    { x:  a, y:  b, z:  0 }, { x: -a, y:  b, z:  0 },
    { x:  b, y:  0, z:  a }, { x: -b, y:  0, z:  a },
    { x:  0, y: -a, z:  b }, { x:  0, y:  a, z:  b },
  ].map(v => ({
    x: Math.round(v.x * cos - v.z * sin),
    y: Math.round(v.y),
    z: Math.round(v.x * sin + v.z * cos),
  }))
}

const INNER_RING = [
  { x: -420, y:   0, z: -470 },
  { x:   40, y:   0, z: -730 },
  { x:  460, y:   0, z: -490 },
  { x:  -60, y: -380, z: -560 },
  { x:   80, y:  360, z: -540 },
  { x: -540, y: -230, z: -440 },
  { x:  520, y:  250, z: -460 },
  { x: -560, y:  220, z: -430 },
  { x:  500, y: -260, z: -450 },
  { x: -720, y:   30, z: -300 },
  { x:  710, y:  -40, z: -310 },
  { x:    0, y:   10, z:  660 },
]

const POSITIONS = [
  ...INNER_RING,
  ...makeShell(1100, 15),
  ...makeShell(1700, 51),
  ...makeShell(2300, 33),
  ...makeShell(2900, 18),
]

// CARDS is built per-mount from live data now (see buildCards above) since it
// depends on localStorage, which doesn't exist at module-eval time.

const PATTERNS: Record<PatternType, React.CSSProperties> = {
  dots: {
    backgroundImage: "radial-gradient(circle, #ddd 1px, transparent 1px)",
    backgroundSize: "18px 18px",
  },
  grid: {
    backgroundImage:
      "linear-gradient(#e8e8e8 1px, transparent 1px), linear-gradient(90deg, #e8e8e8 1px, transparent 1px)",
    backgroundSize: "28px 28px",
  },
  rings: {
    backgroundImage: [
      "radial-gradient(circle, transparent 28px, #e0e0e0 29px, transparent 30px)",
      "radial-gradient(circle, transparent 50px, #e0e0e0 51px, transparent 52px)",
      "radial-gradient(circle, transparent 72px, #e0e0e0 73px, transparent 74px)",
    ].join(", "),
  },
  code: {
    backgroundImage:
      "repeating-linear-gradient(0deg, transparent, transparent 19px, #e8e8e8 19px, #e8e8e8 20px)",
  },
}

export default function FloatingScene() {
  const sceneRef      = useRef<HTMLDivElement>(null)
  const worldRef      = useRef<HTMLDivElement>(null)
  const anchorRefs    = useRef<(HTMLDivElement | null)[]>([])
  const floatRefs     = useRef<(HTMLDivElement | null)[]>([])
  const thumbInputRefs = useRef<(HTMLInputElement | null)[]>([])
  const isNavigating  = useRef(false)
  const router        = useRouter()

  // ── Cards — built from live project data, not a hardcoded list ───────────
  const cardsBuilt = useRef(false)
  const [cards, setCards] = useState<CardDef[] | null>(null)

  // ── Thumbnails (card background images) ──────────────────────────────────
  const [thumbs, setThumbs] = useState<Record<string, string>>({})

  // ── Card titles/tags — overridden by whatever's on the project's own page ─
  const [cardTitles, setCardTitles] = useState<Record<string, string>>({})
  const [cardTags, setCardTags] = useState<Record<string, string>>({})

  useEffect(() => {
    const liveCards = buildCards(readLiveProjects())
    setCards(liveCards)

    const loadedThumbs: Record<string, string> = {}
    const loadedTitles: Record<string, string> = {}
    const loadedTags: Record<string, string> = {}
    liveCards.forEach(c => {
      // fall back to a project's ORIGINAL default slug (graphite, peri-ai, sixth,
      // drift) for thumbnails/overrides saved before a label edit drifted its
      // slug — so a rename never makes an already-uploaded thumbnail vanish
      const legacy = legacySlugFor(c.id)
      const thumb = localStorage.getItem(`portfolio-card-thumb-${c.id}`)
        ?? (legacy ? localStorage.getItem(`portfolio-card-thumb-${legacy}`) : null)
      if (thumb) loadedThumbs[c.id] = thumb

      const proj = localStorage.getItem(`portfolio-project-${c.id}`)
        ?? (legacy ? localStorage.getItem(`portfolio-project-${legacy}`) : null)
      if (proj) {
        try {
          const p = JSON.parse(proj)
          if (p.title) loadedTitles[c.id] = p.title
          if (p.tag) loadedTags[c.id] = p.tag
        } catch {}
      }
    })
    setThumbs(loadedThumbs)
    setCardTitles(loadedTitles)
    setCardTags(loadedTags)

    // Live-sync if user edits title/tag in another tab
    const onStorage = (e: StorageEvent) => {
      if (e.key?.startsWith("portfolio-project-") && e.newValue) {
        try {
          const slug = e.key.replace("portfolio-project-", "")
          const p = JSON.parse(e.newValue)
          if (p.title) setCardTitles(prev => ({ ...prev, [slug]: p.title }))
          if (p.tag) setCardTags(prev => ({ ...prev, [slug]: p.tag }))
        } catch {}
      }
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  const setThumb = (id: string, src: string) => {
    localStorage.setItem(`portfolio-card-thumb-${id}`, src)
    setThumbs(prev => ({ ...prev, [id]: src }))
  }

  // ── 3D scene ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!cards || cardsBuilt.current) return
    if (!sceneRef.current || !worldRef.current) return
    cardsBuilt.current = true

    const ctx = gsap.context(() => {
      anchorRefs.current.forEach((anchor, i) => {
        if (!anchor) return
        const c = cards[i]
        gsap.set(anchor, {
          xPercent: -50, yPercent: -50,
          x: c.x, y: c.y, z: c.z,
          rotateY: 0, rotateZ: 0,
        })
        anchor.style.opacity = "0"
        gsap.from(anchor, { z: c.z - 220, duration: 1.4, delay: 0.04 + i * 0.018, ease: "power3.out" })
      })

      floatRefs.current.forEach((floater, i) => {
        if (!floater) return
        const c = cards[i]
        gsap.fromTo(floater,
          { y: -c.amount / 2 },
          { y: c.amount / 2, duration: c.speed, ease: "sine.inOut", yoyo: true, repeat: -1, delay: (i % 5) * 0.4 }
        )
      })

      const world  = worldRef.current!
      const camera = { yaw: 0, z: -1500 }
      const vel    = { yaw: 0, z: 0 }
      const keys   = { left: false, right: false, up: false, down: false }

      gsap.set(world, { z: camera.z })
      gsap.to(camera, {
        z: 0, duration: 3.2, delay: 0.2, ease: "power3.out",
        onUpdate: () => gsap.set(world, { rotationY: camera.yaw, z: camera.z }),
      })

      const ROT_ACCEL  = 0.06
      const MOVE_ACCEL = 0.8
      const FRICTION   = 0.92
      const Z_MIN = -2200
      const Z_MAX =  2200

      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === "ArrowLeft")  { keys.left  = true }
        if (e.key === "ArrowRight") { keys.right = true }
        if (e.key === "ArrowUp")    { keys.up    = true; e.preventDefault() }
        if (e.key === "ArrowDown")  { keys.down  = true; e.preventDefault() }
      }
      const onKeyUp = (e: KeyboardEvent) => {
        if (e.key === "ArrowLeft")  keys.left  = false
        if (e.key === "ArrowRight") keys.right = false
        if (e.key === "ArrowUp")    keys.up    = false
        if (e.key === "ArrowDown")  keys.down  = false
      }
      const onBlur = () => { keys.left = keys.right = keys.up = keys.down = false }

      const onWheel = (e: WheelEvent) => {
        e.preventDefault()
        vel.yaw += e.deltaX * 0.025
        vel.z   -= e.deltaY * 0.45
      }

      const entryStart = gsap.ticker.time

      const tick = () => {
        if (keys.left)  vel.yaw -= ROT_ACCEL
        if (keys.right) vel.yaw += ROT_ACCEL
        if (keys.up)    vel.z   += MOVE_ACCEL
        if (keys.down)  vel.z   -= MOVE_ACCEL

        vel.yaw *= FRICTION
        vel.z   *= FRICTION
        camera.yaw += vel.yaw
        camera.z   += vel.z

        if (camera.z > Z_MAX) { camera.z = Z_MAX; vel.z = 0 }
        if (camera.z < Z_MIN) { camera.z = Z_MIN; vel.z = 0 }

        gsap.set(world, { rotationY: camera.yaw, z: camera.z })

        // ── Billboard: every card always faces the viewer ─────────────────
        anchorRefs.current.forEach(anchor => {
          if (anchor) gsap.set(anchor, { rotateY: -camera.yaw })
        })

        if (!isNavigating.current) {
          const elapsed = (gsap.ticker.time - entryStart) * 1000
          for (let i = 0; i < cards.length; i++) {
            const anchor = anchorRefs.current[i]
            if (!anchor) continue
            const c = cards[i]
            const t = Math.min(1, Math.max(0, (elapsed - (40 + i * 18)) / 1400))
            const entry = 1 - Math.pow(1 - t, 3)
            const dz   = c.z + camera.z
            const dist = Math.sqrt(c.x * c.x + c.y * c.y + dz * dz)
            // Fog: min 0.15 so all cards stay visible
            const fog  = Math.max(0.15, Math.min(1, 1.4 - dist / 1800))
            anchor.style.opacity = (fog * entry).toFixed(3)
          }
        }
      }

      gsap.ticker.add(tick)
      window.addEventListener("keydown", onKeyDown)
      window.addEventListener("keyup",   onKeyUp)
      window.addEventListener("blur",    onBlur)
      sceneRef.current!.addEventListener("wheel", onWheel, { passive: false })

      return () => {
        gsap.ticker.remove(tick)
        window.removeEventListener("keydown", onKeyDown)
        window.removeEventListener("keyup",   onKeyUp)
        window.removeEventListener("blur",    onBlur)
        sceneRef.current?.removeEventListener("wheel", onWheel)
      }
    }, sceneRef)

    return () => ctx.revert()
  }, [cards])

  const handleClick = (id: string, index: number) => {
    if (!anchorRefs.current[index] || isNavigating.current) return
    isNavigating.current = true
    const anchor = anchorRefs.current[index]!
    anchorRefs.current.forEach((a, i) => {
      if (a && i !== index) gsap.to(a, { opacity: 0, duration: 0.35 })
    })
    gsap.to(anchor, {
      z: 600, opacity: 0, duration: 0.5, ease: "power2.in",
      onComplete: () => router.push(`/projects/${id}`),
    })
  }

  const handleThumbChange = (id: string, index: number, file: File) => {
    const r = new FileReader()
    r.onload = () => setThumb(id, r.result as string)
    r.readAsDataURL(file)
  }

  return (
    <div
      ref={sceneRef}
      style={{
        position: "fixed", inset: 0,
        background: "radial-gradient(ellipse 150% 100% at 50% 50%, #1a1d2a 0%, #0e0f18 45%, #080810 100%)",
        perspective: "1500px", perspectiveOrigin: "50% 50%",
        overflow: "hidden",
      }}
    >
      <Link href="/" style={{
        position: "absolute", top: 32, left: 40, zIndex: 100,
        color: "rgba(255,255,255,0.45)", fontSize: 11,
        letterSpacing: "0.22em", textTransform: "uppercase",
        textDecoration: "none", transition: "color 0.2s",
      }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.9)"}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.45)"}
      >
        Izzy Shen
      </Link>

      <p style={{
        position: "absolute", top: 32, right: 40, zIndex: 100, margin: 0,
        color: "rgba(255,255,255,0.25)", fontSize: 10,
        letterSpacing: "0.18em", fontFamily: "monospace", pointerEvents: "none",
      }}>
        {POSITIONS.length} projects // drift
      </p>

      <div style={{
        position: "absolute", bottom: 28, left: "50%",
        transform: "translateX(-50%)", zIndex: 100,
        display: "flex", gap: 28, alignItems: "center",
        color: "rgba(255,255,255,0.28)", fontSize: 10,
        letterSpacing: "0.2em", fontFamily: "monospace",
        textTransform: "uppercase", pointerEvents: "none", whiteSpace: "nowrap",
      }}>
        <span>swipe or ← → &nbsp; rotate</span>
        <span>swipe or ↑ ↓ &nbsp; move</span>
      </div>

      {/* Vignette */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", zIndex: 50,
        background: "radial-gradient(ellipse at center, transparent 30%, rgba(8,8,16,0.92) 100%)",
      }} />

      {/* 3D World */}
      <div ref={worldRef} style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d" }}>
        {(cards ?? []).map((c, i) => (
          <div
            key={i}
            ref={el => { anchorRefs.current[i] = el }}
            style={{ position: "absolute", left: "50%", top: "50%", transformStyle: "preserve-3d", willChange: "transform, opacity" }}
          >
            <div ref={el => { floatRefs.current[i] = el }} style={{ transformStyle: "preserve-3d" }}>

              {/* ── Card ─────────────────────────────────────────────── */}
              <div
                onClick={() => handleClick(c.id, i)}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = "#aaa"
                  const btn = (e.currentTarget as HTMLElement).querySelector<HTMLElement>(".thumb-btn")
                  if (btn) btn.style.opacity = "1"
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = "#ddd"
                  const btn = (e.currentTarget as HTMLElement).querySelector<HTMLElement>(".thumb-btn")
                  if (btn) btn.style.opacity = "0.25"
                }}
                style={{
                  width: c.width, height: c.height,
                  background: thumbs[c.id] ? "transparent" : "#ffffff",
                  ...(thumbs[c.id]
                    ? { backgroundImage: `url(${thumbs[c.id]})`, backgroundSize: "cover", backgroundPosition: "center" }
                    : PATTERNS[c.pattern]),
                  border: "1px solid #ddd",
                  position: "relative", overflow: "hidden", cursor: "pointer",
                  transition: "border-color 0.3s ease",
                }}
              >
                {/* Corner accents */}
                <div style={{ position: "absolute", top: 0, right: 0, width: 10, height: 10, borderTop: "1px solid rgba(0,0,0,0.1)", borderRight: "1px solid rgba(0,0,0,0.1)" }} />
                <div style={{ position: "absolute", bottom: 0, left: 0, width: 10, height: 10, borderBottom: "1px solid rgba(0,0,0,0.1)", borderLeft: "1px solid rgba(0,0,0,0.1)" }} />

                {/* Card number */}
                <p style={{ position: "absolute", top: 8, left: 10, margin: 0, color: "rgba(0,0,0,0.2)", fontSize: 9, fontFamily: "monospace", letterSpacing: "0.1em" }}>
                  {String(i + 1).padStart(2, "0")}
                </p>

                {/* Thumbnail edit button */}
                <button
                  className="thumb-btn"
                  onClick={e => { e.stopPropagation(); thumbInputRefs.current[i]?.click() }}
                  style={{
                    position: "absolute", top: 6, right: 6,
                    background: "rgba(0,0,0,0.45)", border: "none",
                    color: "#fff", fontSize: 8, padding: "3px 7px",
                    cursor: "pointer", opacity: 0.25,
                    letterSpacing: "0.12em", transition: "opacity 0.2s",
                    pointerEvents: "all",
                  }}
                >
                  ⊕ IMG
                </button>

                {/* Title + tag */}
                <div style={{
                  position: "absolute", bottom: 0, left: 0, right: 0,
                  padding: "8px 10px",
                  background: thumbs[c.id] ? "rgba(255,255,255,0.88)" : "transparent",
                }}>
                  <p style={{ margin: 0, color: "rgba(0,0,0,0.35)", fontSize: 9, letterSpacing: "0.15em", fontFamily: "monospace", marginBottom: 3 }}>
                    {cardTags[c.id] ? `// ${cardTags[c.id]}` : c.tag}
                  </p>
                  <p style={{ margin: 0, color: "rgba(0,0,0,0.75)", fontSize: 12, letterSpacing: "0.04em" }}>
                    {cardTitles[c.id] || c.title}
                  </p>
                </div>
              </div>

              {/* Hidden file input for thumbnail */}
              <input
                ref={el => { thumbInputRefs.current[i] = el }}
                type="file" accept="image/*" style={{ display: "none" }}
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) handleThumbChange(c.id, i, f)
                  e.target.value = ""
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
