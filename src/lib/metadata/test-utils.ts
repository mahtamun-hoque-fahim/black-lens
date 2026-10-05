import { readFileSync } from "node:fs"
import { join } from "node:path"

const FIXTURE_DIR = join(process.cwd(), "src", "lib", "metadata", "__fixtures__")

/** Load a fixture as a plain Uint8Array (not a Buffer), the same type the browser gives us. */
export function fixture(name: string): Uint8Array {
  const buf = readFileSync(join(FIXTURE_DIR, name))
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength).slice()
}

/** True if the bytes contain this text anywhere. A blunt "grep" check, independent of any parser. */
export function containsText(bytes: Uint8Array, text: string): boolean {
  return Buffer.from(bytes).includes(Buffer.from(text, "utf8"))
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
}
