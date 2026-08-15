import ProjectTemplate from "@/components/ProjectTemplate"

interface Props {
  params: Promise<{ slug: string }>
}

export default async function ProjectPage({ params }: Props) {
  const { slug } = await params
  return <ProjectTemplate slug={slug} />
}
