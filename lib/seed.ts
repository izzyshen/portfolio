/**
 * Baked-in site content. content/seed.json is generated from a browser export
 * by scripts/import-export.py and is what every visitor sees; anything saved in
 * this browser's localStorage (edit mode, see lib/editMode.ts) overrides it.
 */
import seed from "@/content/seed.json"

type Json = Record<string, unknown>
interface SeedFile {
  home: Json | null
  projects: Record<string, Json>
  articles: Record<string, Json>
  galleries?: Record<string, Json>
}

const SEED = seed as unknown as SeedFile

export function seedHome<T>(): T | null {
  return (SEED.home as T | null) ?? null
}

export function seedProject(slug: string): unknown {
  return SEED.projects[slug] ?? null
}

export function seedArticle(slug: string): unknown {
  return SEED.articles[slug] ?? null
}

export function seedGallery(slug: string): unknown {
  return SEED.galleries?.[slug] ?? null
}

/** Serialize content for localStorage, stamped with when it was saved. */
export function stamp(content: unknown): string {
  return JSON.stringify({ ...(content as Json), _savedAt: new Date().toISOString() })
}

/**
 * Newest wins: a local copy saved in this browser normally overrides the
 * published seed, but a seed published AFTER that local save replaces it —
 * otherwise a page once clicked into (blog posts are always editable) would
 * pin its owner to a stale copy forever. Returns the parsed content to use.
 */
export function pickContent(raw: string | null, seed: unknown): unknown {
  let local: Json | null = null
  try { local = raw ? (JSON.parse(raw) as Json) : null } catch { local = null }
  if (!local) return seed
  if (!seed) return local
  const seededAt = (seed as Json)._seededAt
  const savedAt = local._savedAt
  if (typeof seededAt !== "string") return local
  if (typeof savedAt !== "string" || seededAt > savedAt) return seed
  return local
}

/** The "Previous Projects" rows from the seeded landing page. */
export function seedProjectList(): { title: string; slug: string }[] {
  const sections = (SEED.home?.sections ?? []) as { isProjects?: boolean; items: { label: string; slug?: string }[] }[]
  const sec = sections.find(s => s.isProjects)
  if (!sec) return []
  const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "untitled"
  return sec.items.filter(it => it.label.trim()).map(it => ({ title: it.label, slug: it.slug ?? slugify(it.label) }))
}
