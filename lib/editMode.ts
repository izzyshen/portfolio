"use client"

import { useState } from "react"

/**
 * Every page on this site used to be editable in place for anyone who opened
 * it — contentEditable text, add/delete/drag controls, format toolbars, save
 * buttons. Visitors never needed any of that (edits only ever land in the
 * viewer's own localStorage), so it's all off by default now.
 *
 * Izzy can still edit: open any page with `?edit=1` once and the site stays in
 * edit mode in that browser until `?edit=0` turns it off again.
 */
const KEY = "portfolio-edit"

export function isEditMode(): boolean {
  if (typeof window === "undefined") return false
  try {
    const flag = new URLSearchParams(window.location.search).get("edit")
    if (flag === "1") localStorage.setItem(KEY, "1")
    else if (flag === "0") localStorage.removeItem(KEY)
    return localStorage.getItem(KEY) === "1"
  } catch {
    return false
  }
}

/** Lazy initial state (not an effect) so the first client render already
 *  knows — every caller mounts after its page's own client-side load, so
 *  there's no server markup for this to disagree with. */
export function useEditMode(): boolean {
  const [on] = useState(isEditMode)
  return on
}
