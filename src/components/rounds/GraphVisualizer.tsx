import React from 'react';
import type { Round2ChartData } from '../../data/round2Questions';

interface GraphVisualizerProps {
  chartData: Round2ChartData;
}

export const GraphVisualizer: React.FC<GraphVisualizerProps> = ({ chartData }) => {
  const { type, title, labels, values, colors } = chartData;

  // 1. BAR CHART RENDERER
  if (type === 'bar') {
    const maxValue = Math.max(...values, 10);
    // Round upper bound to a clean multiple of 10
    const yMax = Math.ceil((maxValue + 5) / 10) * 10;
    const ticks = [0, yMax * 0.25, yMax * 0.5, yMax * 0.75, yMax];

    const chartWidth = 560;
    const chartHeight = 240;
    const paddingLeft = 55;
    const paddingRight = 30;
    const paddingTop = 40;
    const paddingBottom = 45;

    const plotWidth = chartWidth - paddingLeft - paddingRight;
    const plotHeight = chartHeight - paddingTop - paddingBottom;

    const barSlotWidth = plotWidth / labels.length;
    const barWidth = Math.min(52, barSlotWidth * 0.58);

    const defaultColors = ['#8E233B', '#B94B68', '#F59E0B', '#22C55E'];

    return (
      <div className="graph-render-wrapper">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="chart-svg"
          aria-label={title}
          role="img"
        >
          <defs>
            <linearGradient id="barGlowMaroon" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#B94B68" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#8E233B" stopOpacity="0.8" />
            </linearGradient>
            <filter id="barShadow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#8E233B" floodOpacity="0.25" />
            </filter>
          </defs>

          {/* Background card container */}
          <rect x="0" y="0" width={chartWidth} height={chartHeight} fill="#202124" rx="6" stroke="#414047" />

          {/* Chart Header Bar */}
          <rect x="0" y="0" width={chartWidth} height="32" fill="#292A2E" rx="6" />
          <line x1="0" y1="32" x2={chartWidth} y2="32" stroke="#414047" strokeWidth="1" />
          <circle cx="16" cy="16" r="4" fill="#8E233B" />
          <circle cx="28" cy="16" r="4" fill="#F59E0B" />
          <circle cx="40" cy="16" r="4" fill="#22C55E" />
          <text
            x="56"
            y="20"
            fill="#F5F3F4"
            fontSize="11"
            fontFamily="'JetBrains Mono', monospace"
            fontWeight="700"
            letterSpacing="0.05em"
          >
            {title.toUpperCase()}
          </text>

          {/* Horizontal Grid Lines & Y Axis Labels */}
          {ticks.map((tick, i) => {
            const y = paddingTop + plotHeight - (tick / yMax) * plotHeight;
            return (
              <g key={`tick-${i}`}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={chartWidth - paddingRight}
                  y2={y}
                  stroke="#343238"
                  strokeDasharray="3 3"
                />
                <text
                  x={paddingLeft - 10}
                  y={y + 3.5}
                  textAnchor="end"
                  fill="#B8B2B7"
                  fontSize="10"
                  fontFamily="'JetBrains Mono', monospace"
                >
                  {tick}
                </text>
              </g>
            );
          })}

          {/* Y Axis Baseline */}
          <line
            x1={paddingLeft}
            y1={paddingTop + plotHeight}
            x2={chartWidth - paddingRight}
            y2={paddingTop + plotHeight}
            stroke="#414047"
            strokeWidth="1.5"
          />

          {/* Bars and Data Labels */}
          {labels.map((label, idx) => {
            const val = values[idx];
            const barH = (val / yMax) * plotHeight;
            const x = paddingLeft + idx * barSlotWidth + (barSlotWidth - barWidth) / 2;
            const y = paddingTop + plotHeight - barH;
            const barColor = (colors && colors[idx]) || defaultColors[idx % defaultColors.length];

            return (
              <g key={`bar-${idx}`}>
                {/* Bar */}
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barH}
                  fill={barColor}
                  rx="3"
                  filter="url(#barShadow)"
                />

                {/* Top cap highlight */}
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height="3"
                  fill="#FFF"
                  opacity="0.4"
                  rx="1.5"
                />

                {/* Value Label above Bar */}
                <text
                  x={x + barWidth / 2}
                  y={y - 7}
                  textAnchor="middle"
                  fill="#F5F3F4"
                  fontSize="11"
                  fontFamily="'JetBrains Mono', monospace"
                  fontWeight="700"
                >
                  {val}
                </text>

                {/* X Axis Label */}
                <text
                  x={x + barWidth / 2}
                  y={chartHeight - 18}
                  textAnchor="middle"
                  fill="#B8B2B7"
                  fontSize="11"
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

  // 2. LINE GRAPH RENDERER
  if (type === 'line') {
    const maxValue = Math.max(...values, 10);
    const yMax = Math.ceil((maxValue + 4) / 5) * 5;
    const ticks = [0, yMax * 0.25, yMax * 0.5, yMax * 0.75, yMax];

    const chartWidth = 560;
    const chartHeight = 240;
    const paddingLeft = 55;
    const paddingRight = 35;
    const paddingTop = 40;
    const paddingBottom = 45;

    const plotWidth = chartWidth - paddingLeft - paddingRight;
    const plotHeight = chartHeight - paddingTop - paddingBottom;

    // Calculate (x, y) coordinates for each point
    const points = values.map((val, idx) => {
      const x = paddingLeft + (idx / (values.length - 1)) * plotWidth;
      const y = paddingTop + plotHeight - (val / yMax) * plotHeight;
      return { x, y, val, label: labels[idx] };
    });

    const pathD = points.reduce((acc, pt, idx) => {
      return idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
    }, '');

    // Area fill path closing to bottom baseline
    const areaD = `${pathD} L ${points[points.length - 1].x} ${
      paddingTop + plotHeight
    } L ${points[0].x} ${paddingTop + plotHeight} Z`;

    return (
      <div className="graph-render-wrapper">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="chart-svg"
          aria-label={title}
          role="img"
        >
          <defs>
            <linearGradient id="lineAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8E233B" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#8E233B" stopOpacity="0.0" />
            </linearGradient>
            <filter id="lineGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#8E233B" floodOpacity="0.4" />
            </filter>
          </defs>

          {/* Background */}
          <rect x="0" y="0" width={chartWidth} height={chartHeight} fill="#202124" rx="6" stroke="#414047" />

          {/* Chart Header Bar */}
          <rect x="0" y="0" width={chartWidth} height="32" fill="#292A2E" rx="6" />
          <line x1="0" y1="32" x2={chartWidth} y2="32" stroke="#414047" strokeWidth="1" />
          <circle cx="16" cy="16" r="4" fill="#8E233B" />
          <circle cx="28" cy="16" r="4" fill="#F59E0B" />
          <circle cx="40" cy="16" r="4" fill="#22C55E" />
          <text
            x="56"
            y="20"
            fill="#F5F3F4"
            fontSize="11"
            fontFamily="'JetBrains Mono', monospace"
            fontWeight="700"
            letterSpacing="0.05em"
          >
            {title.toUpperCase()}
          </text>

          {/* Horizontal Grid lines */}
          {ticks.map((tick, i) => {
            const y = paddingTop + plotHeight - (tick / yMax) * plotHeight;
            return (
              <g key={`tick-${i}`}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={chartWidth - paddingRight}
                  y2={y}
                  stroke="#343238"
                  strokeDasharray="3 3"
                />
                <text
                  x={paddingLeft - 10}
                  y={y + 3.5}
                  textAnchor="end"
                  fill="#B8B2B7"
                  fontSize="10"
                  fontFamily="'JetBrains Mono', monospace"
                >
                  {tick}
                </text>
              </g>
            );
          })}

          {/* Baseline */}
          <line
            x1={paddingLeft}
            y1={paddingTop + plotHeight}
            x2={chartWidth - paddingRight}
            y2={paddingTop + plotHeight}
            stroke="#414047"
            strokeWidth="1.5"
          />

          {/* Area under curve */}
          <path d={areaD} fill="url(#lineAreaGrad)" />

          {/* Line stroke */}
          <path
            d={pathD}
            fill="none"
            stroke="#8E233B"
            strokeWidth="3"
            filter="url(#lineGlow)"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data Points and Callout Badges */}
          {points.map((pt, idx) => (
            <g key={`pt-${idx}`}>
              {/* Outer halo */}
              <circle cx={pt.x} cy={pt.y} r="7" fill="#8E233B" opacity="0.25" />
              {/* Solid point */}
              <circle cx={pt.x} cy={pt.y} r="4.5" fill="#B94B68" stroke="#FFFFFF" strokeWidth="1.5" />

              {/* Value pill badge */}
              <rect
                x={pt.x - 14}
                y={pt.y - 24}
                width="28"
                height="16"
                fill="#292A2E"
                stroke="#8E233B"
                strokeWidth="1"
                rx="3"
              />
              <text
                x={pt.x}
                y={pt.y - 12.5}
                textAnchor="middle"
                fill="#F5F3F4"
                fontSize="10"
                fontFamily="'JetBrains Mono', monospace"
                fontWeight="700"
              >
                {pt.val}
              </text>

              {/* X Axis Label */}
              <text
                x={pt.x}
                y={chartHeight - 18}
                textAnchor="middle"
                fill="#B8B2B7"
                fontSize="11"
                fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                fontWeight="600"
              >
                {pt.label}
              </text>
            </g>
          ))}
        </svg>
      </div>
    );
  }

  // 3. PIE / DONUT CHART RENDERER
  if (type === 'pie') {
    const total = values.reduce((sum, v) => sum + v, 0);
    const chartWidth = 560;
    const chartHeight = 240;
    const centerX = 160;
    const centerY = 136;
    const outerRadius = 78;
    const innerRadius = 42;

    const defaultColors = ['#8E233B', '#B94B68', '#F59E0B', '#22C55E'];

    // Generate SVG path for each donut slice
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

      return {
        pathData,
        sliceColor,
        label: labels[idx],
        value: val,
        fraction: Math.round(fraction * 100),
      };
    });

    return (
      <div className="graph-render-wrapper">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="chart-svg"
          aria-label={title}
          role="img"
        >
          {/* Background Card */}
          <rect x="0" y="0" width={chartWidth} height={chartHeight} fill="#202124" rx="6" stroke="#414047" />

          {/* Chart Header Bar */}
          <rect x="0" y="0" width={chartWidth} height="32" fill="#292A2E" rx="6" />
          <line x1="0" y1="32" x2={chartWidth} y2="32" stroke="#414047" strokeWidth="1" />
          <circle cx="16" cy="16" r="4" fill="#8E233B" />
          <circle cx="28" cy="16" r="4" fill="#F59E0B" />
          <circle cx="40" cy="16" r="4" fill="#22C55E" />
          <text
            x="56"
            y="20"
            fill="#F5F3F4"
            fontSize="11"
            fontFamily="'JetBrains Mono', monospace"
            fontWeight="700"
            letterSpacing="0.05em"
          >
            {title.toUpperCase()}
          </text>

          {/* Slices */}
          {slices.map((slice, idx) => (
            <path
              key={`slice-${idx}`}
              d={slice.pathData}
              fill={slice.sliceColor}
              stroke="#202124"
              strokeWidth="2"
            />
          ))}

          {/* Center Hole Details */}
          <circle cx={centerX} cy={centerY} r={innerRadius - 1} fill="#202124" />
          <text
            x={centerX}
            y={centerY - 4}
            textAnchor="middle"
            fill="#F5F3F4"
            fontSize="12"
            fontFamily="'JetBrains Mono', monospace"
            fontWeight="800"
          >
            100%
          </text>
          <text
            x={centerX}
            y={centerY + 11}
            textAnchor="middle"
            fill="#B8B2B7"
            fontSize="8"
            fontFamily="'JetBrains Mono', monospace"
            letterSpacing="0.08em"
          >
            TOTAL SHARE
          </text>

          {/* Right Legend Card */}
          <g transform="translate(300, 56)">
            <rect x="0" y="0" width="230" height="156" fill="#292A2E" stroke="#414047" rx="4" />
            <text
              x="16"
              y="22"
              fill="#B8B2B7"
              fontSize="10"
              fontFamily="'JetBrains Mono', monospace"
              fontWeight="700"
              letterSpacing="0.06em"
            >
              // CATEGORY BREAKDOWN
            </text>

            {slices.map((slice, idx) => {
              const rowY = 46 + idx * 28;
              return (
                <g key={`legend-${idx}`}>
                  {/* Swatch */}
                  <rect x="16" y={rowY - 10} width="12" height="12" fill={slice.sliceColor} rx="2" />

                  {/* Label */}
                  <text
                    x="36"
                    y={rowY}
                    fill="#F5F3F4"
                    fontSize="12"
                    fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                    fontWeight="600"
                  >
                    {slice.label}
                  </text>

                  {/* Percentage Value */}
                  <text
                    x="214"
                    y={rowY}
                    textAnchor="end"
                    fill={slice.sliceColor}
                    fontSize="12"
                    fontFamily="'JetBrains Mono', monospace"
                    fontWeight="800"
                  >
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
