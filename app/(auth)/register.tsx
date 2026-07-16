import { useState, useMemo } from 'react'
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
import { Image } from 'expo-image'
import { useAuth } from '@/contexts/AuthContext'
import { typography, spacing, borderRadius } from '@/theme'
import { useTheme } from '@/contexts/ThemeContext'

export default function RegisterScreen() {
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
    borderWidth: 1,
    borderColor: colors.primary + '30',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
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
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.stackLg,
    gap: spacing.stackSm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.outlineVariant,
  },
  dividerText: {
    fontFamily: 'Inter',
    fontSize: typography.labelMd.fontSize,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
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
  const { signUp, loading: authLoading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!email || !password || !confirmPassword) {
      setError('Please fill in all fields')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    setError('')
    setLoading(true)
    if (__DEV__) console.log('📝 [RegisterScreen] Attempting sign up:', { email })
    const { error, data } = await signUp(email, password)
    setLoading(false)
    if (error) {
      if (__DEV__) console.log('❌ [RegisterScreen] Sign up error:', error.message)
      setError('An error occurred during registration. Please try again.')
    } else {
      if (__DEV__) console.log('✅ [RegisterScreen] Sign up success:', { user: data.user?.email })
      Alert.alert(
        'Account created!',
        'Please check your email to verify your account, then sign in.',
        [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }],
        { cancelable: false }
      )
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
            <Image
              source={require('../../assets/logo.png')}
              style={{ width: '100%', height: '100%', borderRadius: borderRadius.xl }}
              contentFit="contain"
            />
          </View>
          <Text style={styles.title}>BingeTime</Text>
          <Text style={styles.subtitle}>Track your shows & movies</Text>
        </View>

        <View style={styles.formContainer}>
          <Text style={styles.formTitle}>Create account</Text>
          <Text style={styles.formSubtitle}>Start tracking what you watch</Text>

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
                returnKeyType="next"
                editable={!loading}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.outlineVariant} style={styles.inputIcon} />
<TextInput
                style={styles.input}
                placeholder="Password (min 6 chars)"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="new-password"
                textContentType="newPassword"
                returnKeyType="next"
                onSubmitEditing={() => setConfirmPassword('')}
                editable={!loading}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.outlineVariant} style={styles.inputIcon} />
<TextInput
                style={styles.input}
                placeholder="Confirm password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoComplete="new-password"
                textContentType="newPassword"
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
              <Text style={styles.submitButtonText}>Create Account</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account?</Text>
          <Pressable onPress={() => router.replace('/(auth)/login')}>
            <Text style={styles.footerLink}>Sign in</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

