// ─── All Credits — 4-col unified small posters ───
import { useCallback, useMemo, useState } from 'react'
import { View, Text, Pressable, StyleSheet, FlatList, ActivityIndicator, useWindowDimensions } from 'react-native'
import { useLocalSearchParams, router, Stack } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { usePerson, dedupeCredits } from '@/lib/queries/people'
import type { TMDbCombinedCredit } from '@/lib/tmdb'
import CreditCard from '@/components/detail/CreditCard'
import { typography, spacing, borderRadius } from '@/theme'
import { useTheme } from '@/contexts/ThemeContext'

type CreditFilter='all'|'movie'|'tv'; type CreditSort='newest'|'oldest'|'popular'|'az'
const FILTER_SEGMENTS: {key:CreditFilter,label:string}[]=[{key:'all',label:'All'},{key:'movie',label:'Movies'},{key:'tv',label:'TV'}]
const SORT_OPTIONS: {key:CreditSort,label:string}[]=[{key:'newest',label:'Newest'},{key:'oldest',label:'Oldest'},{key:'popular',label:'Popular'},{key:'az',label:'A–Z'}]
const GRID_COLUMNS=4
function creditYear(c: TMDbCombinedCredit){ return (c.release_date??c.first_air_date??'').slice(0,4) }

export default function PersonCreditsScreen(){
  const { id }=useLocalSearchParams<{id:string}>()
  const insets=useSafeAreaInsets(); const { colors }=useTheme(); const { width: windowWidth }=useWindowDimensions()
  const cellWidth=useMemo(()=> (windowWidth - spacing.marginMobile*2 - 10*(GRID_COLUMNS-1))/GRID_COLUMNS, [windowWidth])
  const [filter,setFilter]=useState<CreditFilter>('all'); const [sort,setSort]=useState<CreditSort>('newest')
  const personId=/^\d+$/.test(id)?parseInt(id,10):null; const isValidId=personId!=null
  const { data: person, isLoading }=usePerson(isValidId?personId:undefined)
  const styles=useMemo(()=>StyleSheet.create({
    container:{ flex:1, backgroundColor: colors.surface },
    centered:{ justifyContent:'center', alignItems:'center' },
    errorText:{ fontSize: typography.bodyMd.fontSize, color: colors.onSurfaceVariant, marginTop:12, marginBottom:16 },
    goBackButton:{ paddingHorizontal:20, paddingVertical:10, backgroundColor: colors.surfaceContainer, borderRadius: borderRadius.md, borderWidth:1, borderColor: colors.outlineVariant },
    goBackText:{ color: colors.primary, fontSize: typography.bodySm.fontSize, fontWeight:'600' },
    header:{ flexDirection:'row', alignItems:'center', gap:8, paddingHorizontal: spacing.marginMobile, paddingBottom:12 },
    headerBackButton:{ width:36, height:36, borderRadius: borderRadius.full, justifyContent:'center', alignItems:'center', marginLeft:-8 },
    headerTitle:{ fontFamily:'Inter', fontSize: typography.headlineSm.fontSize, fontWeight:'700', lineHeight: typography.headlineSm.lineHeight, color: colors.onSurface },
    track:{ flexDirection:'row', marginHorizontal: spacing.marginMobile, marginBottom:8, padding:3, borderRadius: borderRadius.full, backgroundColor: colors.surfaceContainerHighest },
    segment:{ flex:1, paddingVertical:7, borderRadius: borderRadius.full, alignItems:'center' },
    segmentActive:{ backgroundColor: colors.primary },
    segmentText:{ fontFamily:'Inter', fontSize: typography.labelMd.fontSize, fontWeight:'600', lineHeight: typography.labelMd.lineHeight, color: colors.onSurfaceVariant },
    segmentTextActive:{ color: colors.onPrimary },
    sortRow:{ flexDirection:'row', gap:8, marginHorizontal: spacing.marginMobile, marginBottom:14 },
    sortChip:{ paddingHorizontal:14, paddingVertical:6, borderRadius: borderRadius.full, backgroundColor: colors.surfaceContainerHighest, borderWidth:1, borderColor: colors.outlineVariant },
    sortChipActive:{ backgroundColor: colors.primary, borderColor: colors.primary },
    sortChipText:{ fontFamily:'Inter', fontSize: typography.labelSm.fontSize, fontWeight:'600', lineHeight: typography.labelSm.lineHeight, color: colors.onSurfaceVariant },
    sortChipTextActive:{ color: colors.onPrimary },
    list:{ flex:1 },
    listContent:{ paddingHorizontal: spacing.marginMobile, paddingBottom:40 },
    columnWrapper:{ justifyContent:'flex-start', gap:10, marginBottom:14 },
    emptyText:{ fontSize: typography.bodyMd.fontSize, color: colors.onSurfaceVariant, textAlign:'center', paddingTop:48 },
  }),[colors])

  const credits=useMemo(()=>{
    const all=dedupeCredits(person)
    const filtered=filter==='all'?all:all.filter(c=>c.media_type===filter)
    const titleOf=(c:TMDbCombinedCredit)=>(c.title??c.name??'').toLowerCase()
    return [...filtered].sort((a,b)=>{
      const ya=a.release_date??a.first_air_date??''; const yb=b.release_date??b.first_air_date??''
      switch(sort){
        case 'oldest': return ya.localeCompare(yb) || titleOf(a).localeCompare(titleOf(b))
        case 'popular': return (b.popularity??0)-(a.popularity??0) || yb.localeCompare(ya)
        case 'az': return titleOf(a).localeCompare(titleOf(b))
        case 'newest': default: return yb.localeCompare(ya) || titleOf(a).localeCompare(titleOf(b))
      }
    })
  },[person, filter, sort])

  const handleBack=useCallback(()=>router.back(),[])
  const renderItem=useCallback(({item,index}:{item:TMDbCombinedCredit,index:number})=>{
    const title=item.title??item.name??'Unknown'; const year=creditYear(item); const roleLabel=item.character?.trim()||item.job?.trim()||''
    const card=<CreditCard posterPath={item.poster_path??null} title={title} year={year||null} roleLabel={roleLabel} width={cellWidth} compact onPress={()=>router.push(item.media_type==='tv'?`/show/${item.id}`:`/movie/${item.id}`)} />
    if(index===0 && __DEV__) return <View onLayout={(e)=>console.log('[measure] Credits grid cell width:', e.nativeEvent.layout.width)}>{card}</View>
    return card
  },[cellWidth])

  if(!isValidId) return (<View style={[styles.container, styles.centered, { paddingTop: insets.top }]}><Stack.Screen options={{ headerShown:false }} /><Ionicons name="alert-circle-outline" size={48} color={colors.onSurfaceVariant} /><Text style={styles.errorText}>Could not load person credits</Text><Pressable onPress={handleBack} style={styles.goBackButton}><Text style={styles.goBackText}>Go back</Text></Pressable></View>)
  if(isLoading || !person) return (<View style={[styles.container, styles.centered, { paddingTop: insets.top }]}><Stack.Screen options={{ headerShown:false }} /><ActivityIndicator size="large" color={colors.primary} /></View>)
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown:false }} />
      <View style={styles.header}><Pressable onPress={handleBack} style={styles.headerBackButton} accessibilityRole="button" accessibilityLabel="Go back"><Ionicons name="chevron-back" size={24} color={colors.primary} /></Pressable><Text style={styles.headerTitle}>All Credits</Text></View>
      <View style={styles.track}>{FILTER_SEGMENTS.map(s=>{ const isActive=s.key===filter; return <Pressable key={s.key} style={[styles.segment, isActive && styles.segmentActive]} onPress={()=>{ if(!isActive){ Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setFilter(s.key) }}} accessibilityRole="tab" accessibilityState={{selected:isActive}}><Text style={[styles.segmentText, isActive && styles.segmentTextActive]}>{s.label}</Text></Pressable> })}</View>
      <View style={styles.sortRow}>{SORT_OPTIONS.map(o=>{ const isActive=o.key===sort; return <Pressable key={o.key} style={[styles.sortChip, isActive && styles.sortChipActive]} onPress={()=>{ if(!isActive){ Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSort(o.key) }}} accessibilityRole="button" accessibilityState={{selected:isActive}}><Text style={[styles.sortChipText, isActive && styles.sortChipTextActive]}>{o.label}</Text></Pressable> })}</View>
      <FlatList style={styles.list} contentContainerStyle={styles.listContent} columnWrapperStyle={styles.columnWrapper} numColumns={GRID_COLUMNS} data={credits} keyExtractor={(c)=>`${c.media_type}-${c.id}`} renderItem={renderItem} showsVerticalScrollIndicator={false} initialNumToRender={20} ListEmptyComponent={<Text style={styles.emptyText}>No credits found</Text>} />
    </View>
  )
}
