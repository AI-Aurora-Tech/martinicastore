interface Props {
  rating: number
  reviews?: number
}

export function StarRating({ rating, reviews }: Props) {
  const full = Math.round(rating)
  return (
    <div className="stars" aria-label={`Avaliação ${rating} de 5`}>
      <span className="stars__glyphs" aria-hidden="true">
        {'★★★★★'.slice(0, full)}
        <span className="stars__empty">{'★★★★★'.slice(full)}</span>
      </span>
      <span className="stars__value">{rating.toFixed(1)}</span>
      {reviews !== undefined && <span className="stars__reviews">({reviews})</span>}
    </div>
  )
}
