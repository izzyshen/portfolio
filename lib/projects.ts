import { seedProjectList } from "@/lib/seed"

export interface Project {
  title: string
  tag: string
  slug: string
}

/** Fallback project list (rails, the Drift space) — mirrors the seeded landing page. */
export const PROJECTS: Project[] = seedProjectList().map(p => ({ ...p, tag: "project" }))
