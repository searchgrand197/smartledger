interface Props {
  count?: number;
}

export default function PartyCardSkeleton({ count = 10 }: Props) {
  return (
    <div className="party-skeleton-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="party-skeleton-card yt-shimmer-card" aria-hidden>
          <div className="party-skeleton-card__badge yt-shimmer-line" />
          <div className="party-skeleton-card__name yt-shimmer-line" />
          <div className="party-skeleton-card__code yt-shimmer-line" />
          <div className="party-skeleton-card__phone yt-shimmer-line" />
          <div className="party-skeleton-card__due yt-shimmer-line" />
        </div>
      ))}
    </div>
  );
}
