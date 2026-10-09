import { processRequest, type WorkerRequest, type WorkerResponse } from "./clean-process"
import { MetadataError, type MetadataErrorCode, type MetadataReport, type MetadataSummary, type StripMetadataResult, type StripOptions } from "./metadata"

export { processRequest, type WorkerRequest, type WorkerResponse }

export interface Runner {
  summarize(file: File): Promise<MetadataSummary>
  inspect(file: File): Promise<MetadataReport>
  clean(file: File, options: StripOptions): Promise<StripMetadataResult>
  dispose(): void
}

const KNOWN: MetadataErrorCode[] = ["corrupt", "unsupported", "unknown-format", "verification-failed"]

/** Turn a response back into a value, or into the same kind of error the core would have thrown. */
function unwrap(res: WorkerResponse): MetadataSummary | StripMetadataResult | MetadataReport {
  if (res.ok) return (res.summary ?? res.result ?? res.report)!
  if (KNOWN.includes(res.error.code as MetadataErrorCode)) throw new MetadataError(res.error.code as MetadataErrorCode, res.error.message)
  throw new Error(res.error.message)
}

interface PendingRequest {
  req: WorkerRequest
  resolve: (res: WorkerResponse) => void
}

/**
 * Runs summarize and clean in a Web Worker when the browser has one, one request at a time in
 * order, and on the main thread when it does not or when the worker breaks. Either way the answer
 * comes from the same function (processRequest), so the two paths cannot disagree.
 */
export function createRunner(): Runner {
  let nextId = 0
  let worker: Worker | null = null
  const pending = new Map<number, PendingRequest>()

  if (typeof Worker !== "undefined") {
    try {
      // This exact shape (new Worker(new URL(..., import.meta.url))) is what lets the bundler find and build the worker file.
      worker = new Worker(new URL("./clean.worker.ts", import.meta.url), { type: "module" })
      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const entry = pending.get(event.data.id)
        if (!entry) return
        pending.delete(event.data.id)
        entry.resolve(event.data)
      }
      worker.onerror = () => {
        // The worker script failed to load or crashed. Do the waiting work here instead, and stop using the worker.
        worker?.terminate()
        worker = null
        const stuck = [...pending.values()]
        pending.clear()
        for (const entry of stuck) void processRequest(entry.req).then(entry.resolve)
      }
    } catch {
      worker = null
    }
  }

  const send = (req: WorkerRequest) =>
    new Promise<WorkerResponse>((resolve) => {
      if (!worker) {
        void processRequest(req).then(resolve)
        return
      }
      pending.set(req.id, { req, resolve })
      worker.postMessage(req)
    })

  return {
    async summarize(file) {
      return unwrap(await send({ id: ++nextId, op: "summarize", file })) as MetadataSummary
    },
    async inspect(file) {
      return unwrap(await send({ id: ++nextId, op: "inspect", file })) as MetadataReport
    },
    async clean(file, options) {
      return unwrap(await send({ id: ++nextId, op: "clean", file, removeIcc: options.removeIcc ?? false })) as StripMetadataResult
    },
    dispose() {
      worker?.terminate()
      worker = null
    },
  }
}
