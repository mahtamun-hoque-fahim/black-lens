// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest"
import { createRunner, processRequest, type WorkerRequest, type WorkerResponse } from "./clean-runner"
import { MetadataError } from "./metadata"
import { fixture, toHex } from "./metadata/test-utils"

const asFile = (name: string, bytes: Uint8Array) => new File([bytes as BlobPart], name)
const code = async (p: Promise<unknown>) => {
  try {
    await p
    return "no error"
  } catch (e) {
    return e instanceof MetadataError ? e.code : `other: ${e}`
  }
}

describe("processRequest (the one function both the worker and the fallback run)", () => {
  it("summarizes", async () => {
    const res = (await processRequest({ id: 1, op: "summarize", file: asFile("a.jpg", fixture("phone-gps.jpg")) })) as Extract<WorkerResponse, { ok: true }>
    expect(res).toMatchObject({ id: 1, ok: true })
    expect(res.summary).toMatchObject({ format: "jpeg", location: true })
  })

  it("cleans and returns verified bytes", async () => {
    const res = (await processRequest({ id: 2, op: "clean", file: asFile("a.png", fixture("png-metadata.png")), removeIcc: false })) as Extract<WorkerResponse, { ok: true }>
    expect(res.result!.format).toBe("png")
    expect(res.result!.verification.clean).toBe(true)
  })

  it("passes removeIcc through", async () => {
    const res = (await processRequest({ id: 3, op: "clean", file: asFile("a.png", fixture("png-metadata.png")), removeIcc: true })) as Extract<WorkerResponse, { ok: true }>
    expect(res.result!.removed.some((r) => r.kind === "icc")).toBe(true)
  })

  it("turns a MetadataError into a plain, cloneable error object", async () => {
    const res = await processRequest({ id: 4, op: "summarize", file: asFile("bad.jpg", fixture("corrupt-truncated.jpg")) })
    expect(res).toEqual({ id: 4, ok: false, error: { code: "corrupt", message: expect.any(String) } })
  })

  it("reports a surprise as a generic error, never a stack trace", async () => {
    const broken = { name: "x", size: 1, arrayBuffer: () => Promise.reject(new Error("disk on fire")) } as unknown as File
    const res = (await processRequest({ id: 5, op: "summarize", file: broken })) as Extract<WorkerResponse, { ok: false }>
    expect(res.ok).toBe(false)
    expect(res.error.code).toBe("unknown")
    expect(res.error.message).not.toMatch(/disk on fire/)
  })
})

describe("createRunner without a Worker (the fallback)", () => {
  it("summarizes and cleans on the main thread", async () => {
    const runner = createRunner()
    const file = asFile("a.webp", fixture("webp-metadata.webp"))
    expect((await runner.summarize(file)).location).toBe(true)
    expect((await runner.clean(file, { removeIcc: false })).format).toBe("webp")
  })

  it("rejects with a real MetadataError, so callers can read its code", async () => {
    const runner = createRunner()
    expect(await code(runner.summarize(asFile("bad.jpg", fixture("corrupt-truncated.jpg"))))).toBe("corrupt")
    expect(await code(runner.summarize(asFile("x.bin", new Uint8Array(20).fill(5))))).toBe("unknown-format")
  })
})

// A stand-in for the browser's Worker that runs the same function a real worker would.
class FakeWorker {
  static instances: FakeWorker[] = []
  static failOnStart = false
  onmessage: ((e: { data: WorkerResponse }) => void) | null = null
  onerror: ((e: unknown) => void) | null = null
  received: WorkerRequest[] = []
  terminated = false
  constructor() {
    if (FakeWorker.failOnStart) throw new Error("cannot start")
    FakeWorker.instances.push(this)
  }
  postMessage(req: WorkerRequest) {
    this.received.push(req)
    if (FakeWorker.failOnStart === false && (this as { broken?: boolean }).broken) {
      queueMicrotask(() => this.onerror?.(new Error("script failed to load")))
      return
    }
    void processRequest(req).then((res) => this.onmessage?.({ data: res }))
  }
  terminate() {
    this.terminated = true
  }
}

describe("createRunner with a Worker", () => {
  const g = globalThis as { Worker?: unknown }
  afterEach(() => {
    delete g.Worker
    FakeWorker.instances = []
    FakeWorker.failOnStart = false
  })

  it("sends numbered requests to the worker and resolves each with its own answer", async () => {
    g.Worker = FakeWorker
    const runner = createRunner()
    const [a, b] = await Promise.all([
      runner.summarize(asFile("a.jpg", fixture("phone-gps.jpg"))),
      runner.summarize(asFile("b.png", fixture("png-clean.png"))),
    ])
    expect(FakeWorker.instances).toHaveLength(1)
    expect(FakeWorker.instances[0].received.map((r) => r.id)).toEqual([1, 2])
    expect(a.format).toBe("jpeg")
    expect(b.format).toBe("png")
    expect(b.alreadyClean).toBe(true)
  })

  it("rebuilds a MetadataError from the worker's plain error object", async () => {
    g.Worker = FakeWorker
    expect(await code(createRunner().summarize(asFile("bad.jpg", fixture("corrupt-truncated.jpg"))))).toBe("corrupt")
  })

  it("returns the cleaned bytes intact", async () => {
    g.Worker = FakeWorker
    const result = await createRunner().clean(asFile("a.jpg", fixture("phone-gps.jpg")), { removeIcc: false })
    expect(toHex(result.bytes).startsWith("ffd8")).toBe(true)
  })

  it("falls back to the main thread if the Worker cannot even be created", async () => {
    g.Worker = FakeWorker
    FakeWorker.failOnStart = true
    expect((await createRunner().summarize(asFile("a.jpg", fixture("phone-gps.jpg")))).location).toBe(true)
  })

  it("falls back, and still answers, if the worker script fails after starting", async () => {
    g.Worker = FakeWorker
    const runner = createRunner()
    ;(FakeWorker.instances[0] as unknown as { broken: boolean }).broken = true
    const [a, b] = await Promise.all([
      runner.summarize(asFile("a.jpg", fixture("phone-gps.jpg"))),
      runner.summarize(asFile("b.jpg", fixture("no-metadata.jpg"))),
    ])
    expect(a.location).toBe(true)
    expect(b.alreadyClean).toBe(true)
    // and later calls keep working on the main thread
    expect((await runner.summarize(asFile("c.jpg", fixture("phone-gps.jpg")))).location).toBe(true)
  })

  it("dispose stops the worker", () => {
    g.Worker = FakeWorker
    createRunner().dispose()
    expect(FakeWorker.instances[0].terminated).toBe(true)
  })
})
