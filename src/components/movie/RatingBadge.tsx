'use client';

interface RatingBadgeProps {
  source: 'TMDB' | 'IMDb' | 'RT';
  value: string;
}

const sourceColors = {
  TMDB: 'bg-emerald-500',
  IMDb: 'bg-yellow-500',
  RT: 'bg-red-500',
};

export function RatingBadge({ source, value }: RatingBadgeProps) {
  return (
    <div className={`${sourceColors[source]} px-2 py-0.5 rounded-md flex items-center gap-1`}>
      <span className="text-xs font-bold text-white">{source}</span>
      <span className="text-xs text-white/90">{value}</span>
    </div>
  );
}
