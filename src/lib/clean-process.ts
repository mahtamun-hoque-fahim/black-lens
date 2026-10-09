import { buildReport, MetadataError, stripMetadata, summarizeMetadata, type MetadataReport, type MetadataSummary, type StripMetadataResult } from "./metadata"

/**
 * The one function that does the work. A Web Worker runs it off the main thread so the page never
 * freezes on a big photo; if the worker cannot start, the page runs this exact same function itself.
 * Kept in its own file so the worker can import it without importing the code that creates the worker.
 */

export type WorkerRequest =
  | { id: number; op: "summarize"; file: File }
  | { id: number; op: "inspect"; file: File }
  | { id: number; op: "clean"; file: File; removeIcc: boolean }

export type WorkerResponse =
  | { id: number; ok: true; summary?: MetadataSummary; result?: StripMetadataResult; report?: MetadataReport }
  | { id: number; ok: false; error: { code: string; message: string } }

export async function processRequest(req: WorkerRequest): Promise<WorkerResponse> {
  try {
    const bytes = new Uint8Array(await req.file.arrayBuffer())
    if (req.op === "summarize") return { id: req.id, ok: true, summary: summarizeMetadata(bytes) }
    if (req.op === "inspect") return { id: req.id, ok: true, report: await buildReport(bytes) }
    return { id: req.id, ok: true, result: stripMetadata(bytes, { removeIcc: req.removeIcc }) }
  } catch (e) {
    // Only a plain object can cross the worker boundary, and a stack trace is not for the person to read.
    if (e instanceof MetadataError) return { id: req.id, ok: false, error: { code: e.code, message: e.message } }
    return { id: req.id, ok: false, error: { code: "unknown", message: "Something went wrong while reading this file." } }
  }
}
