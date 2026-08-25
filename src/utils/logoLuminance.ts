// ─── Logo luminance detection — decides whether a brand logo needs a light backdrop ───
// Some TMDb network/company logos are dark (black wordmarks) and vanish on the
// app's dark surfaces. We decode the logo with the already-installed Skia,
// compute an alpha-weighted average luminance over its non-transparent pixels,
// and let callers render those logos on a light tile instead. Any failure
// resolves to null so callers simply keep their default styling.
//
// Verdicts are memoized per session AND persisted to MMKV, so each unique
// logo is downloaded-for-analysis exactly once per device install.

import { AlphaType, ColorType, Skia } from '@shopify/react-native-skia'
import { mmkvLocalSync } from '@/lib/mmkv'

// Relative luminance at or below this counts as "dark" (white ≈ 1.0, black ≈ 0)
const DARK_LUMINANCE_THRESHOLD = 0.45

// Where persisted verdicts live (~70 bytes per logo; a stale entry is harmless —
// re-uploaded brand logos get a new TMDb file path, i.e. a new cache key)
const STORAGE_KEY = 'bingetime-logo-luminance'

// One detection per unique URL for the current session (fast path)
const cache = new Map<string, Promise<boolean | null>>()

// Disk-backed verdicts, lazily hydrated once per session
let persistedVerdicts: Record<string, boolean> | null = null

function loadPersisted(): Record<string, boolean> {
  if (persistedVerdicts) return persistedVerdicts
  persistedVerdicts = {}
  try {
    const raw = mmkvLocalSync.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === 'boolean') persistedVerdicts[key] = value
      }
    }
  } catch {
    // Corrupt/unreadable data — start fresh rather than crash
    persistedVerdicts = {}
  }
  return persistedVerdicts
}

function persistVerdict(url: string, isDark: boolean) {
  const store = loadPersisted()
  store[url] = isDark
  try {
    mmkvLocalSync.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    // Best-effort persistence — the in-memory cache still covers this session
  }
}

function toLuma(r: number, g: number, b: number): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}

async function computeIsDark(url: string): Promise<boolean | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const buf = await res.arrayBuffer()

    const data = Skia.Data.fromBytes(new Uint8Array(buf))
    const decoded = Skia.Image.MakeImageFromEncoded(data)
    if (!decoded) return null

    const w = decoded.width()
    const h = decoded.height()
    if (!w || !h) return null

    // Rasterize first if the decoded image is GPU-backed so pixels are readable
    const image = decoded.makeNonTextureImage() ?? decoded

    const pixels = image.readPixels(0, 0, {
      width: w,
      height: h,
      colorType: ColorType.RGBA_8888,
      alphaType: AlphaType.Unpremul,
    })
    if (!pixels || pixels.length < w * h * 4) return null

    // Alpha-weighted mean luminance — ignores the transparent backdrop so only
    // the actual mark contributes (logos ship on transparent backgrounds)
    let lumaSum = 0
    let alphaSum = 0
    for (let i = 0; i + 3 < pixels.length; i += 4) {
      const a = pixels[i + 3]
      if (a === 0) continue
      lumaSum += toLuma(pixels[i], pixels[i + 1], pixels[i + 2]) * a
      alphaSum += a
    }
    if (alphaSum === 0) return null // nothing visible

    return lumaSum / alphaSum < DARK_LUMINANCE_THRESHOLD
  } catch {
    return null
  }
}

/**
 * Resolution order: session cache → MMKV-persisted verdict → fetch + Skia analysis.
 * Resolves:
 * - `true`  → logo is dark, render it on a light tile
 * - `false` → logo reads fine on dark surfaces, keep default styling
 * - `null`  → detection failed, keep default styling (not persisted — retries next session)
 */
export function getLogoIsDark(url: string | null | undefined): Promise<boolean | null> {
  if (!url) return Promise.resolve(null)

  let cached = cache.get(url)
  if (!cached) {
    const saved = loadPersisted()[url]
    if (typeof saved === 'boolean') {
      cached = Promise.resolve(saved)
      cache.set(url, cached)
    } else {
      cached = computeIsDark(url).then((result) => {
        // Persist successful verdicts only
        if (result !== null) persistVerdict(url, result)
        return result
      })
      cache.set(url, cached)
      cached.catch(() => {}) // never surface unhandled rejections from the cache entry
    }
  }
  return cached
}
