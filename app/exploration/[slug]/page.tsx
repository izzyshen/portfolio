import GalleryTemplate from "@/components/GalleryTemplate"
import { permanentRedirect } from "next/navigation"

interface Props {
  params: Promise<{ slug: string }>
}

/** Paper Review has its own index and article routes; other exploration pages are galleries. */
export default async function ExplorationPage({ params }: Props) {
  const { slug } = await params
  if (slug === "art" || slug === "photography") permanentRedirect("/exploration/creatives")
  return <GalleryTemplate slug={slug} />
}
