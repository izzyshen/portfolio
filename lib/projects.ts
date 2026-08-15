export interface Project {
  title: string
  tag: string
  slug: string
}

export const PROJECTS: Project[] = [
  { title: "Graphite", tag: "design system", slug: "graphite" },
  { title: "Peri.ai", tag: "ai", slug: "peri-ai" },
  { title: "Sixth", tag: "consumer", slug: "sixth" },
  { title: "Drift", tag: "web app", slug: "drift" },
]
