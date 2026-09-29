import ArticleTemplate from "@/components/ArticleTemplate"
import GalleryTemplate from "@/components/GalleryTemplate"

interface Props {
  params: Promise<{ slug: string }>
}

/** Exploration pages: Paper Review is continuous writing; everything else is an image gallery. */
export default async function ExplorationPage({ params }: Props) {
  const { slug } = await params
  if (slug === "paper-review") return <ArticleTemplate slug={slug} />
  return <GalleryTemplate slug={slug} />
}
