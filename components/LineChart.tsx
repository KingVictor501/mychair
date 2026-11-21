// components/LineChart.tsx
// WHAT IT'S FOR: a small line chart drawn with plain SVG (no chart package). Shows one or two
// lines over time, with a hover crosshair and tooltip, a legend when there are two lines, and
// a "Show as table" view so the numbers can be read without the colors.
// WHO USES IT: components/MetricsDashboard.tsx (the /metrics page).
// WHY THE NAME: it draws a "line chart"; ".tsx" = screen code.

"use client";

import { useState, type MouseEvent } from "react";

// One line on the chart. "color" is a CSS color, normally a theme token like var(--color-series-1).
export type Series = { name: string; color: string; values: Array<number | null> };

type Props = {
  title: string;
  times: string[]; // ISO times, one per point, oldest first
  series: Series[];
  formatValue: (value: number) => string; // how numbers read on the axis and in the tooltip
  formatTime: (iso: string) => string; // how times read on the axis and in the tooltip
};

// The drawing area, in SVG units. The SVG scales to the width of its box.
const W = 600;
const H = 180;
const PAD = { top: 12, right: 12, bottom: 24, left: 48 };

// Draws the chart. Gaps (null values) break the line instead of being drawn as zero.
export default function LineChart({ title, times, series, formatValue, formatTime }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const count = times.length;

  // The highest value decides the top of the y-axis (at least 1, so an all-zero chart still draws).
  const max = Math.max(1, ...series.flatMap((s) => s.values.filter((v): v is number => v !== null)));
  const x = (i: number) => PAD.left + (count <= 1 ? 0 : (i / (count - 1)) * (W - PAD.left - PAD.right));
  const y = (v: number) => PAD.top + (1 - v / max) * (H - PAD.top - PAD.bottom);

  // Builds the SVG path for one line, lifting the pen at gaps.
  const pathFor = (values: Array<number | null>) => {
    let d = "";
    let penDown = false;
    values.forEach((v, i) => {
      if (v === null) {
        penDown = false;
        return;
      }
      d += `${penDown ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      penDown = true;
    });
    return d;
  };

  // Finds the point nearest the mouse, for the crosshair and tooltip.
  const onMove = (event: MouseEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const svgX = ((event.clientX - box.left) / box.width) * W;
    const i = Math.round(((svgX - PAD.left) / (W - PAD.left - PAD.right)) * (count - 1));
    setHover(Math.min(count - 1, Math.max(0, i)));
  };

  const ticks = [0, max / 2, max];
  const timeLabels = count > 0 ? [0, Math.floor((count - 1) / 2), count - 1] : [];

  return (
    <figure className="rounded-lg border border-border bg-bg p-3">
      <figcaption className="mb-1 flex flex-wrap items-center justify-between gap-2 text-sm font-semibold text-text">
        <span>{title}</span>
        {series.length > 1 && (
          <span className="flex gap-3 text-xs font-normal text-text-muted">
            {series.map((s) => (
              <span key={s.name} className="flex items-center gap-1">
                <span aria-hidden className="inline-block h-0.5 w-4 rounded" style={{ background: s.color }} />
                {s.name}
              </span>
            ))}
          </span>
        )}
      </figcaption>

      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full touch-none"
          role="img"
          aria-label={`${title}. Use "Show as table" below to read the values.`}
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        >
          {/* Grid lines and y-axis labels: kept light so the data stands out. */}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--color-border)" strokeWidth={1} />
              <text x={PAD.left - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--color-text-muted)">
                {formatValue(t)}
              </text>
            </g>
          ))}
          {/* Time labels: first, middle and last. */}
          {timeLabels.map((i, n) => (
            <text
              key={i}
              x={x(i)}
              y={H - 6}
              textAnchor={n === 0 ? "start" : n === 2 ? "end" : "middle"}
              fontSize={11}
              fill="var(--color-text-muted)"
            >
              {formatTime(times[i] ?? "")}
            </text>
          ))}
          {/* The lines. */}
          {series.map((s) => (
            <path key={s.name} d={pathFor(s.values)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {/* Hover crosshair and points. */}
          {hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--color-text-muted)" strokeWidth={1} />
              {series.map((s) => {
                const v = s.values[hover];
                return v === null || v === undefined ? null : (
                  <circle key={s.name} cx={x(hover)} cy={y(v)} r={4} fill={s.color} stroke="var(--color-bg)" strokeWidth={2} />
                );
              })}
            </g>
          )}
        </svg>

        {hover !== null && (
          <div
            className="pointer-events-none absolute top-0 rounded border border-border bg-bg px-2 py-1 text-xs text-text shadow-sm"
            style={{ left: `${(x(hover) / W) * 100}%`, transform: hover > count / 2 ? "translateX(-105%)" : "translateX(5%)" }}
          >
            <div className="font-semibold">{formatTime(times[hover] ?? "")}</div>
            {series.map((s) => {
              const v = s.values[hover];
              return (
                <div key={s.name} className="flex items-center gap-1">
                  <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: s.color }} />
                  {series.length > 1 ? `${s.name}: ` : ""}
                  {v === null || v === undefined ? "no requests" : formatValue(v)}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* The same numbers as a table, for screen readers and anyone who can't tell the colors apart. */}
      <details className="mt-1 text-xs text-text-muted">
        <summary className="cursor-pointer">Show as table</summary>
        <div className="max-h-48 overflow-auto">
          <table className="mt-1 w-full text-left">
            <thead>
              <tr>
                <th className="pr-2">Time</th>
                {series.map((s) => (
                  <th key={s.name} className="pr-2">{s.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {times.map((t, i) => (
                <tr key={t}>
                  <td className="pr-2">{formatTime(t)}</td>
                  {series.map((s) => {
                    const v = s.values[i];
                    return <td key={s.name} className="pr-2">{v === null || v === undefined ? "–" : formatValue(v)}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
