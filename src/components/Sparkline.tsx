type SparklineProps = {
  data: number[];
  color?: string;
};

export function Sparkline({ data, color = "#00d4ff" }: SparklineProps) {
  const values = data.length > 1 ? data : [0, 1, 0.5, 1.4, 1.2, 1.8];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = values.length === 1 ? 0 : (index / (values.length - 1)) * 100;
      const y = 28 - ((value - min) / range) * 24;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg viewBox="0 0 100 32" role="img" aria-label="30 day disease trend" className="h-10 w-full">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.4"
      />
      <line x1="0" x2="100" y1="28" y2="28" stroke="rgba(122,141,160,0.22)" strokeWidth="1" />
    </svg>
  );
}
