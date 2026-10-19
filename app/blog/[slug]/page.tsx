import ArticleTemplate from "@/components/ArticleTemplate"
import { notFound } from "next/navigation"

interface Props {
  params: Promise<{ slug: string }>
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params
  if (slug === "creative-paradigm-in-ai-era") notFound()
  return <ArticleTemplate slug={slug} />
}
