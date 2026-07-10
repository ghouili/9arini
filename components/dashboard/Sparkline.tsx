// Sparkline — inline SVG area chart from number[]. No external libs.
// Amber stroke + soft amber fill. Designed to sit inside the .balance card.

type SparklineProps = {
  data: number[];
  width?: number;
  height?: number;
};

export function Sparkline({ data, width = 260, height = 60 }: SparklineProps) {
  if (!data || data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const pad = 4; // vertical padding so stroke is not clipped
  const plotH = height - pad * 2;
  const stepX = width / (data.length - 1);

  const toY = (v: number) => pad + plotH - ((v - min) / range) * plotH;

  const pts = data.map((v, i) => ({ x: i * stepX, y: toY(v) }));
  const strokePath = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const fillPath =
    strokePath +
    ` L ${pts[pts.length - 1].x} ${height} L 0 ${height} Z`;

  return (
    <div
      style={{
        height,
        position: "relative",
        zIndex: 2,
        margin: "14px 0 2px",
      }}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        style={{ width: "100%", height: "100%", overflow: "visible" }}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F3C24B" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#F3C24B" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* soft amber fill area */}
        <path d={fillPath} fill="url(#spark-fill)" />
        {/* amber stroke */}
        <path
          d={strokePath}
          fill="none"
          stroke="#F3C24B"
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* end-point dot */}
        <circle
          cx={pts[pts.length - 1].x}
          cy={pts[pts.length - 1].y}
          r="4"
          fill="#F3C24B"
        />
      </svg>
    </div>
  );
}
