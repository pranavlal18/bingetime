import { Component, type ReactNode, type ErrorInfo } from 'react'
import { View, Text, Pressable } from 'react-native'
import { ThemeContext } from '@/contexts/ThemeContext'
import type { ThemePayload } from '@/themes'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

function ErrorFallback({ error, onRetry, colors }: { error: Error | null; onRetry: () => void; colors: ThemePayload['colors'] }) {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.surface,
        padding: 24,
      }}
    >
      <Text
        style={{
          fontSize: 18,
          fontWeight: '700',
          color: colors.onSurface,
          marginBottom: 12,
          fontFamily: 'Inter',
        }}
      >
        Something went wrong
      </Text>
      <Text
        style={{
          fontSize: 14,
          color: colors.error,
          textAlign: 'center',
          marginBottom: 24,
          fontFamily: 'Inter',
        }}
      >
        {error?.message}
      </Text>
      <Pressable
        style={{
          backgroundColor: colors.primary,
          paddingHorizontal: 24,
          paddingVertical: 12,
          borderRadius: 8,
        }}
        onPress={onRetry}
      >
        <Text
          style={{
            color: colors.onPrimary,
            fontWeight: '600',
            fontSize: 14,
            fontFamily: 'Inter',
          }}
        >
          Retry
        </Text>
      </Pressable>
    </View>
  )
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('🔥 [ErrorBoundary] Caught:', error.message, errorInfo.componentStack)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <ThemeContext.Consumer>
          {(ctx) =>
            ctx ? (
              <ErrorFallback
                error={this.state.error}
                onRetry={() => this.setState({ hasError: false, error: null })}
                colors={ctx.colors}
              />
            ) : (
              this.props.children
            )
          }
        </ThemeContext.Consumer>
      )
    }
    return this.props.children
  }
}
