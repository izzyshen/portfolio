/** The A/B test table that renders wherever a text block contains the marker
 *  `(Embed AB table)`. The marker itself is what stays in localStorage — the
 *  table html is swapped in on mount and swapped back out on save, so the
 *  stored content never changes and deleting the marker removes the table.
 *
 *  Laid out with metrics as rows because a product column here is ~430px —
 *  the platform's own group-as-rows layout needs ~1000px and would scroll. */

export const AB_TABLE_MARKER = "(Embed AB table)"

const HAIR = "#ebe9e4"
const HAIR_STRONG = "#e2e1dc"
const INK = "#111"
const BODY = "#5c5c5c"
const LABEL = "#aaa"

const th = `padding:0 0 10px;text-align:left;border-bottom:1px solid ${HAIR_STRONG};font-weight:400;font-size:12px;color:${INK};vertical-align:bottom`
const td = `padding:11px 0;border-bottom:1px solid ${HAIR};font-size:13px;color:${BODY};vertical-align:top`
const sub = `font-size:10px;color:${LABEL};letter-spacing:0.02em`

/** metric, what it's for */
const ROWS: [string, string][] = [
  ["Advertiser value (opt)", "optimization target"],
  ["Ad conversions", "primary"],
  ["cvr", "primary"],
  ["Ad spend", "guardrail"],
  ["Ad sends", "guardrail"],
  ["ecvr", "diagnostic"],
  ["ecvr_diff", "calibration"],
]

const rows = ROWS.map(
  ([metric, role]) => `<tr>
  <td style="${td}">${metric}<div style="${sub}">${role}</div></td>
  <td style="${td};text-align:right;color:${LABEL}">baseline</td>
  <td style="${td};text-align:right;color:${INK}">&Delta; vs base0</td>
</tr>`
).join("")

export const AB_TABLE_HTML =
  `<div data-abtable contenteditable="false" style="margin:26px 0;overflow-x:auto">` +
    `<div style="font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:${LABEL};margin-bottom:16px">Entry point A/B test</div>` +
    `<table style="width:100%;border-collapse:collapse;min-width:300px">` +
      `<thead><tr>` +
        `<th style="${th}">Metric</th>` +
        `<th style="${th};text-align:right">base0<div style="${sub}">control</div></th>` +
        `<th style="${th};text-align:right">opt<div style="${sub}">with assistant</div></th>` +
      `</tr></thead>` +
      `<tbody>${rows}</tbody>` +
    `</table>` +
    `<div style="margin-top:16px;font-size:12px;line-height:1.8;color:${LABEL}">` +
      `Split by user, 50/50, fixed 14-day window, sized to detect &plusmn;8%. ` +
      `Ships if advertiser value and ad conversions are both up while spend and sends stay flat &mdash; ` +
      `a lift bought by serving more ads is not a lift.` +
    `</div>` +
  `</div>`

/** Tolerant of what contentEditable does to typed text: &nbsp; instead of a
 *  space, doubled spaces, different capitalisation. */
const MARKER_RE = /\(\s*(?:&nbsp;|\s)*embed(?:&nbsp;|\s)+ab(?:&nbsp;|\s)+table(?:&nbsp;|\s)*\)/gi

/** marker text → table html, for display inside the editable block */
export function expandAbTable(html: string): string {
  return html.replace(MARKER_RE, AB_TABLE_HTML)
}

/** table html → marker text, so what gets persisted is only ever the marker */
export function collapseAbTable(html: string): string {
  if (!html.includes("data-abtable")) return html
  const box = document.createElement("div")
  box.innerHTML = html
  box.querySelectorAll("[data-abtable]").forEach(el => {
    el.replaceWith(document.createTextNode(AB_TABLE_MARKER))
  })
  return box.innerHTML
}
