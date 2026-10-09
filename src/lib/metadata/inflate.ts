/**
 * Unpack a zlib stream (the kind PNG text chunks use) with the browser's built-in decompressor.
 * Returns null instead of throwing, and stops at maxBytes, so a hostile chunk can neither crash
 * the page nor fill its memory.
 */
export async function inflateZlib(data: Uint8Array, maxBytes: number): Promise<Uint8Array | null> {
  const source = new ReadableStream<BufferSource>({
    start(controller) {
      controller.enqueue(data as BufferSource)
      controller.close()
    },
  })
  const reader = source.pipeThrough(new DecompressionStream("deflate")).getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.length
      if (total > maxBytes) {
        await reader.cancel().catch(() => {})
        return null
      }
      chunks.push(value)
    }
  } catch {
    return null
  }
  const out = new Uint8Array(total)
  let at = 0
  for (const c of chunks) {
    out.set(c, at)
    at += c.length
  }
  return out
}
