import Link from "next/link"
import { PAPER_REVIEWS } from "@/content/paperReviews"

export default function PaperReviewIndex() {
  return (
    <main className="paper-page">
      <div className="paper-index">
        <Link href="/" className="paper-back">← Back</Link>
        <header className="paper-index-header">
          <p className="paper-eyebrow">Reading notes · 4 papers</p>
          <h1>Paper Review</h1>
          <p className="paper-intro">Sensing beyond cameras.</p>
          <p className="paper-description">Notes on radar, room acoustics, and hidden geometry. What each paper makes possible, where it falls short, and what I’d test next.</p>
        </header>

        <div className="paper-grid">
          {PAPER_REVIEWS.map(paper => (
            <Link key={paper.slug} href={`/exploration/paper-review/${paper.slug}`} className="paper-card" aria-label={`Read ${paper.name} review`}>
              <div className="paper-card-copy">
                <p className="paper-card-lab">{paper.lab}</p>
                <h2>{paper.name}</h2>
                <p>{paper.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}
