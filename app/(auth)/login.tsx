// ─── Login Screen ───

import { useState, useMemo } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { typography, spacing, borderRadius } from '@/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { supabase } from '@/lib/supabase'

export default function LoginScreen() {
  const { colors } = useTheme()
  const styles = useMemo(() => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.marginMobile,
    paddingVertical: spacing.stackLg,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: spacing.stackLg,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.primaryContainer,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.stackMd,
  },
  title: {
    fontFamily: 'Inter',
    fontSize: 32,
    fontWeight: '700',
    color: colors.onSurface,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: 'Inter',
    fontSize: typography.bodyMd.fontSize,
    color: colors.onSurfaceVariant,
    marginTop: 4,
  },
  formContainer: {
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
  },
  formTitle: {
    fontFamily: 'Inter',
    fontSize: 24,
    fontWeight: '600',
    color: colors.onSurface,
    marginBottom: 4,
    textAlign: 'center',
  },
  formSubtitle: {
    fontFamily: 'Inter',
    fontSize: typography.bodyMd.fontSize,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    marginBottom: spacing.stackLg,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.errorContainer,
    padding: 12,
    borderRadius: borderRadius.md,
    marginBottom: spacing.stackMd,
  },
  errorText: {
    fontFamily: 'Inter',
    fontSize: typography.bodySm.fontSize,
    color: colors.onErrorContainer,
    flex: 1,
  },
  inputGroup: {
    marginBottom: spacing.stackMd,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainer,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 12,
  },
  inputInner: {
    flex: 1,
  },
  inputLabel: {
    fontFamily: 'Inter',
    fontSize: typography.labelSm.fontSize,
    fontWeight: '500',
    color: colors.onSurfaceVariant,
    marginBottom: 2,
  },
  input: {
    height: 44,
    fontFamily: 'Inter',
    fontSize: typography.bodyMd.fontSize,
    color: colors.onSurface,
  },
  forgotButton: {
    alignSelf: 'flex-end',
    marginBottom: spacing.stackSm,
  },
  forgotText: {
    fontFamily: 'Inter',
    fontSize: typography.bodySm.fontSize,
    fontWeight: '500',
    color: colors.primary,
  },
  submitButton: {
    height: 52,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.stackSm,
  },
  submitButtonLoading: {
    opacity: 0.8,
  },
  submitButtonText: {
    fontFamily: 'Inter',
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '600',
    color: colors.onPrimary,
    letterSpacing: 0.5,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: spacing.stackLg,
  },
  footerText: {
    fontFamily: 'Inter',
    fontSize: typography.bodyMd.fontSize,
    color: colors.onSurfaceVariant,
  },
  footerLink: {
    fontFamily: 'Inter',
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '600',
    color: colors.primary,
  },
}), [colors])
  const insets = useSafeAreaInsets()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please enter both email and password')
      return
    }
    setError(null)
    setLoading(true)

    console.log('🔑 [LoginScreen] Attempting sign in:', { email })
    const { error, data } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)

    if (error) {
      console.log('❌ [LoginScreen] Sign in error:', error.message)
      setError('Invalid email or password. Please try again.')
      return
    }
    console.log('✅ [LoginScreen] Sign in success:', { user: data.user?.email })
    // Success - router will handle navigation via auth guard
  }

  const handleForgotPassword = async () => {
    if (!email) {
      Alert.alert('Enter your email first', 'Type your email above, then tap "Forgot password"')
      return
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    if (error) {
      console.log('❌ [LoginScreen] Reset password error:', error.message)
      Alert.alert('Error', 'Could not send reset email. Please try again.')
    } else {
      Alert.alert('Reset email sent', 'Check your inbox for a password reset link')
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
      keyboardVerticalOffset={insets.top}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ── Logo ── */}
        <View style={styles.logoContainer}>
          <View style={styles.logo}>
            <Ionicons name="tv-outline" size={40} color={colors.primary} />
          </View>
          <Text style={styles.title}>BingeTime</Text>
          <Text style={styles.subtitle}>Track your shows & movies</Text>
        </View>

        {/* ── Form ── */}
        <View style={styles.formContainer}>
          <Text style={styles.formTitle}>Welcome back</Text>
          <Text style={styles.formSubtitle}>Sign in to continue</Text>

          {error && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle-outline" size={20} color={colors.onErrorContainer} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.inputGroup}>
            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={22} color={colors.onSurfaceVariant} style={styles.inputIcon} />
              <View style={styles.inputInner}>
                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  textContentType="emailAddress"
                />
              </View>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={22} color={colors.onSurfaceVariant} style={styles.inputIcon} />
              <View style={styles.inputInner}>
                <Text style={styles.inputLabel}>Password</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  secureTextEntry
                  autoComplete="password"
                  textContentType="password"
                />
              </View>
            </View>
          </View>

          <Pressable style={styles.forgotButton} onPress={handleForgotPassword}>
            <Text style={styles.forgotText}>Forgot password?</Text>
          </Pressable>

          <Pressable style={[styles.submitButton, loading && styles.submitButtonLoading]} onPress={handleLogin} disabled={loading}>
            {loading ? (
              <ActivityIndicator size="small" color={colors.onPrimary} />
            ) : (
              <Text style={styles.submitButtonText}>Sign In</Text>
            )}
          </Pressable>
        </View>

        {/* ── Footer ── */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account?</Text>
          <Pressable onPress={() => router.replace('/(auth)/register')}>
            <Text style={styles.footerLink}>Create one</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

