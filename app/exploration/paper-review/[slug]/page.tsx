import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { getPaperReview, PAPER_REVIEWS, type ReviewPoint } from "@/content/paperReviews"

interface Props { params: Promise<{ slug: string }> }

export function generateStaticParams() {
  return PAPER_REVIEWS.map(paper => ({ slug: paper.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const paper = getPaperReview((await params).slug)
  return paper ? { title: `${paper.name} review · Izzy Shen`, description: paper.description } : {}
}

function ReviewSection({ id, title, points }: { id: string; title: string; points: ReviewPoint[] }) {
  return (
    <section id={id} className="paper-section">
      <h2>{title}</h2>
      <div className="paper-points">
        {points.map(point => (
          <div key={point.title}>
            <h3>{point.title}</h3>
            <p>{point.body}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

export default async function PaperReviewArticle({ params }: Props) {
  const paper = getPaperReview((await params).slug)
  if (!paper) notFound()
  const otherPapers = PAPER_REVIEWS.filter(item => item.slug !== paper.slug)

  return (
    <main className="paper-page">
      <article className="paper-article">
        <Link href="/exploration/paper-review" className="paper-back">← All reviews</Link>
        <header className="paper-article-header">
          <p className="paper-eyebrow">{paper.theme} · {paper.venue} {paper.year}</p>
          <h1>{paper.name}</h1>
          <p className="paper-title">{paper.title}</p>
          <div className="paper-byline">
            <span>{paper.authors}</span>
            <span>{paper.lab}</span>
            <span>Reviewed <time dateTime={paper.reviewed}>{new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(paper.reviewed))}</time></span>
          </div>
        </header>

        <section className="paper-question" aria-label="Research question">
          <p className="paper-eyebrow">The question</p>
          <p>{paper.question}</p>
        </section>

        <div className="paper-stats" aria-label="Reported results">
          {paper.stats.map(stat => (
            <div key={stat.label}>
              <span className="paper-stat-value">{stat.value}</span>
              <span className="paper-stat-label">{stat.label}</span>
            </div>
          ))}
        </div>
        <p className="paper-results-note">Results reported in the paper’s evaluation. Metrics across different papers are not directly comparable.</p>

        <nav className="paper-section-nav" aria-label="Review sections">
          <a href="#summary">Summary</a>
          <a href="#strengths">Strengths</a>
          <a href="#weaknesses">Weaknesses</a>
          <a href="#suggestions">Suggestions</a>
        </nav>

        <section id="summary" className="paper-section">
          <h2>Summary</h2>
          {paper.summary.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
        </section>
        <ReviewSection id="strengths" title="Strengths" points={paper.strengths} />
        <ReviewSection id="weaknesses" title="Weaknesses" points={paper.weaknesses} />
        <ReviewSection id="suggestions" title="Suggestions" points={paper.suggestions} />

        <section className="paper-takeaway" aria-label="My take">
          <p className="paper-eyebrow">My take</p>
          <p>{paper.takeaway}</p>
        </section>

        <section className="paper-sources" aria-label="Sources">
          <h2>Read the research</h2>
          {paper.sources.map(source => source.url.startsWith("/") ? (
            <Link key={source.url} href={source.url}>{source.title} <span aria-hidden="true">→</span></Link>
          ) : (
            <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">{source.title} <span aria-hidden="true">↗</span></a>
          ))}
        </section>

        <nav className="paper-more" aria-label="More reviews">
          <p className="paper-eyebrow">Keep reading</p>
          {otherPapers.map(other => (
            <Link key={other.slug} href={`/exploration/paper-review/${other.slug}`}>
              <span>{other.name}</span><span aria-hidden="true">→</span>
            </Link>
          ))}
        </nav>
      </article>
    </main>
  )
}
