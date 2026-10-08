/**
 * Save data as a file on the person's device. Nothing is uploaded: the browser makes a temporary
 * link to the bytes already in memory and "clicks" it.
 */
export function saveParts(parts: Uint8Array[], filename: string, mime: string): void {
  const blob = new Blob(parts as BlobPart[], { type: mime }) // a Blob can hold many chunks without joining them
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.rel = "noopener"
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Give the browser a moment to start the save before the link is released.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function saveBytes(bytes: Uint8Array, filename: string, mime: string): void {
  saveParts([bytes], filename, mime)
}
