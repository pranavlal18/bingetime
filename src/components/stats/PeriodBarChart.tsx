// ─── PeriodBarChart — vertical bar chart for weekly/monthly buckets ───

import { memo, useMemo } from 'react'
import { View, Text, Dimensions } from 'react-native'
import { useTheme } from '@/contexts/ThemeContext'

const SCREEN_WIDTH = Dimensions.get('window').width

interface PeriodBarChartProps {
  data: Array<{ label: string; value: number }>
  color?: string
  trackColor?: string
  height?: number
  maxLabelInterval?: number // show every Nth label
  showTotal?: boolean
  totalLabel?: string
}

const PeriodBarChart = memo(function PeriodBarChart({
  data,
  color,
  trackColor,
  height = 120,
  maxLabelInterval = 4,
  showTotal,
  totalLabel,
}: PeriodBarChartProps) {
  const { colors } = useTheme()
  const barColor = color ?? colors.tertiary
  const bgColor = trackColor ?? colors.surfaceContainerHighest
  const contentW = SCREEN_WIDTH - 40 - 32 // screen minus margins minus card padding

  const maxValue = useMemo(() => Math.max(...data.map((d) => d.value), 1), [data])

  const barCount = data.length
  const barGap = 2
  const totalGap = barCount > 1 ? (barCount - 1) * barGap : 0
  const barW = Math.max(3, (contentW - totalGap) / barCount)

  return (
    <View>
      {/* Bars */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height, gap: barGap }}>
        {data.map((d, i) => {
          const barH = maxValue > 0 ? Math.max(2, (d.value / maxValue) * (height - 10)) : 0
          const isZero = d.value === 0
          return (
            <View
              key={`${d.label}-${i}`}
              style={{ flex: 1, alignItems: 'center', height, justifyContent: 'flex-end' }}
            >
              <View
                style={{
                  width: barW,
                  height: barH,
                  borderRadius: 3,
                  backgroundColor: isZero ? bgColor : barColor,
                  opacity: isZero ? 0.4 : 1,
                }}
              />
            </View>
          )
        })}
      </View>

      {/* Labels — only render every Nth label; skip others entirely to avoid transparent-text rendering bugs on Android */}
      <View style={{ flexDirection: 'row', marginTop: 6, gap: barGap }}>
        {data.map((d, i) => (
          <View key={`lbl-${d.label}-${i}`} style={{ flex: 1, alignItems: 'center' }}>
            {i % maxLabelInterval === 0 && (
              <Text
                style={{
                  fontFamily: 'Inter',
                  fontSize: 9,
                  fontWeight: '600',
                  color: colors.secondary,
                }}
                numberOfLines={1}
              >
                {d.label}
              </Text>
            )}
          </View>
        ))}
      </View>

      {/* Total footer */}
      {showTotal && data.length > 0 && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
          <Text style={{ fontFamily: 'Inter', fontSize: 10, color: colors.secondary }}>
            {totalLabel ?? `Total: ${Math.round(data.reduce((s, d) => s + d.value, 0))}`}
          </Text>
        </View>
      )}
    </View>
  )
})

export default PeriodBarChart
