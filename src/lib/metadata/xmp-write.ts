import type { Tags } from "./tags"

/**
 * Build the XMP packet for the tagged fields (docs/tags.md). Every value is XML-escaped, and the
 * packet's structure is fixed text in this file, so what a person types can only ever become text
 * content, never markup. Nothing is written that was not typed: no tool name, no edit history, no ID.
 */

const escapeXml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;")

const alt = (name: string, value: string) => `<${name}><rdf:Alt><rdf:li xml:lang="x-default">${escapeXml(value)}</rdf:li></rdf:Alt></${name}>`

/** The packet as UTF-8 bytes, or null when no field is filled in. */
export function buildXmp(tags: Tags): Uint8Array | null {
  const props: string[] = []
  if (tags.artist) props.push(`<dc:creator><rdf:Seq><rdf:li>${escapeXml(tags.artist)}</rdf:li></rdf:Seq></dc:creator>`)
  if (tags.copyright) props.push(alt("dc:rights", tags.copyright))
  if (tags.title) props.push(alt("dc:title", tags.title))
  if (tags.description) props.push(alt("dc:description", tags.description))
  if (tags.keywords.length) props.push(`<dc:subject><rdf:Bag>${tags.keywords.map((k) => `<rdf:li>${escapeXml(k)}</rdf:li>`).join("")}</rdf:Bag></dc:subject>`)
  if (tags.date) props.push(`<xmp:CreateDate>${tags.date}</xmp:CreateDate>`) // validated as YYYY-MM-DD, so it holds no markup
  if (props.length === 0) return null

  const xml =
    `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>\n` +
    `<x:xmpmeta xmlns:x="adobe:ns:meta/">\n` +
    ` <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">\n` +
    `  <rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xmp="http://ns.adobe.com/xap/1.0/">\n` +
    props.map((p) => `   ${p}\n`).join("") +
    `  </rdf:Description>\n` +
    ` </rdf:RDF>\n` +
    `</x:xmpmeta>\n` +
    `<?xpacket end="r"?>`
  return new TextEncoder().encode(xml)
}
