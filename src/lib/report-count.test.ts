// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { reportCount } from "./report-count"

const fetchMock = vi.fn()
beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue(new Response(null, { status: 204 }))
  vi.stubGlobal("fetch", fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

const bodies = () => fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body as string))

describe("reportCount", () => {
  it("sends only the mode and the number, with no cookies", async () => {
    await reportCount("clean", 3)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("/api/count")
    expect(init.method).toBe("POST")
    expect(init.credentials).toBe("omit")
    expect(init.referrerPolicy).toBe("no-referrer")
    expect(init.keepalive).toBe(true)
    expect(init.headers).toEqual({ "content-type": "application/json" })
    expect(Object.keys(JSON.parse(init.body)).sort()).toEqual(["mode", "n"])
    expect(bodies()[0]).toEqual({ mode: "clean", n: 3 })
  })

  it.each([0, -1, 1.5, NaN, Infinity])("sends nothing for %s", async (n) => {
    await reportCount("tag", n)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("splits a number above the per-call maximum into several calls that add up", async () => {
    await reportCount("view", 450)
    expect(bodies()).toEqual([
      { mode: "view", n: 200 },
      { mode: "view", n: 200 },
      { mode: "view", n: 50 },
    ])
  })

  it("never throws or rejects, whatever goes wrong", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("offline"))
    await expect(reportCount("clean", 1)).resolves.toBeUndefined()
    fetchMock.mockResolvedValueOnce(new Response("nope", { status: 500 }))
    await expect(reportCount("clean", 1)).resolves.toBeUndefined()
    fetchMock.mockImplementationOnce(() => {
      throw new Error("blocked synchronously")
    })
    await expect(reportCount("clean", 1)).resolves.toBeUndefined()
  })

  it("does nothing when fetch does not exist", async () => {
    vi.stubGlobal("fetch", undefined)
    await expect(reportCount("clean", 1)).resolves.toBeUndefined()
  })
})
