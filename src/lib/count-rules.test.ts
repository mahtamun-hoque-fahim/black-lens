// @vitest-environment node
import { describe, expect, it } from "vitest"
import { DAILY_CAP, MAX_PER_CALL, parseCountBody, utcDay } from "./count-rules"
import { LIMITS } from "./limits"

describe("limits", () => {
  it("a call can carry one whole batch and no more", () => {
    expect(MAX_PER_CALL).toBe(LIMITS.maxFiles)
  })
  it("the daily cap is far above one person's use but finite", () => {
    expect(DAILY_CAP).toBeGreaterThanOrEqual(MAX_PER_CALL * 10)
    expect(Number.isFinite(DAILY_CAP)).toBe(true)
  })
})

describe("parseCountBody", () => {
  it.each([
    [{ mode: "view", n: 1 }, "view", 1],
    [{ mode: "clean", n: 200 }, "clean", 200],
    [{ mode: "tag", n: 37 }, "tag", 37],
  ])("accepts %j", (body, mode, n) => {
    expect(parseCountBody(body)).toEqual({ ok: true, mode, n })
  })

  it.each([
    ["not an object", "clean"],
    ["null", null],
    ["an array", [{ mode: "clean", n: 1 }]],
    ["a number", 5],
    ["unknown mode", { mode: "delete", n: 1 }],
    ["mode in capitals", { mode: "Clean", n: 1 }],
    ["missing mode", { n: 1 }],
    ["missing n", { mode: "clean" }],
    ["n as text", { mode: "clean", n: "1" }],
    ["n zero", { mode: "clean", n: 0 }],
    ["n negative", { mode: "clean", n: -3 }],
    ["n fractional", { mode: "clean", n: 1.5 }],
    ["n too big", { mode: "clean", n: MAX_PER_CALL + 1 }],
    ["n NaN", { mode: "clean", n: NaN }],
    ["n Infinity", { mode: "clean", n: Infinity }],
    ["an extra field", { mode: "clean", n: 1, name: "holiday.jpg" }],
    ["a hidden extra field", { mode: "clean", n: 1, __proto__x: 1 }],
  ])("rejects %s", (_label, body) => {
    expect(parseCountBody(body)).toEqual({ ok: false })
  })

  it("rejects a prototype-polluting body", () => {
    expect(parseCountBody(JSON.parse('{"mode":"clean","n":1,"__proto__":{"admin":true}}'))).toEqual({ ok: false })
  })
})

describe("utcDay", () => {
  it("is the calendar date in UTC", () => {
    expect(utcDay(new Date("2026-10-25T23:59:59Z"))).toBe("2026-10-25")
    expect(utcDay(new Date("2026-10-26T00:00:00Z"))).toBe("2026-10-26")
  })
  it("ignores the machine's timezone: 5:30 AM in Dhaka is still the day before in UTC", () => {
    expect(utcDay(new Date("2026-10-26T05:30:00+06:00"))).toBe("2026-10-25")
  })
})
