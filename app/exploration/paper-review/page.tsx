import type { Metadata } from "next"
import PaperReviewIndex from "@/components/PaperReviewIndex"

export const metadata: Metadata = {
  title: "Paper Review · Izzy Shen",
  description: "Four reviews on radar, room acoustics, and hidden geometry, with notes on strengths, limitations, and useful next experiments.",
}

export default function PaperReviewPage() {
  return <PaperReviewIndex />
}
