// ─── Person Page — bio card, structured header, 76px Known For ───
import { useMemo, useState } from 'react'
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { useLocalSearchParams, router, Stack } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { usePerson, topKnownFor } from '@/lib/queries/people'
import { getImageUrl, type TMDbCombinedCredit } from '@/lib/tmdb'
import CreditCard from '@/components/detail/CreditCard'
import { typography, spacing, borderRadius } from '@/theme'
import { useTheme } from '@/contexts/ThemeContext'

const PORTRAIT_W = 112
const PORTRAIT_H = 168
const KNOWN_FOR_W = 76
const KNOWN_FOR_GAP = 10

export default function PersonPage() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()
  const [bioExpanded, setBioExpanded] = useState(false)
  const personId = /^\d+$/.test(id) ? parseInt(id, 10) : null
  const { data: person, isLoading, error } = usePerson(personId)
  const knownFor = useMemo(() => topKnownFor(person), [person])
  const styles = useMemo(() => StyleSheet.create({
    container: { flex:1, backgroundColor: colors.surface },
    centered: { justifyContent:'center', alignItems:'center' },
    errorText: { fontSize: typography.bodyMd.fontSize, color: colors.onSurfaceVariant, marginTop:12, marginBottom:16 },
    goBackButton: { paddingHorizontal:20, paddingVertical:10, backgroundColor: colors.surfaceContainer, borderRadius: borderRadius.md, borderWidth:1, borderColor: colors.outlineVariant },
    goBackText: { color: colors.primary, fontSize: typography.bodySm.fontSize, fontWeight:'600' },
    scroll: { flex:1 },
    backButton: { position:'absolute', top: insets.top+8, left: spacing.marginMobile, width:44, height:44, borderRadius: borderRadius.full, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'center', alignItems:'center', zIndex:10 },
    headerRow: { flexDirection:'row', gap:14, paddingHorizontal: spacing.marginMobile, paddingTop: insets.top+16, marginBottom:24 },
    portrait: { width: PORTRAIT_W, height: PORTRAIT_H, borderRadius: borderRadius.lg, backgroundColor: colors.surfaceContainerHighest },
    portraitFallback: { justifyContent:'center', alignItems:'center' },
    portraitInitial: { fontFamily:'Inter', fontSize: typography.headlineLg.fontSize, fontWeight:'600', color: colors.onSurfaceVariant },
    headerMeta: { flex:1, justifyContent:'center', gap:7 },
    name: { fontFamily:'Inter', fontSize: typography.headlineMd.fontSize, fontWeight:'700', lineHeight: typography.headlineMd.lineHeight, color: colors.onSurface },
    departmentPill: { alignSelf:'flex-start', paddingHorizontal:10, paddingVertical:4, borderRadius: borderRadius.full, backgroundColor: colors.surfaceContainerHighest },
    departmentText: { fontFamily:'Inter', fontSize: typography.labelSm.fontSize, fontWeight:'500', lineHeight: typography.labelSm.lineHeight, letterSpacing: typography.labelSm.letterSpacing, color: colors.onSurfaceVariant },
    birthLine: { fontFamily:'Inter', fontSize:13, fontWeight:'400', lineHeight:18, color: colors.onSurfaceVariant },
    section: { paddingHorizontal: spacing.marginMobile, marginBottom:24 },
    sectionTitle: { fontFamily:'Inter', fontSize: typography.bodyLg.fontSize, fontWeight:'700', lineHeight: typography.bodyLg.lineHeight, color: colors.onSurface, marginBottom:10 },
    bioCard: { backgroundColor: colors.surfaceContainer, borderWidth:1, borderColor: colors.outlineVariant, borderRadius: borderRadius.lg, padding:12 },
    bioCardTitle: { fontFamily:'Inter', fontSize: typography.bodyLg.fontSize, fontWeight:'700', lineHeight: typography.bodyLg.lineHeight, color: colors.onSurface, marginBottom:8 },
    bioText: { fontFamily:'Inter', fontSize: typography.bodyMd.fontSize, fontWeight:'400', lineHeight: typography.bodyMd.lineHeight, color: colors.onSurfaceVariant },
    bioToggle: { alignSelf:'flex-start', marginTop:8 },
    bioToggleText: { fontFamily:'Inter', fontSize: typography.labelSm.fontSize, fontWeight:'600', lineHeight: typography.labelSm.lineHeight, letterSpacing: typography.labelSm.letterSpacing, color: colors.primary },
    knownForSection: { marginBottom:24 },
    knownForHeader: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:8, paddingHorizontal: spacing.marginMobile },
    knownForCount: { paddingHorizontal:8, paddingVertical:2, borderRadius: borderRadius.full, backgroundColor: colors.surfaceContainerHighest },
    knownForCountText: { fontFamily:'Inter', fontSize:12, fontWeight:'600', color: colors.onSurfaceVariant },
    seeAllButton: { alignSelf:'flex-start' },
    seeAllText: { fontFamily:'Inter', fontSize: typography.labelMd.fontSize, fontWeight:'600', lineHeight: typography.labelMd.lineHeight, color: colors.primary },
    knownForScroller: { marginHorizontal: -spacing.marginMobile },
    knownForRow: { gap: KNOWN_FOR_GAP, paddingHorizontal: spacing.marginMobile },
  }), [colors, insets.top])

  if (isLoading) { return (<View style={[styles.container, styles.centered, { paddingTop: insets.top }]}><ActivityIndicator size="large" color={colors.primary} /></View>) }
  if (error || (!person && !isLoading)) { return (<View style={[styles.container, styles.centered, { paddingTop: insets.top }]}><Ionicons name="alert-circle-outline" size={48} color={colors.onSurfaceVariant} /><Text style={styles.errorText}>Could not load person details</Text><Pressable onPress={() => router.back()} style={styles.goBackButton}><Text style={styles.goBackText}>Go back</Text></Pressable></View>) }
  if (!person) return null
  const biography = person.biography ?? ''
  const birthYear = person.birthday?.slice(0,4)
  const deathYear = person.deathday?.slice(0,4)
  const portraitUrl = getImageUrl(person.profile_path ?? null, 'w342')
  let birthLine: string | null = null
  if (deathYear) birthLine = birthYear ? `${birthYear}–${deathYear}` : `–${deathYear}`
  else { const parts=[birthYear, person.place_of_birth].filter(Boolean) as string[]; birthLine = parts.length? parts.join(' · '): null }
  const handleBack=()=>router.back()
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown:false }} />
      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: insets.bottom+40 }} showsVerticalScrollIndicator={false}>
        <Pressable onPress={handleBack} style={styles.backButton}><Ionicons name="chevron-back" size={24} color={colors.primary} /></Pressable>
        <View style={styles.headerRow}>
          {portraitUrl ? <Image source={{ uri: portraitUrl }} style={styles.portrait} contentFit="cover" cachePolicy="memory-disk" transition={150} /> : <View style={[styles.portrait, styles.portraitFallback]}><Text style={styles.portraitInitial}>{person.name.charAt(0)}</Text></View>}
          <View style={styles.headerMeta}>
            <Text style={styles.name}>{person.name}</Text>
            {person.known_for_department ? <View style={styles.departmentPill}><Text style={styles.departmentText}>{person.known_for_department}</Text></View> : null}
            {birthLine ? <Text style={styles.birthLine}>{birthLine}</Text> : null}
          </View>
        </View>
        {biography.length>0 ? <View style={styles.section}><View style={styles.bioCard}><Text style={styles.bioCardTitle}>Biography</Text><Text style={styles.bioText} numberOfLines={bioExpanded?undefined:5}>{biography}</Text>{biography.length>=200 ? <Pressable onPress={()=>setBioExpanded(v=>!v)} style={styles.bioToggle}><Text style={styles.bioToggleText}>{bioExpanded?'Show less':'Read more'}</Text></Pressable> : null}</View></View> : null}
        {knownFor.length>0 ? <View style={styles.knownForSection}><View style={styles.knownForHeader}><View style={{ flexDirection:'row', alignItems:'center', gap:8}}><Text style={styles.sectionTitle}>Known For</Text><View style={styles.knownForCount}><Text style={styles.knownForCountText}>{knownFor.length}</Text></View></View><Pressable onPress={()=>router.push(`/person/${id}/credits`)} style={styles.seeAllButton} accessibilityRole="button" accessibilityLabel="See all credits"><Text style={styles.seeAllText}>See All</Text></Pressable></View><ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.knownForScroller} contentContainerStyle={styles.knownForRow}>{knownFor.map((credit: TMDbCombinedCredit, index)=>{ const title=credit.title??credit.name??''; const year=(credit.release_date??credit.first_air_date??'')?.slice(0,4); return index===0 && __DEV__ ? <View key={`${credit.media_type}-${credit.id}`} onLayout={(e)=>console.log('[measure] Known For card width:', e.nativeEvent.layout.width)}><CreditCard posterPath={credit.poster_path??null} title={title} year={year||null} width={KNOWN_FOR_W} onPress={()=>router.push(credit.media_type==='tv'?`/show/${credit.id}`:`/movie/${credit.id}`)} /></View> : <CreditCard key={`${credit.media_type}-${credit.id}`} posterPath={credit.poster_path??null} title={title} year={year||null} width={KNOWN_FOR_W} onPress={()=>router.push(credit.media_type==='tv'?`/show/${credit.id}`:`/movie/${credit.id}`)} /> })}</ScrollView></View> : null}
      </ScrollView>
    </View>
  )
}
