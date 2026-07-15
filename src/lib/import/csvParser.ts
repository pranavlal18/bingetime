// ─── CSV Parser — reads TV Time export CSVs from bundled assets ───

import Papa from 'papaparse'
import { Asset } from 'expo-asset'
import { Platform } from 'react-native'
import { 
  readAsStringAsync, 
  copyAsync, 
  EncodingType, 
  documentDirectory 
} from 'expo-file-system/legacy'
import type {
  FollowedTvShowRow,
  UserTvShowDataRow,
  TrackingV2Row,
  TrackingProdRecordRow,
} from './types'

// ── Static asset map (Metro needs static require() calls) ──

const csvAssets: Record<string, number> = {
  'followed_tv_show.csv': require('../../../assets/csv/followed_tv_show.csv'),
  'user_tv_show_data.csv': require('../../../assets/csv/user_tv_show_data.csv'),
  'tracking-prod-records-v2.csv': require('../../../assets/csv/tracking-prod-records-v2.csv'),
  'tracking-prod-records.csv': require('../../../assets/csv/tracking-prod-records.csv'),
}

/** Read a text file from a local URI, works on both native and web */
async function readFile(uri: string): Promise<string> {
  if (Platform.OS === 'web') {
    const res = await fetch(uri)
    return res.text()
  }

  // Native — Try direct read first (this works best for content:// URIs)
  try {
    return await readAsStringAsync(uri, { encoding: EncodingType.UTF8 })
  } catch (error) {
    console.log('Direct read failed, attempting copy to safe path:', error)
    
    // Fallback: copy to a secure document directory location
    const safeUri = `${documentDirectory}import_temp.csv`
    await copyAsync({ from: uri, to: safeUri })
    return await readAsStringAsync(safeUri, { encoding: EncodingType.UTF8 })
  }
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

export async function readTrackingProdRecords(): Promise<TrackingProdRecordRow[]> {
  const allRows = await readCsv<TrackingProdRecordRow>('tracking-prod-records.csv')
  // Filter to only movie rows (entity_type === 'movie')
  return allRows.filter((r) => r.entity_type === 'movie' && r.movie_name)
}

// ── Combined reader for all files ──

export interface AllCsvData {
  followedShows: FollowedTvShowRow[]
  userShowData: UserTvShowDataRow[]
  trackingV2: TrackingV2Row[]
  movieRecords: TrackingProdRecordRow[]
}

export async function readAllCsvs(): Promise<AllCsvData> {
  const [followedShows, userShowData, trackingV2, movieRecords] =
    await Promise.all([
      readFollowedTvShows(),
      readUserTvShowData(),
      readTrackingV2(),
      readTrackingProdRecords(),
    ])

  return { followedShows, userShowData, trackingV2, movieRecords }
}

// ── File picker helpers ──

export type CsvFileType =
  | 'followed_tv_show'
  | 'user_tv_show_data'
  | 'tracking_prod_records_v2'
  | 'tracking_prod_records'
  | 'unknown'

const CSV_SIGNATURES: Record<string, string[]> = {
  followed_tv_show: ['tv_show_id', 'tv_show_name', 'active', 'created_at', 'updated_at'],
  user_tv_show_data: ['tv_show_id', 'tv_show_name', 'is_favorited', 'nb_episodes_seen'],
  tracking_prod_records_v2: ['s_id', 'key', 'ep_id', 'ep_no', 's_no'],
  tracking_prod_records: ['type', 'entity_type', 'movie_name'],
}

/** Detect which TV Time CSV file a set of headers belongs to */
export function detectCsvType(headers: string[]): CsvFileType {
  const normalized = headers.map((h) => h.trim().toLowerCase())
  for (const [type, sig] of Object.entries(CSV_SIGNATURES)) {
    if (sig.every((col) => normalized.includes(col))) {
      return type as CsvFileType
    }
  }
  return 'unknown'
}

/** Parse raw CSV text into typed rows (no filtering) */
export function parseCsvFromString<T = Record<string, string>>(
  content: string
): { headers: string[]; data: T[] } {
  const result = Papa.parse<T>(content, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  })
  return {
    headers: result.meta.fields ?? [],
    data: result.data,
  }
}

/** Read a CSV file from an arbitrary URI (e.g. from expo-document-picker) */
export async function readCsvFromUri(
  uri: string
): Promise<{ headers: string[]; data: Record<string, string>[] }> {
  const content = await readFile(uri)
  return parseCsvFromString(content)
}

/** Read and detect a single picked CSV file */
export async function parsePickedFile(
  uri: string,
  fileName?: string
): Promise<{ type: CsvFileType; data: Record<string, string>[]; headers: string[] }> {
  const { headers, data } = await readCsvFromUri(uri)
  const type = detectCsvType(headers)
  return { type, data, headers }
}

/** Assemble individually picked CSV data into AllCsvData */
export function assembleAllCsvData(
  picked: Array<{ type: CsvFileType; data: Record<string, string>[] }>
): AllCsvData {
  const result: AllCsvData = {
    followedShows: [],
    userShowData: [],
    trackingV2: [],
    movieRecords: [],
  }

  for (const file of picked) {
    switch (file.type) {
      case 'followed_tv_show':
        result.followedShows = file.data.filter(
          (r) => r.tv_show_id && r.tv_show_name
        ) as any
        break
      case 'user_tv_show_data':
        result.userShowData = file.data.filter(
          (r) => r.tv_show_id && r.tv_show_name
        ) as any
        break
      case 'tracking_prod_records_v2':
        result.trackingV2 = file.data as any
        break
      case 'tracking_prod_records':
        result.movieRecords = file.data.filter(
          (r) => r.entity_type === 'movie' && r.movie_name
        ) as any
        break
    }
  }

  return result
}
