// ─── StatBlock — dark rounded card wrapper for stats sections ───

import { memo, type ReactNode } from 'react'
import { View, Text } from 'react-native'
import { useTheme } from '@/contexts/ThemeContext'

interface StatBlockProps {
  title: string
  subtitle?: string
  headerRight?: ReactNode
  children: ReactNode
  empty?: boolean
  emptyMessage?: string
}

const StatBlock = memo(function StatBlock({
  title,
  subtitle,
  headerRight,
  children,
  empty,
  emptyMessage = 'Not enough data yet',
}: StatBlockProps) {
  const { colors } = useTheme()

  return (
    <View
      style={{
        backgroundColor: colors.surfaceContainer,
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
      }}
    >
      {/* Header row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: 'Inter',
              fontSize: 15,
              fontWeight: '600',
              color: colors.onSurface,
            }}
          >
            {title}
          </Text>
          {subtitle && (
            <Text
              style={{
                fontFamily: 'Inter',
                fontSize: 11,
                fontWeight: '500',
                color: colors.secondary,
                marginTop: 2,
                letterSpacing: 0.4,
                textTransform: 'uppercase',
              }}
            >
              {subtitle}
            </Text>
          )}
        </View>
        {headerRight && <View style={{ marginLeft: 8 }}>{headerRight}</View>}
      </View>

      {/* Body */}
      {empty ? (
        <Text
          style={{
            fontFamily: 'Inter',
            fontSize: 13,
            color: colors.secondary,
            textAlign: 'center',
            paddingVertical: 16,
          }}
        >
          {emptyMessage}
        </Text>
      ) : (
        children
      )}
    </View>
  )
})

export default StatBlock
