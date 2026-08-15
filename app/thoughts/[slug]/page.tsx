import ArticleTemplate from "@/components/ArticleTemplate"

interface Props {
  params: Promise<{ slug: string }>
}

export default async function ThoughtPage({ params }: Props) {
  const { slug } = await params
  return <ArticleTemplate slug={slug} />
}
