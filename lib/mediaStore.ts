"use client"

import { useEffect, useState } from "react"

/**
 * Media (uploaded images + videos) lives in IndexedDB as Blobs; localStorage
 * only ever holds a short `idb:<key>` reference to it.
 *
 * Why: localStorage caps out around 5-10MB per origin (measured ~12.5MB in
 * Chrome here) and only stores strings, so media had to be base64-encoded —
 * which inflates it by ~33% on top of being uncompressed. Two phone
 * screenshots were enough to blow the whole budget, and every save after that
 * threw QuotaExceededError, which surfaced as "couldn't save" with no way out.
 * IndexedDB stores real binary Blobs and reports a ~6GB quota on the same
 * browser, so the ceiling stops being something anyone can reach by hand.
 */

const DB_NAME = "portfolio-media"
const STORE = "blobs"
export const MEDIA_REF_PREFIX = "idb:"

export function isMediaRef(src: string): boolean {
  return typeof src === "string" && src.startsWith(MEDIA_REF_PREFIX)
}

/** ref -> object URL. Object URLs are per-document, so this cache is rebuilt
 *  on each page load; entries live until the document goes away (revoking
 *  eagerly would break any <img> still pointing at one). */
const urlCache = new Map<string, string>()

/** Refs created during this page's lifetime. Never garbage-collected, even if
 *  they aren't in localStorage yet — a just-uploaded image is briefly only in
 *  React state, and GC must not race ahead and delete it. */
const sessionRefs = new Set<string>()

function idbAvailable(): boolean {
  return typeof indexedDB !== "undefined"
}

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (!idbAvailable()) return Promise.reject(new Error("IndexedDB unavailable"))
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
    // Safari private mode and a blocked upgrade both hang the request open
    // rather than erroring; don't let a caller await forever.
    req.onblocked = () => reject(new Error("IndexedDB blocked"))
  })
  // a failed open must not be cached forever — the next call should retry
  dbPromise.catch(() => { dbPromise = null })
  return dbPromise
}

function runTx<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(db => new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const req = fn(tx.objectStore(STORE))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
    tx.onabort = () => reject(tx.error)
  }))
}

/** Stores a blob and returns the `idb:<key>` ref to save in place of the src. */
export async function putMedia(blob: Blob): Promise<string> {
  const key = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  await runTx("readwrite", store => store.put(blob, key))
  const ref = MEDIA_REF_PREFIX + key
  // register the object URL up front so the new block renders immediately,
  // with no read-back round trip and no flash of empty media
  urlCache.set(ref, URL.createObjectURL(blob))
  sessionRefs.add(ref)
  return ref
}

export async function getMedia(ref: string): Promise<Blob | null> {
  if (!isMediaRef(ref)) return null
  try {
    const blob = await runTx<Blob | undefined>("readonly", store =>
      store.get(ref.slice(MEDIA_REF_PREFIX.length)) as IDBRequest<Blob | undefined>
    )
    return blob ?? null
  } catch {
    return null
  }
}

/** Synchronous best-effort lookup: the resolved URL if it's already cached,
 *  otherwise "" for a ref (still loading) or the src itself when it's a plain
 *  URL that needs no resolving. */
export function peekMediaSrc(src: string): string {
  if (!isMediaRef(src)) return src
  return urlCache.get(src) ?? ""
}

export async function resolveMediaSrc(src: string): Promise<string> {
  if (!isMediaRef(src)) return src
  const cached = urlCache.get(src)
  if (cached) return cached
  const blob = await getMedia(src)
  if (!blob) return ""
  const url = URL.createObjectURL(blob)
  urlCache.set(src, url)
  return url
}

/** Resolves an `idb:` ref to a displayable URL, re-rendering when it lands.
 *  Plain URLs (seed clips, YouTube links, http images) pass straight through. */
export function useMediaSrc(src: string): string {
  const [resolved, setResolved] = useState(() => peekMediaSrc(src))

  useEffect(() => {
    if (!isMediaRef(src)) { setResolved(src); return }
    const cached = peekMediaSrc(src)
    if (cached) { setResolved(cached); return }
    let alive = true
    resolveMediaSrc(src).then(url => { if (alive) setResolved(url) })
    return () => { alive = false }
  }, [src])

  return resolved
}

// ── uploading ────────────────────────────────────────────────────────────────

/** Longest edge an uploaded image is scaled down to. The layout column is
 *  ~680px wide, so this still covers retina and any future wider layout while
 *  turning a 12MP phone screenshot into a few hundred KB. */
const MAX_IMAGE_DIM = 2400
/** Below this, re-encoding tends to cost more quality than it saves bytes. */
const SKIP_RESIZE_BELOW_BYTES = 300 * 1024

async function downscaleImage(file: File): Promise<Blob> {
  // GIFs would lose their animation through a canvas, and SVG is already tiny
  // and resolution-independent — both pass through untouched
  if (file.type === "image/gif" || file.type === "image/svg+xml") return file
  if (file.size < SKIP_RESIZE_BELOW_BYTES) return file
  if (typeof createImageBitmap !== "function") return file

  try {
    // from-image applies the EXIF orientation, so phone photos don't come out
    // rotated the way a raw canvas draw would leave them
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" })
    const scale = Math.min(1, MAX_IMAGE_DIM / Math.max(bitmap.width, bitmap.height))
    const w = Math.round(bitmap.width * scale)
    const h = Math.round(bitmap.height * scale)

    const canvas = document.createElement("canvas")
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext("2d")
    if (!ctx) { bitmap.close(); return file }
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close()

    const encoded = await new Promise<Blob | null>(resolve => {
      canvas.toBlob(b => resolve(b), "image/webp", 0.88)
    })
    // toBlob yields null if the browser can't encode webp; and a re-encode
    // that came out bigger than the original is not worth keeping
    if (!encoded || encoded.size >= file.size) return file
    return encoded
  } catch {
    return file
  }
}

/** Puts an uploaded image in IndexedDB (downscaling it first) and returns its
 *  ref. Falls back to a base64 data URL if IndexedDB isn't usable, which keeps
 *  private-mode browsers working exactly as they did before. */
export async function storeImageFile(file: File): Promise<string> {
  const blob = await downscaleImage(file)
  try {
    return await putMedia(blob)
  } catch {
    return fileToDataUrl(blob)
  }
}

export async function storeVideoFile(file: File): Promise<string> {
  try {
    return await putMedia(file)
  } catch {
    return fileToDataUrl(file)
  }
}

function fileToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

// ── migration + cleanup ──────────────────────────────────────────────────────

/** Moves a legacy base64 `data:` URL into IndexedDB, returning the new ref.
 *  Returns the input unchanged if it isn't a data URL or can't be moved. */
export async function migrateDataUrl(src: string): Promise<string> {
  if (typeof src !== "string" || !src.startsWith("data:")) return src
  try {
    const blob = await (await fetch(src)).blob()
    return await putMedia(blob)
  } catch {
    return src
  }
}

const REF_SCAN = /idb:[a-z0-9]+-[a-z0-9]+/gi

/** Deletes IndexedDB blobs no longer referenced by any saved page. Scans every
 *  portfolio localStorage key rather than just the current page's — one
 *  database is shared by all of them, so pruning against a single page would
 *  delete the other pages' media. */
export async function pruneOrphanedMedia(): Promise<void> {
  if (!idbAvailable()) return
  try {
    const referenced = new Set<string>(sessionRefs)
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith("portfolio-")) continue
      const value = localStorage.getItem(key) ?? ""
      for (const match of value.matchAll(REF_SCAN)) referenced.add(match[0])
    }

    const keys = await runTx<IDBValidKey[]>("readonly", store => store.getAllKeys())
    const orphans = keys.filter(k => !referenced.has(MEDIA_REF_PREFIX + String(k)))
    if (!orphans.length) return
    await openDb().then(db => new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite")
      const store = tx.objectStore(STORE)
      orphans.forEach(k => store.delete(k))
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    }))
  } catch {
    // cleanup is best-effort; failing to reclaim space is never worth
    // interrupting an edit over
  }
}

/** Remaining space, for turning "it failed" into an actionable message. */
export async function storageHeadroomMB(): Promise<number | null> {
  try {
    if (!navigator.storage?.estimate) return null
    const { quota = 0, usage = 0 } = await navigator.storage.estimate()
    return Math.max(0, (quota - usage) / (1024 * 1024))
  } catch {
    return null
  }
}
