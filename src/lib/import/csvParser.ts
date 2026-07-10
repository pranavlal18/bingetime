// ─── CSV Parser — reads TV Time export CSVs from bundled assets ───

import Papa from 'papaparse'
import { Asset } from 'expo-asset'
import { Platform } from 'react-native'
import type {
  FollowedTvShowRow,
  UserTvShowDataRow,
  TrackingV2Row,
  ShowSeenEpisodeLatestRow,
  UserShowSpecialStatusRow,
  TrackingProdRecordRow,
  ListsProdListRow,
} from './types'

// ── Static asset map (Metro needs static require() calls) ──

const csvAssets: Record<string, number> = {
  'followed_tv_show.csv': require('../../../assets/csv/followed_tv_show.csv'),
  'user_tv_show_data.csv': require('../../../assets/csv/user_tv_show_data.csv'),
  'tracking-prod-records-v2.csv': require('../../../assets/csv/tracking-prod-records-v2.csv'),
  'show_seen_episode_latest.csv': require('../../../assets/csv/show_seen_episode_latest.csv'),
  'user_show_special_status.csv': require('../../../assets/csv/user_show_special_status.csv'),
  'tracking-prod-records.csv': require('../../../assets/csv/tracking-prod-records.csv'),
  'lists-prod-lists.csv': require('../../../assets/csv/lists-prod-lists.csv'),
}

/** Read a text file from a local URI, works on both native and web */
async function readFile(uri: string): Promise<string> {
  if (Platform.OS === 'web') {
    const res = await fetch(uri)
    return res.text()
  }
  // Native — use expo-file-system (legacy API, the new File/Directory API is not needed for simple reads)
  const { readAsStringAsync, EncodingType } = await import(
    'expo-file-system/legacy'
  )
  return readAsStringAsync(uri, { encoding: EncodingType.UTF8 })
}

/** Read a CSV file from bundled assets and parse it */
async function readCsv<T>(assetPath: string): Promise<T[]> {
  // Resolve the asset via the static map
  const asset = Asset.fromModule(csvAssets[assetPath])

  let uri: string
  if (Platform.OS === 'web') {
    // On web, assets are served live by Metro — no download needed
    uri = asset.uri
  } else {
    await asset.downloadAsync()
    if (!asset.localUri) {
      throw new Error(`Failed to resolve asset: ${assetPath}`)
    }
    uri = asset.localUri
  }

  const content = await readFile(uri)

  const result = Papa.parse<T>(content, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false, // keep all values as strings
  })

  if (result.errors.length > 0) {
    console.warn(`CSV parse warnings for ${assetPath}:`, result.errors)
  }

  return result.data
}

// ── Individual file readers ──

export async function readFollowedTvShows(): Promise<FollowedTvShowRow[]> {
  const rows = await readCsv<FollowedTvShowRow>('followed_tv_show.csv')
  return rows.filter((r) => r.tv_show_id && r.tv_show_name)
}

export async function readUserTvShowData(): Promise<UserTvShowDataRow[]> {
  const rows = await readCsv<UserTvShowDataRow>('user_tv_show_data.csv')
  return rows.filter((r) => r.tv_show_id && r.tv_show_name)
}

export async function readTrackingV2(): Promise<TrackingV2Row[]> {
  return readCsv<TrackingV2Row>('tracking-prod-records-v2.csv')
}

export async function readShowSeenEpisodeLatest(): Promise<ShowSeenEpisodeLatestRow[]> {
  const rows = await readCsv<ShowSeenEpisodeLatestRow>('show_seen_episode_latest.csv')
  return rows.filter((r) => r.tv_show_id && r.tv_show_name)
}

export async function readUserShowSpecialStatus(): Promise<UserShowSpecialStatusRow[]> {
  const rows = await readCsv<UserShowSpecialStatusRow>('user_show_special_status.csv')
  return rows.filter((r) => r.tv_show_id && r.status === 'for_later')
}

export async function readTrackingProdRecords(): Promise<TrackingProdRecordRow[]> {
  const allRows = await readCsv<TrackingProdRecordRow>('tracking-prod-records.csv')
  // Filter to only movie rows (entity_type === 'movie')
  return allRows.filter((r) => r.entity_type === 'movie' && r.movie_name)
}

export async function readListsProdLists(): Promise<ListsProdListRow[]> {
  const rows = await readCsv<ListsProdListRow>('lists-prod-lists.csv')
  return rows.filter((r) => r.name || r.objects)
}

// ── Combined reader for all files ──

export interface AllCsvData {
  followedShows: FollowedTvShowRow[]
  userShowData: UserTvShowDataRow[]
  trackingV2: TrackingV2Row[]
  seenEpisodeLatest: ShowSeenEpisodeLatestRow[]
  specialStatus: UserShowSpecialStatusRow[]
  movieRecords: TrackingProdRecordRow[]
  listRows: ListsProdListRow[]
}

export async function readAllCsvs(): Promise<AllCsvData> {
  const [followedShows, userShowData, trackingV2, seenEpisodeLatest, specialStatus, movieRecords, listRows] =
    await Promise.all([
      readFollowedTvShows(),
      readUserTvShowData(),
      readTrackingV2(),
      readShowSeenEpisodeLatest(),
      readUserShowSpecialStatus(),
      readTrackingProdRecords(),
      readListsProdLists(),
    ])

  return { followedShows, userShowData, trackingV2, seenEpisodeLatest, specialStatus, movieRecords, listRows }
}
