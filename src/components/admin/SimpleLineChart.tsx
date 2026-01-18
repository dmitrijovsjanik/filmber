'use client';

interface DataPoint {
  date: string;
  count: number;
}

interface SimpleLineChartProps {
  data: DataPoint[];
  height?: number;
}

export function SimpleLineChart({ data, height = 160 }: SimpleLineChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center text-sm text-muted-foreground" style={{ height }}>
        No data available
      </div>
    );
  }

  const maxValue = Math.max(...data.map((d) => d.count), 1);
  const minValue = Math.min(...data.map((d) => d.count));
  const range = maxValue - minValue || 1;

  // SVG dimensions
  const padding = { top: 10, right: 10, bottom: 30, left: 40 };
  const chartWidth = 100; // percentage
  const chartHeight = height - padding.top - padding.bottom;

  // Generate points for the line
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1 || 1)) * 100;
    const y = chartHeight - ((d.count - minValue) / range) * chartHeight + padding.top;
    return { x, y, ...d };
  });

  // Create SVG path for the line
  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x}% ${p.y}`)
    .join(' ');

  // Create area path (for gradient fill)
  const areaPath = `${linePath} L ${points[points.length - 1]?.x || 0}% ${chartHeight + padding.top} L 0% ${chartHeight + padding.top} Z`;

  // Y-axis labels
  const yLabels = [maxValue, Math.round((maxValue + minValue) / 2), minValue];

  // X-axis labels (show every 5th date or so)
  const xLabelInterval = Math.ceil(data.length / 6);
  const xLabels = data.filter((_, i) => i % xLabelInterval === 0 || i === data.length - 1);

  return (
    <div className="relative" style={{ height }}>
      {/* Y-axis labels */}
      <div className="absolute left-0 top-0 flex flex-col justify-between text-xs text-muted-foreground" style={{ height: chartHeight + padding.top, paddingTop: padding.top }}>
        {yLabels.map((label, i) => (
          <span key={i} className="w-8 text-right pr-2">{label}</span>
        ))}
      </div>

      {/* Chart area */}
      <div className="absolute" style={{ left: padding.left, right: padding.right, top: 0, bottom: padding.bottom }}>
        <svg
          className="w-full h-full overflow-visible"
          viewBox={`0 0 100 ${chartHeight + padding.top}`}
          preserveAspectRatio="none"
        >
          {/* Grid lines */}
          <g className="text-muted-foreground/20">
            {[0, 0.5, 1].map((ratio, i) => (
              <line
                key={i}
                x1="0%"
                y1={padding.top + chartHeight * ratio}
                x2="100%"
                y2={padding.top + chartHeight * ratio}
                stroke="currentColor"
                strokeDasharray="2,2"
              />
            ))}
          </g>

          {/* Area fill with gradient */}
          <defs>
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d={areaPath}
            fill="url(#areaGradient)"
          />

          {/* Line */}
          <path
            d={linePath}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />

          {/* Data points */}
          {points.map((p, i) => (
            <circle
              key={i}
              cx={`${p.x}%`}
              cy={p.y}
              r="3"
              fill="hsl(var(--background))"
              stroke="hsl(var(--primary))"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
              className="hover:r-4 transition-all"
            >
              <title>{`${p.date}: ${p.count}`}</title>
            </circle>
          ))}
        </svg>
      </div>

      {/* X-axis labels */}
      <div
        className="absolute flex justify-between text-xs text-muted-foreground"
        style={{ left: padding.left, right: padding.right, bottom: 0, height: padding.bottom }}
      >
        {xLabels.map((d, i) => (
          <span key={i} className="truncate">
            {d.date.slice(5)} {/* Show MM-DD */}
          </span>
        ))}
      </div>
    </div>
  );
}
