import React from 'react';
import type { Round2ChartData } from '../../data/round2Questions';

interface GraphVisualizerProps {
  chartData: Round2ChartData;
}

export const GraphVisualizer: React.FC<GraphVisualizerProps> = ({ chartData }) => {
  const {
    type,
    title,
    labels = [],
    values = [],
    series,
    points = [],
    colors,
    yMin: customYMin,
    yMax: customYMax,
    xMin: customXMin,
    xMax: customXMax,
    xLabel,
    yLabel,
  } = chartData;

  const chartWidth = 580;
  const chartHeight = 260;
  const paddingLeft = 60;
  const paddingRight = 35;
  const paddingTop = 45;
  const paddingBottom = 45;
  const plotWidth = chartWidth - paddingLeft - paddingRight;
  const plotHeight = chartHeight - paddingTop - paddingBottom;

  const defaultPalette = ['#8E233B', '#64748B', '#F59E0B', '#22C55E', '#3B82F6', '#A855F7'];

  // 1. GROUPED BAR CHART RENDERER
  if (type === 'grouped-bar' && series && series.length > 0) {
    const allVals = series.flatMap((s) => s.values);
    const maxVal = customYMax !== undefined ? customYMax : Math.max(...allVals, 10);
    const minVal = customYMin !== undefined ? customYMin : Math.min(0, ...allVals);
    const range = maxVal - minVal || 1;
    const ticksCount = 4;
    const ticks = Array.from({ length: ticksCount + 1 }, (_, i) => {
      const val = minVal + (range / ticksCount) * i;
      return Number(val.toFixed(2));
    });

    const groupCount = labels.length;
    const seriesCount = series.length;
    const groupSlotWidth = plotWidth / groupCount;
    const barWidth = Math.min(32, (groupSlotWidth * 0.7) / seriesCount);
    const groupInnerWidth = barWidth * seriesCount + (seriesCount - 1) * 4;

    return (
      <div className="graph-render-wrapper">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="chart-svg"
          aria-label={title}
          role="img"
        >
          <rect x="0" y="0" width={chartWidth} height={chartHeight} fill="#202124" rx="6" stroke="#414047" />
          {/* Header */}
          <rect x="0" y="0" width={chartWidth} height="32" fill="#292A2E" rx="6" />
          <line x1="0" y1="32" x2={chartWidth} y2="32" stroke="#414047" strokeWidth="1" />
          <circle cx="16" cy="16" r="4" fill="#8E233B" />
          <circle cx="28" cy="16" r="4" fill="#F59E0B" />
          <circle cx="40" cy="16" r="4" fill="#22C55E" />
          <text x="56" y="20" fill="#F5F3F4" fontSize="11" fontFamily="'JetBrains Mono', monospace" fontWeight="700">
            {title.toUpperCase()}
          </text>

          {/* Legend */}
          <g transform={`translate(${chartWidth - paddingRight - seriesCount * 95}, 12)`}>
            {series.map((s, idx) => {
              const color = s.color || defaultPalette[idx % defaultPalette.length];
              return (
                <g key={`legend-${idx}`} transform={`translate(${idx * 95}, 0)`}>
                  <rect x="0" y="2" width="9" height="9" fill={color} rx="2" />
                  <text x="13" y="10" fill="#B8B2B7" fontSize="9.5" fontFamily="'JetBrains Mono', monospace" fontWeight="600">
                    {s.name.length > 11 ? `${s.name.slice(0, 10)}…` : s.name}
                  </text>
                </g>
              );
            })}
          </g>

          {/* Grid Lines & Y Ticks */}
          {ticks.map((tick, i) => {
            const y = paddingTop + plotHeight - ((tick - minVal) / range) * plotHeight;
            return (
              <g key={`tick-${i}`}>
                <line x1={paddingLeft} y1={y} x2={chartWidth - paddingRight} y2={y} stroke="#343238" strokeDasharray="3 3" />
                <text x={paddingLeft - 8} y={y + 3.5} textAnchor="end" fill="#B8B2B7" fontSize="10" fontFamily="'JetBrains Mono', monospace">
                  {tick}
                </text>
              </g>
            );
          })}

          {/* Baseline */}
          <line x1={paddingLeft} y1={paddingTop + plotHeight} x2={chartWidth - paddingRight} y2={paddingTop + plotHeight} stroke="#414047" strokeWidth="1.5" />

          {/* Bars */}
          {labels.map((label, gIdx) => {
            const groupXCenter = paddingLeft + gIdx * groupSlotWidth + groupSlotWidth / 2;
            const groupStartX = groupXCenter - groupInnerWidth / 2;

            return (
              <g key={`group-${gIdx}`}>
                {series.map((s, sIdx) => {
                  const val = s.values[gIdx] ?? 0;
                  const barH = Math.max(2, ((val - minVal) / range) * plotHeight);
                  const barX = groupStartX + sIdx * (barWidth + 4);
                  const barY = paddingTop + plotHeight - barH;
                  const color = s.color || defaultPalette[sIdx % defaultPalette.length];

                  return (
                    <g key={`bar-${gIdx}-${sIdx}`}>
                      <rect x={barX} y={barY} width={barWidth} height={barH} fill={color} rx="2.5" />
                      <rect x={barX} y={barY} width={barWidth} height="2.5" fill="#FFF" opacity="0.3" rx="1" />
                      <text
                        x={barX + barWidth / 2}
                        y={barY - 5}
                        textAnchor="middle"
                        fill="#F5F3F4"
                        fontSize="9.5"
                        fontFamily="'JetBrains Mono', monospace"
                        fontWeight="700"
                      >
                        {val}
                      </text>
                    </g>
                  );
                })}
                {/* Group label */}
                <text
                  x={groupXCenter}
                  y={chartHeight - 16}
                  textAnchor="middle"
                  fill="#B8B2B7"
                  fontSize="10.5"
                  fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                  fontWeight="600"
                >
                  {label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  }

  // 2. MULTI-LINE GRAPH RENDERER
  if (type === 'multi-line' && series && series.length > 0) {
    const allVals = series.flatMap((s) => s.values);
    const maxVal = customYMax !== undefined ? customYMax : Math.max(...allVals, 10);
    const minVal = customYMin !== undefined ? customYMin : Math.min(0, ...allVals);
    const range = maxVal - minVal || 1;
    const ticksCount = 4;
    const ticks = Array.from({ length: ticksCount + 1 }, (_, i) => {
      const val = minVal + (range / ticksCount) * i;
      return Number(val.toFixed(1));
    });

    const seriesCount = series.length;

    return (
      <div className="graph-render-wrapper">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="chart-svg"
          aria-label={title}
          role="img"
        >
          <rect x="0" y="0" width={chartWidth} height={chartHeight} fill="#202124" rx="6" stroke="#414047" />
          {/* Header */}
          <rect x="0" y="0" width={chartWidth} height="32" fill="#292A2E" rx="6" />
          <line x1="0" y1="32" x2={chartWidth} y2="32" stroke="#414047" strokeWidth="1" />
          <circle cx="16" cy="16" r="4" fill="#8E233B" />
          <circle cx="28" cy="16" r="4" fill="#F59E0B" />
          <circle cx="40" cy="16" r="4" fill="#22C55E" />
          <text x="56" y="20" fill="#F5F3F4" fontSize="11" fontFamily="'JetBrains Mono', monospace" fontWeight="700">
            {title.toUpperCase()}
          </text>

          {/* Legend */}
          <g transform={`translate(${chartWidth - paddingRight - seriesCount * 110}, 12)`}>
            {series.map((s, idx) => {
              const color = s.color || defaultPalette[idx % defaultPalette.length];
              return (
                <g key={`legend-${idx}`} transform={`translate(${idx * 110}, 0)`}>
                  <line x1="0" y1="6" x2="14" y2="6" stroke={color} strokeWidth="3" />
                  <circle cx="7" cy="6" r="3" fill={color} stroke="#FFF" strokeWidth="1" />
                  <text x="18" y="10" fill="#B8B2B7" fontSize="9.5" fontFamily="'JetBrains Mono', monospace" fontWeight="600">
                    {s.name.length > 14 ? `${s.name.slice(0, 13)}…` : s.name}
                  </text>
                </g>
              );
            })}
          </g>

          {/* Grid lines & Y ticks */}
          {ticks.map((tick, i) => {
            const y = paddingTop + plotHeight - ((tick - minVal) / range) * plotHeight;
            return (
              <g key={`tick-${i}`}>
                <line x1={paddingLeft} y1={y} x2={chartWidth - paddingRight} y2={y} stroke="#343238" strokeDasharray="3 3" />
                <text x={paddingLeft - 8} y={y + 3.5} textAnchor="end" fill="#B8B2B7" fontSize="10" fontFamily="'JetBrains Mono', monospace">
                  {tick}
                </text>
              </g>
            );
          })}

          {/* Baseline */}
          <line x1={paddingLeft} y1={paddingTop + plotHeight} x2={chartWidth - paddingRight} y2={paddingTop + plotHeight} stroke="#414047" strokeWidth="1.5" />

          {/* Series lines & points */}
          {series.map((s, sIdx) => {
            const color = s.color || defaultPalette[sIdx % defaultPalette.length];
            const pts = s.values.map((v, i) => {
              const x = paddingLeft + (i / (labels.length - 1)) * plotWidth;
              const y = paddingTop + plotHeight - ((v - minVal) / range) * plotHeight;
              return { x, y, val: v };
            });
            const pathD = pts.reduce((acc, pt, i) => (i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`), '');

            return (
              <g key={`series-${sIdx}`}>
                <path d={pathD} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                {pts.map((pt, pIdx) => (
                  <g key={`pt-${sIdx}-${pIdx}`}>
                    <circle cx={pt.x} cy={pt.y} r="5" fill={color} stroke="#FFFFFF" strokeWidth="1.5" />
                    <text
                      x={pt.x}
                      y={sIdx % 2 === 0 ? pt.y - 8 : pt.y + 16}
                      textAnchor="middle"
                      fill="#F5F3F4"
                      fontSize="9"
                      fontFamily="'JetBrains Mono', monospace"
                      fontWeight="700"
                    >
                      {pt.val}
                    </text>
                  </g>
                ))}
              </g>
            );
          })}

          {/* X Labels */}
          {labels.map((label, idx) => {
            const x = paddingLeft + (idx / (labels.length - 1)) * plotWidth;
            return (
              <text
                key={`xlabel-${idx}`}
                x={x}
                y={chartHeight - 16}
                textAnchor="middle"
                fill="#B8B2B7"
                fontSize="10.5"
                fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                fontWeight="600"
              >
                {label}
              </text>
            );
          })}
        </svg>
      </div>
    );
  }

  // 3. SCATTER PLOT RENDERER
  if (type === 'scatter') {
    const xVals = points.map((p) => p.x);
    const yVals = points.map((p) => p.y);
    const minX = customXMin !== undefined ? customXMin : Math.min(...xVals, 0);
    const maxX = customXMax !== undefined ? customXMax : Math.max(...xVals, 10);
    const minY = customYMin !== undefined ? customYMin : Math.min(...yVals, 0);
    const maxY = customYMax !== undefined ? customYMax : Math.max(...yVals, 10);
    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;

    const ticksXCount = 5;
    const ticksYCount = 4;
    const ticksX = Array.from({ length: ticksXCount + 1 }, (_, i) => minX + (rangeX / ticksXCount) * i);
    const ticksY = Array.from({ length: ticksYCount + 1 }, (_, i) => minY + (rangeY / ticksYCount) * i);

    return (
      <div className="graph-render-wrapper">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="chart-svg"
          aria-label={title}
          role="img"
        >
          <rect x="0" y="0" width={chartWidth} height={chartHeight} fill="#202124" rx="6" stroke="#414047" />
          {/* Header */}
          <rect x="0" y="0" width={chartWidth} height="32" fill="#292A2E" rx="6" />
          <line x1="0" y1="32" x2={chartWidth} y2="32" stroke="#414047" strokeWidth="1" />
          <circle cx="16" cy="16" r="4" fill="#8E233B" />
          <circle cx="28" cy="16" r="4" fill="#F59E0B" />
          <circle cx="40" cy="16" r="4" fill="#22C55E" />
          <text x="56" y="20" fill="#F5F3F4" fontSize="11" fontFamily="'JetBrains Mono', monospace" fontWeight="700">
            {title.toUpperCase()}
          </text>

          {/* Grid lines & Y ticks */}
          {ticksY.map((tick, i) => {
            const y = paddingTop + plotHeight - ((tick - minY) / rangeY) * plotHeight;
            return (
              <g key={`ytick-${i}`}>
                <line x1={paddingLeft} y1={y} x2={chartWidth - paddingRight} y2={y} stroke="#343238" strokeDasharray="3 3" />
                <text x={paddingLeft - 8} y={y + 3.5} textAnchor="end" fill="#B8B2B7" fontSize="10" fontFamily="'JetBrains Mono', monospace">
                  {Number(tick.toFixed(1))}
                </text>
              </g>
            );
          })}

          {/* X Grid lines & X ticks */}
          {ticksX.map((tick, i) => {
            const x = paddingLeft + ((tick - minX) / rangeX) * plotWidth;
            return (
              <g key={`xtick-${i}`}>
                <line x1={x} y1={paddingTop} x2={x} y2={paddingTop + plotHeight} stroke="#343238" strokeDasharray="2 3" opacity="0.6" />
                <text x={x} y={chartHeight - 16} textAnchor="middle" fill="#B8B2B7" fontSize="10" fontFamily="'JetBrains Mono', monospace">
                  {Number(tick.toFixed(1))}
                </text>
              </g>
            );
          })}

          {/* Axes */}
          <line x1={paddingLeft} y1={paddingTop + plotHeight} x2={chartWidth - paddingRight} y2={paddingTop + plotHeight} stroke="#414047" strokeWidth="1.5" />
          <line x1={paddingLeft} y1={paddingTop} x2={paddingLeft} y2={paddingTop + plotHeight} stroke="#414047" strokeWidth="1.5" />

          {/* Axis Labels */}
          {xLabel && (
            <text x={chartWidth / 2} y={chartHeight - 4} textAnchor="middle" fill="#8E233B" fontSize="9.5" fontFamily="'JetBrains Mono', monospace" fontWeight="700">
              {xLabel.toUpperCase()} →
            </text>
          )}
          {yLabel && (
            <text x={paddingLeft - 18} y={paddingTop - 6} textAnchor="middle" fill="#8E233B" fontSize="9.5" fontFamily="'JetBrains Mono', monospace" fontWeight="700">
              {yLabel}
            </text>
          )}

          {/* Points */}
          {points.map((pt, i) => {
            const cx = paddingLeft + ((pt.x - minX) / rangeX) * plotWidth;
            const cy = paddingTop + plotHeight - ((pt.y - minY) / rangeY) * plotHeight;
            const isOutlier = pt.isOutlier;
            const ptColor = isOutlier ? '#F59E0B' : '#8E233B';

            return (
              <g key={`scatter-pt-${i}`}>
                <circle cx={cx} cy={cy} r={isOutlier ? 10 : 7} fill={ptColor} opacity={isOutlier ? 0.35 : 0.25} />
                <circle cx={cx} cy={cy} r={isOutlier ? 6 : 4.5} fill={ptColor} stroke="#FFFFFF" strokeWidth="1.5" />
                {pt.label && (
                  <text
                    x={cx}
                    y={cy - 10}
                    textAnchor="middle"
                    fill={isOutlier ? '#F59E0B' : '#F5F3F4'}
                    fontSize="9.5"
                    fontFamily="'JetBrains Mono', monospace"
                    fontWeight="700"
                  >
                    {pt.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    );
  }

  // 4. BAR CHART RENDERER (Supports positive & negative values, truncated axes)
  if (type === 'bar') {
    const hasNegative = values.some((v) => v < 0);
    const rawMax = Math.max(...values, 0);
    const rawMin = Math.min(...values, 0);

    const yMax = customYMax !== undefined ? customYMax : hasNegative ? Math.max(Math.ceil(rawMax * 1.25 * 10) / 10, 0.5) : Math.max(Math.ceil((rawMax + 5) / 10) * 10, 10);
    const yMin = customYMin !== undefined ? customYMin : hasNegative ? Math.min(Math.floor(rawMin * 1.25 * 10) / 10, -0.5) : 0;
    const range = yMax - yMin || 1;

    const ticksCount = 4;
    const ticks = Array.from({ length: ticksCount + 1 }, (_, i) => {
      const v = yMin + (range / ticksCount) * i;
      return Number(v.toFixed(2));
    });

    const baselineY = paddingTop + plotHeight - ((0 - yMin) / range) * plotHeight;
    const boundedBaselineY = Math.max(paddingTop, Math.min(paddingTop + plotHeight, baselineY));

    const barSlotWidth = plotWidth / labels.length;
    const barWidth = Math.min(48, barSlotWidth * 0.58);
    const defaultColors = ['#8E233B', '#B94B68', '#F59E0B', '#22C55E', '#3B82F6', '#64748B'];

    return (
      <div className="graph-render-wrapper">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="chart-svg"
          aria-label={title}
          role="img"
        >
          <defs>
            <filter id="barShadowR2" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#8E233B" floodOpacity="0.25" />
            </filter>
          </defs>

          <rect x="0" y="0" width={chartWidth} height={chartHeight} fill="#202124" rx="6" stroke="#414047" />

          {/* Header Bar */}
          <rect x="0" y="0" width={chartWidth} height="32" fill="#292A2E" rx="6" />
          <line x1="0" y1="32" x2={chartWidth} y2="32" stroke="#414047" strokeWidth="1" />
          <circle cx="16" cy="16" r="4" fill="#8E233B" />
          <circle cx="28" cy="16" r="4" fill="#F59E0B" />
          <circle cx="40" cy="16" r="4" fill="#22C55E" />
          <text x="56" y="20" fill="#F5F3F4" fontSize="11" fontFamily="'JetBrains Mono', monospace" fontWeight="700">
            {title.toUpperCase()}
          </text>

          {/* Horizontal Grid lines */}
          {ticks.map((tick, i) => {
            const y = paddingTop + plotHeight - ((tick - yMin) / range) * plotHeight;
            return (
              <g key={`tick-${i}`}>
                <line x1={paddingLeft} y1={y} x2={chartWidth - paddingRight} y2={y} stroke="#343238" strokeDasharray="3 3" />
                <text x={paddingLeft - 8} y={y + 3.5} textAnchor="end" fill="#B8B2B7" fontSize="10" fontFamily="'JetBrains Mono', monospace">
                  {tick}
                </text>
              </g>
            );
          })}

          {/* Zero/Baseline */}
          <line
            x1={paddingLeft}
            y1={boundedBaselineY}
            x2={chartWidth - paddingRight}
            y2={boundedBaselineY}
            stroke="#414047"
            strokeWidth="1.5"
          />

          {/* Bars */}
          {labels.map((label, idx) => {
            const val = values[idx] ?? 0;
            const x = paddingLeft + idx * barSlotWidth + (barSlotWidth - barWidth) / 2;
            const barTopY = paddingTop + plotHeight - ((val - yMin) / range) * plotHeight;

            let rectY = barTopY;
            let barH = Math.abs(boundedBaselineY - barTopY);
            if (val < 0) {
              rectY = boundedBaselineY;
              barH = barTopY - boundedBaselineY;
            }

            const barColor = (colors && colors[idx]) || defaultColors[idx % defaultColors.length];

            return (
              <g key={`bar-${idx}`}>
                <rect
                  x={x}
                  y={rectY}
                  width={barWidth}
                  height={Math.max(2, barH)}
                  fill={barColor}
                  rx="3"
                  filter="url(#barShadowR2)"
                />
                <rect x={x} y={rectY} width={barWidth} height="2.5" fill="#FFF" opacity="0.3" rx="1" />
                {/* Value */}
                <text
                  x={x + barWidth / 2}
                  y={val >= 0 ? barTopY - 6 : barTopY + 14}
                  textAnchor="middle"
                  fill="#F5F3F4"
                  fontSize="10"
                  fontFamily="'JetBrains Mono', monospace"
                  fontWeight="700"
                >
                  {val}
                </text>
                {/* Label */}
                <text
                  x={x + barWidth / 2}
                  y={chartHeight - 16}
                  textAnchor="middle"
                  fill="#B8B2B7"
                  fontSize="10"
                  fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                  fontWeight="600"
                >
                  {label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  }

  // 5. LINE GRAPH RENDERER
  if (type === 'line') {
    const rawMax = Math.max(...values, 10);
    const rawMin = Math.min(...values, 0);
    const yMax = customYMax !== undefined ? customYMax : Math.ceil((rawMax + 4) / 5) * 5;
    const yMin = customYMin !== undefined ? customYMin : (rawMin < 0 ? rawMin : 0);
    const range = yMax - yMin || 1;

    const ticksCount = 4;
    const ticks = Array.from({ length: ticksCount + 1 }, (_, i) => {
      const v = yMin + (range / ticksCount) * i;
      return Number(v.toFixed(2));
    });

    const pts = values.map((val, idx) => {
      const x = paddingLeft + (idx / Math.max(1, values.length - 1)) * plotWidth;
      const y = paddingTop + plotHeight - ((val - yMin) / range) * plotHeight;
      return { x, y, val, label: labels[idx] };
    });

    const pathD = pts.reduce((acc, pt, idx) => (idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`), '');
    const areaD = `${pathD} L ${pts[pts.length - 1].x} ${paddingTop + plotHeight} L ${pts[0].x} ${paddingTop + plotHeight} Z`;

    return (
      <div className="graph-render-wrapper">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="chart-svg"
          aria-label={title}
          role="img"
        >
          <defs>
            <linearGradient id="lineAreaGradR2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8E233B" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#8E233B" stopOpacity="0.0" />
            </linearGradient>
            <filter id="lineGlowR2" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#8E233B" floodOpacity="0.4" />
            </filter>
          </defs>

          <rect x="0" y="0" width={chartWidth} height={chartHeight} fill="#202124" rx="6" stroke="#414047" />

          {/* Header */}
          <rect x="0" y="0" width={chartWidth} height="32" fill="#292A2E" rx="6" />
          <line x1="0" y1="32" x2={chartWidth} y2="32" stroke="#414047" strokeWidth="1" />
          <circle cx="16" cy="16" r="4" fill="#8E233B" />
          <circle cx="28" cy="16" r="4" fill="#F59E0B" />
          <circle cx="40" cy="16" r="4" fill="#22C55E" />
          <text x="56" y="20" fill="#F5F3F4" fontSize="11" fontFamily="'JetBrains Mono', monospace" fontWeight="700">
            {title.toUpperCase()}
          </text>

          {/* Grid lines */}
          {ticks.map((tick, i) => {
            const y = paddingTop + plotHeight - ((tick - yMin) / range) * plotHeight;
            return (
              <g key={`tick-${i}`}>
                <line x1={paddingLeft} y1={y} x2={chartWidth - paddingRight} y2={y} stroke="#343238" strokeDasharray="3 3" />
                <text x={paddingLeft - 8} y={y + 3.5} textAnchor="end" fill="#B8B2B7" fontSize="10" fontFamily="'JetBrains Mono', monospace">
                  {tick}
                </text>
              </g>
            );
          })}

          {/* Baseline */}
          <line x1={paddingLeft} y1={paddingTop + plotHeight} x2={chartWidth - paddingRight} y2={paddingTop + plotHeight} stroke="#414047" strokeWidth="1.5" />

          {/* Area & Stroke */}
          <path d={areaD} fill="url(#lineAreaGradR2)" />
          <path d={pathD} fill="none" stroke="#8E233B" strokeWidth="3" filter="url(#lineGlowR2)" strokeLinecap="round" strokeLinejoin="round" />

          {/* Points & Labels */}
          {pts.map((pt, idx) => (
            <g key={`pt-${idx}`}>
              <circle cx={pt.x} cy={pt.y} r="7" fill="#8E233B" opacity="0.25" />
              <circle cx={pt.x} cy={pt.y} r="4.5" fill="#B94B68" stroke="#FFFFFF" strokeWidth="1.5" />
              <rect x={pt.x - 14} y={pt.y - 23} width="28" height="15" fill="#292A2E" stroke="#8E233B" strokeWidth="1" rx="3" />
              <text x={pt.x} y={pt.y - 12} textAnchor="middle" fill="#F5F3F4" fontSize="9.5" fontFamily="'JetBrains Mono', monospace" fontWeight="700">
                {pt.val}
              </text>
              <text x={pt.x} y={chartHeight - 16} textAnchor="middle" fill="#B8B2B7" fontSize="10.5" fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" fontWeight="600">
                {pt.label}
              </text>
            </g>
          ))}
        </svg>
      </div>
    );
  }

  // 6. PIE / DONUT CHART RENDERER (Preserved for backwards compatibility)
  if (type === 'pie') {
    const total = values.reduce((sum, v) => sum + v, 0) || 1;
    const centerX = 160;
    const centerY = 145;
    const outerRadius = 75;
    const innerRadius = 40;
    const defaultColors = ['#8E233B', '#B94B68', '#F59E0B', '#22C55E'];

    const slices = values.map((val, idx) => {
      const priorValues = values.slice(0, idx).reduce((sum, v) => sum + v, 0);
      const startAngle = -Math.PI / 2 + (priorValues / total) * 2 * Math.PI;
      const fraction = val / total;
      const angle = fraction * 2 * Math.PI;
      const endAngle = startAngle + angle;

      const x1Outer = centerX + outerRadius * Math.cos(startAngle);
      const y1Outer = centerY + outerRadius * Math.sin(startAngle);
      const x2Outer = centerX + outerRadius * Math.cos(endAngle);
      const y2Outer = centerY + outerRadius * Math.sin(endAngle);

      const x1Inner = centerX + innerRadius * Math.cos(endAngle);
      const y1Inner = centerY + innerRadius * Math.sin(endAngle);
      const x2Inner = centerX + innerRadius * Math.cos(startAngle);
      const y2Inner = centerY + innerRadius * Math.sin(startAngle);

      const largeArcFlag = angle > Math.PI ? 1 : 0;
      const pathData = [
        `M ${x1Outer} ${y1Outer}`,
        `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${x2Outer} ${y2Outer}`,
        `L ${x1Inner} ${y1Inner}`,
        `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${x2Inner} ${y2Inner}`,
        'Z',
      ].join(' ');

      const sliceColor = (colors && colors[idx]) || defaultColors[idx % defaultColors.length];
      return { pathData, sliceColor, label: labels[idx], value: val };
    });

    return (
      <div className="graph-render-wrapper">
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="chart-svg" aria-label={title} role="img">
          <rect x="0" y="0" width={chartWidth} height={chartHeight} fill="#202124" rx="6" stroke="#414047" />
          <rect x="0" y="0" width={chartWidth} height="32" fill="#292A2E" rx="6" />
          <line x1="0" y1="32" x2={chartWidth} y2="32" stroke="#414047" strokeWidth="1" />
          <circle cx="16" cy="16" r="4" fill="#8E233B" />
          <circle cx="28" cy="16" r="4" fill="#F59E0B" />
          <circle cx="40" cy="16" r="4" fill="#22C55E" />
          <text x="56" y="20" fill="#F5F3F4" fontSize="11" fontFamily="'JetBrains Mono', monospace" fontWeight="700">
            {title.toUpperCase()}
          </text>

          {slices.map((slice, idx) => (
            <path key={`slice-${idx}`} d={slice.pathData} fill={slice.sliceColor} stroke="#202124" strokeWidth="2" />
          ))}

          <circle cx={centerX} cy={centerY} r={innerRadius - 1} fill="#202124" />
          <text x={centerX} y={centerY - 2} textAnchor="middle" fill="#F5F3F4" fontSize="12" fontFamily="'JetBrains Mono', monospace" fontWeight="800">
            100%
          </text>
          <text x={centerX} y={centerY + 12} textAnchor="middle" fill="#B8B2B7" fontSize="8" fontFamily="'JetBrains Mono', monospace">
            TOTAL SHARE
          </text>

          <g transform="translate(310, 56)">
            <rect x="0" y="0" width="235" height="170" fill="#292A2E" stroke="#414047" rx="4" />
            <text x="16" y="22" fill="#B8B2B7" fontSize="10" fontFamily="'JetBrains Mono', monospace" fontWeight="700">
              // CATEGORY BREAKDOWN
            </text>
            {slices.map((slice, idx) => {
              const rowY = 46 + idx * 28;
              return (
                <g key={`legend-${idx}`}>
                  <rect x="16" y={rowY - 10} width="12" height="12" fill={slice.sliceColor} rx="2" />
                  <text x="36" y={rowY} fill="#F5F3F4" fontSize="11" fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" fontWeight="600">
                    {slice.label}
                  </text>
                  <text x="218" y={rowY} textAnchor="end" fill={slice.sliceColor} fontSize="11.5" fontFamily="'JetBrains Mono', monospace" fontWeight="800">
                    {slice.value}%
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    );
  }

  return null;
};
