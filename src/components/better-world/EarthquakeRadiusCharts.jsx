import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, LabelList, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { LAYER_COLORS } from '../../data/commandMapData'

const EQ_COLOR = LAYER_COLORS.earthquake
const STABLE_COLOR = '#3dd68c'
const GRID_COLOR = '#2e2e2e'
const LABEL_COLOR = '#6e6e6e'

export const ANNULAR_VIEW_OPTIONS = [
  {
    id: 'density',
    label: 'Density',
    dataKey: 'densityPer1000SqMiPerYear',
    yAxisLabel: 'Events / yr / 1k sq mi',
    subtitle:
      'Normalized by ring area — outer rings cover more ground, so raw counts alone can mislead.',
    formatTooltip: (value, row) =>
      `Density: ${Number(value).toFixed(2)} / yr / 1k sq mi · Count: ${row.count} in ${Number(row.areaSqMi).toFixed(0)} sq mi`,
  },
  {
    id: 'rate',
    label: 'Rate',
    dataKey: 'bandRatePerYear',
    yAxisLabel: 'Events / yr',
    subtitle: 'Average events per year in each distance band (not area-normalized).',
    formatTooltip: (value, row) =>
      `Rate: ${Number(value).toFixed(2)} / yr · Count: ${row.count} in ${Number(row.areaSqMi).toFixed(0)} sq mi`,
  },
  {
    id: 'count',
    label: 'Count',
    dataKey: 'count',
    yAxisLabel: 'Events',
    subtitle: 'Total events in each band over the selected time window.',
    formatTooltip: (value, row) =>
      `Count: ${value} events · ${Number(row.areaSqMi).toFixed(0)} sq mi band`,
  },
]

export function getAnnularViewConfig(viewId) {
  return ANNULAR_VIEW_OPTIONS.find(option => option.id === viewId) ?? ANNULAR_VIEW_OPTIONS[0]
}

export const TEMPORAL_VIEW_OPTIONS = [
  {
    id: 'density',
    label: 'Rate',
    dataKey: 'densityPerYear',
    yAxisLabel: 'Events / yr',
    subtitle: 'Average events per year in each time period within the search radius.',
    formatTooltip: (value, row) =>
      `Rate: ${Number(value).toFixed(2)} / yr · Count: ${row.count} over ${Number(row.bandYears).toFixed(1)} yr`,
  },
  {
    id: 'count',
    label: 'Count',
    dataKey: 'count',
    yAxisLabel: 'Events',
    subtitle: 'Total events in each time period within the search radius.',
    formatTooltip: (value, row) =>
      `Count: ${value} events · ${Number(row.bandYears).toFixed(1)} yr period`,
  },
]

export function getTemporalViewConfig(viewId) {
  const match = TEMPORAL_VIEW_OPTIONS.find(option => option.id === viewId)
  if (match) return match
  return TEMPORAL_VIEW_OPTIONS[0]
}

const TOOLTIP_WRAPPER_STYLE = {
  zIndex: 40,
  pointerEvents: 'none',
  transition: 'none',
}

const TOOLTIP_PROPS = {
  isAnimationActive: false,
  animationDuration: 0,
  offset: 6,
  wrapperStyle: TOOLTIP_WRAPPER_STYLE,
}

function CompactChartTip({ label, value }) {
  return (
    <div className="eq-chart-tip">
      {label ? <span className="eq-chart-tip__label">{label}</span> : null}
      {label && value ? <span className="eq-chart-tip__sep">·</span> : null}
      {value ? <span className="eq-chart-tip__value">{value}</span> : null}
    </div>
  )
}

function annularTipValue(row, view) {
  const parts = []
  if (view === 'density') {
    parts.push(`${Number(row.densityPer1000SqMiPerYear).toFixed(2)}/yr·1kmi²`)
  } else if (view === 'rate') {
    parts.push(`${Number(row.bandRatePerYear).toFixed(1)}/yr`)
  } else {
    parts.push(`${row.count} evt`)
  }
  if (view !== 'count') parts.push(`${row.count} evt`)
  if (view === 'count' && row.areaSqMi != null) {
    parts.push(`${Number(row.areaSqMi).toFixed(0)} mi²`)
  }
  return parts.join(' · ')
}

function temporalTipValue(row, view) {
  const parts = []
  if (view === 'count') {
    parts.push(`${row.count} evt`)
  } else {
    parts.push(`${Number(row.densityPerYear).toFixed(1)}/yr`)
    parts.push(`${row.count} evt`)
  }
  if (row.bandYears != null) parts.push(`${Number(row.bandYears).toFixed(1)}y`)
  return parts.join(' · ')
}

function ChartTooltip({ active, payload, label, formatter }) {
  if (!active || !payload?.length) return null

  const entry = payload[0]
  const text = formatter ? formatter(entry) : `${entry.name}: ${entry.value}`

  return <CompactChartTip label={label} value={text} />
}

function AnnularBarTooltip({ active, payload, label, view = 'density' }) {
  if (!active || !payload?.length) return null

  const row = payload[0]?.payload
  if (!row) return null

  const bandLabel = label ?? row.bandLabel ?? `${row.label} mi`

  return <CompactChartTip label={bandLabel} value={annularTipValue(row, view)} />
}

function TemporalBarTooltip({ active, payload, label, view = 'density' }) {
  if (!active || !payload?.length) return null

  const row = payload[0]?.payload
  if (!row) return null

  const bandLabel = label ?? row.bandLabel ?? row.label

  return (
    <CompactChartTip
      label={bandLabel}
      value={temporalTipValue(row, view === 'rate' ? 'density' : view)}
    />
  )
}

const BAR_FILL = `${EQ_COLOR}55`
const BAR_FILL_HOVER = `${EQ_COLOR}77`

const Y_AXIS_TICK = {
  fill: LABEL_COLOR,
  fontSize: 9,
  fontFamily: 'IBM Plex Mono, monospace',
}

const CHART_MARGINS = { top: 4, right: 10, left: 6, bottom: 4 }

function compactBarChartProps(compact) {
  if (!compact) return { barCategoryGap: '12%' }
  return { barCategoryGap: '28%' }
}

function compactBarProps(compact) {
  if (!compact) return {}
  return { maxBarSize: 22 }
}

function formatYAxisTick(value) {
  if (!Number.isFinite(value)) return ''
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`
  if (Math.abs(value) >= 100) return String(Math.round(value))
  if (Math.abs(value) >= 10) return value.toFixed(0)
  if (Math.abs(value) >= 1) return value.toFixed(1)
  return value.toFixed(2)
}

function ChartYAxisCaption({ label }) {
  if (!label) return null

  return (
    <div
      className="flex w-4 shrink-0 items-center justify-center self-stretch pb-8 pt-1 pr-0.5"
      aria-hidden
    >
      <span className="eq-chart-y-caption font-mono text-[8px] leading-none text-ink-faint">
        {label}
      </span>
    </div>
  )
}

function BarChartFrame({ yAxisLabel, children }) {
  return (
    <div className="flex min-h-0 w-full flex-1">
      <ChartYAxisCaption label={yAxisLabel} />
      <div className="min-h-0 min-w-0 flex-1">{children}</div>
    </div>
  )
}

function CumulativeChartLegend({ compact = false }) {
  if (compact) {
    return (
      <div className="mb-0.5 flex shrink-0 items-center gap-x-2">
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-3 rounded-full" style={{ backgroundColor: EQ_COLOR }} />
          <span className="font-mono text-[8px] text-ink-faint">Count</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="h-0 w-3 border-t border-dashed" style={{ borderColor: STABLE_COLOR }} />
          <span className="font-mono text-[8px] text-ink-faint">/yr</span>
        </span>
      </div>
    )
  }

  return (
    <div className="mb-1.5 flex shrink-0 flex-wrap items-center gap-x-3 gap-y-0.5">
      <span className="flex items-center gap-1.5">
        <span className="relative flex h-2.5 w-6 items-center">
          <span className="h-px w-full" style={{ backgroundColor: EQ_COLOR }} />
          <span
            className="absolute left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full"
            style={{ backgroundColor: EQ_COLOR }}
          />
        </span>
        <span className="font-mono text-[9px] text-ink-faint">Total events (left axis)</span>
      </span>
      <span className="flex items-center gap-1.5">
        <span
          className="h-0 w-6 border-t-[1.5px] border-dashed"
          style={{ borderColor: STABLE_COLOR }}
        />
        <span className="font-mono text-[9px] text-ink-faint">Events / yr (right axis)</span>
      </span>
    </div>
  )
}

function emptyChartMessage(compact, text) {
  return (
    <p
      className={`flex items-center justify-center font-mono text-ink-faint ${
        compact ? 'h-full min-h-[72px] text-[10px]' : 'h-48 text-[11px]'
      }`}
    >
      {text}
    </p>
  )
}

export function CumulativeRadiusChart({ data, compact = false }) {
  if (!data?.length) {
    return emptyChartMessage(compact, 'No cumulative data')
  }

  const chartData = data.map(row => ({
    ...row,
    radiusLabel: `${row.radius} mi`,
  }))

  return (
    <div
      className={`eq-chart flex h-full w-full min-w-0 flex-col ${compact ? 'min-h-[72px]' : 'min-h-[88px]'}`}
    >
      <CumulativeChartLegend compact={compact} />
      <div className="min-h-0 w-full flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={compact ? { top: 4, right: 8, left: 2, bottom: 0 } : { top: 8, right: 14, left: 4, bottom: 4 }}
          >
          <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="radiusLabel"
            tick={{
              fill: LABEL_COLOR,
              fontSize: compact ? 8 : 9,
              fontFamily: 'IBM Plex Mono, monospace',
            }}
            axisLine={{ stroke: GRID_COLOR }}
            tickLine={false}
          />
          <YAxis
            yAxisId="count"
            tick={Y_AXIS_TICK}
            tickFormatter={formatYAxisTick}
            axisLine={{ stroke: GRID_COLOR }}
            tickLine={false}
            width={compact ? 28 : 40}
          />
          <YAxis
            yAxisId="rate"
            orientation="right"
            tick={Y_AXIS_TICK}
            tickFormatter={formatYAxisTick}
            axisLine={{ stroke: GRID_COLOR }}
            tickLine={false}
            width={compact ? 28 : 40}
          />
          <Tooltip
            {...TOOLTIP_PROPS}
            content={props => (
              <ChartTooltip
                {...props}
                formatter={entry =>
                  entry.dataKey === 'count'
                    ? `${entry.value} cumulative`
                    : `${Number(entry.value).toFixed(1)}/yr`
                }
              />
            )}
          />
          <Line
            yAxisId="count"
            type="monotone"
            dataKey="count"
            name="Cumulative count"
            stroke={EQ_COLOR}
            strokeWidth={2}
            dot={{ r: 3, fill: EQ_COLOR, strokeWidth: 0 }}
            activeDot={{ r: 5, fill: EQ_COLOR, stroke: 'none' }}
            isAnimationActive={false}
          />
          <Line
            yAxisId="rate"
            type="monotone"
            dataKey="ratePerYear"
            name="Events per year"
            stroke={STABLE_COLOR}
            strokeWidth={1.5}
            strokeDasharray="5 3"
            dot={false}
          />
        </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export function AnnularDensityChart({ data, view = 'density', compact = false }) {
  if (!data?.length) {
    return emptyChartMessage(compact, 'No annular data')
  }

  const viewConfig = getAnnularViewConfig(view)

  const chartData = data.map(row => ({
    ...row,
    bandLabel: `${row.label} mi`,
    bandRatePerYear: row.densityPerYear * row.areaSqMi,
  }))

  return (
    <div
      className={`eq-chart eq-chart--bars flex h-full w-full min-w-0 flex-col ${compact ? 'min-h-[72px]' : 'min-h-[88px]'}`}
    >
      <BarChartFrame yAxisLabel={compact ? null : viewConfig.yAxisLabel}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={compact ? { top: 2, right: 6, left: 2, bottom: 12 } : CHART_MARGINS}
            {...compactBarChartProps(compact)}
          >
          <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="bandLabel"
            tick={{
              fill: LABEL_COLOR,
              fontSize: compact ? 7 : 9,
              fontFamily: 'IBM Plex Mono, monospace',
            }}
            axisLine={{ stroke: GRID_COLOR }}
            tickLine={false}
            interval={compact ? 'preserveStartEnd' : 0}
            angle={compact ? -35 : -25}
            textAnchor="end"
            height={compact ? 42 : 48}
          />
          <YAxis
            tick={Y_AXIS_TICK}
            tickFormatter={formatYAxisTick}
            axisLine={{ stroke: GRID_COLOR }}
            tickLine={false}
            width={compact ? 28 : 40}
          />
          <Tooltip
            {...TOOLTIP_PROPS}
            shared={false}
            trigger="hover"
            cursor={false}
            content={props => <AnnularBarTooltip {...props} view={view} />}
          />
          <Bar
            dataKey={viewConfig.dataKey}
            name={viewConfig.label}
            radius={compact ? [2, 2, 0, 0] : [4, 4, 0, 0]}
            stroke="none"
            isAnimationActive={false}
            activeBar={{ fill: BAR_FILL_HOVER, stroke: 'none' }}
            {...compactBarProps(compact)}
          >
            {chartData.map(row => (
              <Cell key={row.label} fill={BAR_FILL} stroke="none" strokeWidth={0} />
            ))}
          </Bar>
        </BarChart>
        </ResponsiveContainer>
      </BarChartFrame>
    </div>
  )
}

export function CumulativeTimeChart({ data, compact = false }) {
  if (!data?.length) {
    return emptyChartMessage(compact, 'No cumulative data')
  }

  const chartData = data.map(row => ({
    ...row,
    axisLabel: row.timeLabel,
  }))

  return (
    <div
      className={`eq-chart flex h-full w-full min-w-0 flex-col ${compact ? 'min-h-[72px]' : 'min-h-[88px]'}`}
    >
      <CumulativeChartLegend compact={compact} />
      <div className="min-h-0 w-full flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={compact ? { top: 4, right: 8, left: 2, bottom: 0 } : { top: 8, right: 14, left: 4, bottom: 4 }}
          >
            <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="axisLabel"
              tick={{
                fill: LABEL_COLOR,
                fontSize: compact ? 8 : 9,
                fontFamily: 'IBM Plex Mono, monospace',
              }}
              axisLine={{ stroke: GRID_COLOR }}
              tickLine={false}
            />
            <YAxis
              yAxisId="count"
              tick={Y_AXIS_TICK}
              tickFormatter={formatYAxisTick}
              axisLine={{ stroke: GRID_COLOR }}
              tickLine={false}
              width={compact ? 28 : 40}
            />
            <YAxis
              yAxisId="rate"
              orientation="right"
              tick={Y_AXIS_TICK}
              tickFormatter={formatYAxisTick}
              axisLine={{ stroke: GRID_COLOR }}
              tickLine={false}
              width={compact ? 28 : 40}
            />
            <Tooltip
              {...TOOLTIP_PROPS}
              content={props => (
                <ChartTooltip
                  {...props}
                  formatter={entry =>
                    entry.dataKey === 'count'
                      ? `${entry.value} cumulative`
                      : `${Number(entry.value).toFixed(1)}/yr`
                  }
                />
              )}
            />
            <Line
              yAxisId="count"
              type="monotone"
              dataKey="count"
              name="Cumulative count"
              stroke={EQ_COLOR}
              strokeWidth={2}
              dot={{ r: 3, fill: EQ_COLOR, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: EQ_COLOR, stroke: 'none' }}
              isAnimationActive={false}
            />
            <Line
              yAxisId="rate"
              type="monotone"
              dataKey="ratePerYear"
              name="Events per year"
              stroke={STABLE_COLOR}
              strokeWidth={1.5}
              strokeDasharray="5 3"
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export function TemporalDensityChart({ data, view = 'density', compact = false }) {
  if (!data?.length) {
    return emptyChartMessage(compact, 'No period data')
  }

  const viewConfig = getTemporalViewConfig(view === 'rate' ? 'density' : view)

  const chartData = data.map(row => ({
    ...row,
    bandLabel: row.label,
    bandRatePerYear: row.densityPerYear,
  }))

  const valueKey = viewConfig.dataKey
  const maxValue = Math.max(...chartData.map(row => Number(row[valueKey] ?? 0)))
  const yDomain = [0, maxValue > 0 ? Math.ceil(maxValue * 1.12) : 1]

  return (
    <div
      className={`eq-chart eq-chart--bars flex h-full w-full min-w-0 flex-col ${compact ? 'min-h-[72px]' : 'min-h-[88px]'}`}
    >
      <BarChartFrame yAxisLabel={compact ? null : viewConfig.yAxisLabel}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={compact ? { top: 10, right: 6, left: 2, bottom: 12 } : CHART_MARGINS}
            {...compactBarChartProps(compact)}
          >
          <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="bandLabel"
            tick={{
              fill: LABEL_COLOR,
              fontSize: compact ? 7 : 9,
              fontFamily: 'IBM Plex Mono, monospace',
            }}
            axisLine={{ stroke: GRID_COLOR }}
            tickLine={false}
            interval={compact ? 'preserveStartEnd' : 0}
            angle={compact ? -35 : -25}
            textAnchor="end"
            height={compact ? 42 : 48}
          />
          <YAxis
            tick={Y_AXIS_TICK}
            tickFormatter={formatYAxisTick}
            axisLine={{ stroke: GRID_COLOR }}
            tickLine={false}
            width={compact ? 28 : 40}
            domain={yDomain}
          />
          <Tooltip
            {...TOOLTIP_PROPS}
            shared={false}
            trigger="hover"
            cursor={false}
            content={props => <TemporalBarTooltip {...props} view={view} />}
          />
          <Bar
            dataKey={valueKey}
            name={viewConfig.label}
            radius={compact ? [2, 2, 0, 0] : [4, 4, 0, 0]}
            stroke="none"
            isAnimationActive={false}
            activeBar={{ fill: BAR_FILL_HOVER, stroke: 'none' }}
            {...compactBarProps(compact)}
          >
            {chartData.map(row => (
              <Cell key={row.label} fill={BAR_FILL} stroke="none" strokeWidth={0} />
            ))}
            {compact ? (
              <LabelList
                dataKey={valueKey}
                position="top"
                formatter={value => formatYAxisTick(Number(value))}
                fill={LABEL_COLOR}
                fontSize={8}
                fontFamily="IBM Plex Mono, monospace"
              />
            ) : null}
          </Bar>
        </BarChart>
        </ResponsiveContainer>
      </BarChartFrame>
    </div>
  )
}

export function MagnitudeDistributionChart({ events = [], minMagnitude = 2.5, compact = false }) {
  const bins = useMemo(() => {
    const valid = events.filter(e => Number.isFinite(e.mag))
    const thresholds = [
      { min: minMagnitude, max: 3, label: minMagnitude <= 2.5 ? 'M2.5–3' : `M${minMagnitude}–3` },
      { min: 3, max: 4, label: 'M3–4' },
      { min: 4, max: 5, label: 'M4–5' },
      { min: 5, max: 6, label: 'M5–6' },
      { min: 6, max: null, label: 'M6+' },
    ]
    return thresholds.map(bin => ({
      label: bin.label,
      count: valid.filter(e => {
        if (e.mag < bin.min) return false
        if (bin.max == null) return true
        return e.mag < bin.max
      }).length,
    }))
  }, [events, minMagnitude])

  if (!bins.some(b => b.count > 0)) {
    return emptyChartMessage(compact, 'No magnitude data')
  }

  const maxCount = Math.max(...bins.map(b => b.count))
  const yDomain = [0, maxCount > 0 ? Math.ceil(maxCount * 1.15) : 1]

  return (
    <div
      className={`eq-chart eq-chart--bars flex w-full min-w-0 flex-col ${compact ? 'h-[132px]' : 'h-[240px]'}`}
    >
      <BarChartFrame yAxisLabel={compact ? null : 'Events'}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={bins}
            margin={compact ? { top: 10, right: 6, left: 2, bottom: 12 } : CHART_MARGINS}
            {...compactBarChartProps(compact)}
          >
            <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{
                fill: LABEL_COLOR,
                fontSize: compact ? 8 : 9,
                fontFamily: 'IBM Plex Mono, monospace',
              }}
              axisLine={{ stroke: GRID_COLOR }}
              tickLine={false}
            />
            <YAxis
              tick={Y_AXIS_TICK}
              tickFormatter={formatYAxisTick}
              axisLine={{ stroke: GRID_COLOR }}
              tickLine={false}
              width={compact ? 28 : 40}
              domain={yDomain}
            />
            <Tooltip
              {...TOOLTIP_PROPS}
              formatter={value => [`${value} events`, 'Count']}
            />
            <Bar
              dataKey="count"
              name="Events"
              radius={compact ? [2, 2, 0, 0] : [4, 4, 0, 0]}
              fill={BAR_FILL}
              isAnimationActive={false}
              {...compactBarProps(compact)}
            >
              {bins.map(row => (
                <Cell key={row.label} fill={BAR_FILL} stroke="none" />
              ))}
              {compact ? (
                <LabelList
                  dataKey="count"
                  position="top"
                  formatter={value => formatYAxisTick(Number(value))}
                  fill={LABEL_COLOR}
                  fontSize={7}
                  fontFamily="IBM Plex Mono, monospace"
                />
              ) : null}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </BarChartFrame>
    </div>
  )
}
