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

/** The "Previous Projects" rows from the seeded landing page. */
export function seedProjectList(): { title: string; slug: string }[] {
  const sections = (SEED.home?.sections ?? []) as { isProjects?: boolean; items: { label: string; slug?: string }[] }[]
  const sec = sections.find(s => s.isProjects)
  if (!sec) return []
  const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "untitled"
  return sec.items.filter(it => it.label.trim()).map(it => ({ title: it.label, slug: it.slug ?? slugify(it.label) }))
}
