export type SeasonalityChartProps = {
  /** 52 weekly relative reporting rates in [0, 1]. */
  readonly weeks: readonly number[];
};

const CHART_WIDTH = 640;
const CHART_HEIGHT = 160;
const PAD_Y = 12;

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function padOrTrimWeeks(weeks: readonly number[]): number[] {
  const out = weeks.slice(0, 52).map((v) => clamp01(v));
  while (out.length < 52) {
    out.push(0);
  }
  return out;
}

function buildAreaPath(weeks: readonly number[], width: number, innerHeight: number): string {
  if (weeks.length === 0) {
    return '';
  }
  const last = weeks.length - 1;
  const coords = weeks.map((value, index) => {
    const x = last === 0 ? 0 : (index / last) * width;
    const y = PAD_Y + innerHeight * (1 - clamp01(value));
    return { x, y };
  });

  let d = `M 0 ${PAD_Y + innerHeight}`;
  for (const point of coords) {
    d += ` L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  }
  const lastPoint = coords[coords.length - 1];
  if (lastPoint !== undefined) {
    d += ` L ${lastPoint.x.toFixed(2)} ${PAD_Y + innerHeight} Z`;
  }
  return d;
}

/**
 * Region-level seasonality (US-05 / W-03): effort-normalised relative reporting rate.
 * SVG only — no map tiles, cells, or coordinates.
 */
export function SeasonalityChart({ weeks }: SeasonalityChartProps) {
  const points = padOrTrimWeeks(weeks);
  const innerHeight = CHART_HEIGHT - PAD_Y * 2;
  const path = buildAreaPath(points, CHART_WIDTH, innerHeight);

  return (
    <section
      className="space-y-3"
      data-testid="seasonality-chart"
      aria-labelledby="seasonality-heading"
    >
      <div>
        <h2
          id="seasonality-heading"
          className="font-[family-name:var(--font-fraunces)] text-2xl text-forest-800"
        >
          Seasonality
        </h2>
        <p className="mt-1 text-sm text-ink-muted" data-testid="seasonality-label">
          Relative reporting rate (effort-normalised) · region level
        </p>
      </div>
      <div className="overflow-hidden rounded-lg border border-forest-800/10 bg-mist/60 p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${String(CHART_WIDTH)} ${String(CHART_HEIGHT)}`}
          className="h-auto w-full"
          role="img"
          aria-label="Relative reporting rate across 52 weeks"
        >
          <line
            x1={0}
            y1={CHART_HEIGHT - PAD_Y}
            x2={CHART_WIDTH}
            y2={CHART_HEIGHT - PAD_Y}
            stroke="currentColor"
            strokeOpacity={0.2}
            strokeWidth={1}
            className="text-forest-800"
          />
          <path
            d={path}
            fill="currentColor"
            fillOpacity={0.28}
            stroke="currentColor"
            strokeWidth={1.5}
            className="text-forest-600"
          />
        </svg>
        <div className="mt-2 flex justify-between px-1 text-xs text-ink-muted">
          <span>Week 1</span>
          <span>Week 26</span>
          <span>Week 52</span>
        </div>
      </div>
    </section>
  );
}
