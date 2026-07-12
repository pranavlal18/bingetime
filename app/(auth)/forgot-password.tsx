import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '@/contexts/AuthContext'
import { colors, typography, spacing, borderRadius } from '@/theme'

export default function ForgotPasswordScreen() {
  const { resetPassword, loading: authLoading } = useAuth()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!email) {
      setError('Please enter your email')
      return
    }
    setError('')
    setLoading(true)
    const { error } = await resetPassword(email)
    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
      keyboardVerticalOffset={80}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.logoContainer}>
          <View style={styles.logo}>
            <Ionicons name="tv-outline" size={48} color={colors.primary} />
          </View>
          <Text style={styles.title}>BingeTime</Text>
        </View>

        <View style={styles.formContainer}>
          {!sent ? (
            <>
              <Text style={styles.formTitle}>Reset password</Text>
              <Text style={styles.formSubtitle}>
                Enter your email and we'll send you a link to reset your password
              </Text>

              {error && (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle-outline" size={18} color={colors.error} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <View style={styles.inputGroup}>
                <View style={styles.inputWrapper}>
                  <Ionicons name="mail-outline" size={20} color={colors.outlineVariant} style={styles.inputIcon} />
<TextInput
                style={styles.input}
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                textContentType="emailAddress"
                returnKeyType="go"
                onSubmitEditing={handleSubmit}
                editable={!loading}
              />
                </View>
              </View>

              <Pressable style={styles.submitButton} onPress={handleSubmit} disabled={loading || authLoading}>
                {loading || authLoading ? (
                  <ActivityIndicator size="small" color={colors.onPrimary} />
                ) : (
                  <Text style={styles.submitButtonText}>Send reset link</Text>
                )}
              </Pressable>
            </>
          ) : (
            <>
              <View style={styles.successContainer}>
                <View style={styles.successIcon}>
                  <Ionicons name="checkmark-circle-outline" size={48} color={colors.primary} />
                </View>
                <Text style={styles.successTitle}>Check your email</Text>
                <Text style={styles.successText}>
                  We've sent a password reset link to <Text style={styles.emailHighlight}>{email}</Text>
                </Text>
              </View>
              <Pressable style={styles.submitButton} onPress={() => router.replace('/(auth)/login')}>
                <Text style={styles.submitButtonText}>Back to sign in</Text>
              </Pressable>
            </>
          )}
        </View>

        <View style={styles.footer}>
          <Pressable onPress={() => router.replace('/(auth)/login')}>
            <Text style={styles.footerLink}>← Back to sign in</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
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
  input: {
    flex: 1,
    height: 52,
    fontFamily: 'Inter',
    fontSize: typography.bodyMd.fontSize,
    color: colors.onSurface,
  },
  submitButton: {
    height: 52,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.stackSm,
  },
  submitButtonText: {
    fontFamily: 'Inter',
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '600',
    color: colors.onPrimary,
    letterSpacing: 0.5,
  },
  successContainer: {
    alignItems: 'center',
    marginBottom: spacing.stackLg,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryContainer,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.stackMd,
  },
  successTitle: {
    fontFamily: 'Inter',
    fontSize: 24,
    fontWeight: '600',
    color: colors.onSurface,
    marginBottom: spacing.stackSm,
  },
  successText: {
    fontFamily: 'Inter',
    fontSize: typography.bodyMd.fontSize,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 22,
  },
  emailHighlight: {
    fontWeight: '600',
    color: colors.onSurface,
  },
  footer: {
    marginTop: spacing.stackLg,
  },
  footerLink: {
    fontFamily: 'Inter',
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '600',
    color: colors.primary,
    textAlign: 'center',
  },
})