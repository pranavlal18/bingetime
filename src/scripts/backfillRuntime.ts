// ─── Backfill average_runtime for existing shows ───
// Run this in the app console or as a one-time script

import { supabase } from '@/lib/supabase'
import { getShowDetails } from '@/lib/tmdb'

async function backfillAverageRuntime() {
  // 1. Get all shows that have tmdb_id but missing average_runtime
  const { data: shows, error } = await supabase
    .from('shows')
    .select('id, tmdb_id, name')
    .not('tmdb_id', 'is', null)
    .is('average_runtime', null)

  if (error) {
    console.error('Error fetching shows:', error)
    return
  }

  console.log(`Found ${shows?.length || 0} shows to backfill`)

  if (!shows || shows.length === 0) {
    console.log('No shows need backfill')
    return
  }

  let updated = 0
  let failed = 0

  for (const show of shows) {
    try {
      // Fetch full details from TMDb
      const details = await getShowDetails(show.tmdb_id!)
      
      let averageRuntime: number | null = null
      if (details.episode_run_time && details.episode_run_time.length > 0) {
        const sum = details.episode_run_time.reduce((acc, val) => acc + val, 0)
        const avgMinutes = sum / details.episode_run_time.length
        averageRuntime = Math.round(avgMinutes * 60) // convert to seconds
      }

      if (averageRuntime) {
        const { error: updateError } = await supabase
          .from('shows')
          .update({ average_runtime: averageRuntime })
          .eq('id', show.id)

        if (updateError) {
          console.error(`Failed to update ${show.name}:`, updateError)
          failed++
        } else {
          console.log(`✅ Updated ${show.name}: ${averageRuntime}s`)
          updated++
        }
      } else {
        console.log(`⚠️ No runtime data for ${show.name}`)
      }

      // Rate limit: 100ms between requests
      await new Promise(r => setTimeout(r, 100))
    } catch (err) {
      console.error(`Error processing ${show.name}:`, err)
      failed++
    }
  }

  console.log(`\nDone! Updated: ${updated}, Failed: ${failed}`)
}

// Run it
backfillAverageRuntime()