import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { lastDays } from "@/lib/count-rules"
import type { DayCounts } from "@/lib/counter"

const nav = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }))
vi.mock("next/navigation", () => ({ useRouter: () => nav }))

import { OwnerDashboard } from "./owner-dashboard"

const days = lastDays("2026-10-25", 30)
const rows: DayCounts[] = days.map((day) => ({ day, view: 0, clean: 0, tag: 0 }))
rows[28] = { day: days[28], view: 2, clean: 10, tag: 0 }
rows[29] = { day: days[29], view: 1, clean: 5, tag: 4 }

const fetchMock = vi.fn()
beforeEach(() => {
  vi.clearAllMocks()
  fetchMock.mockReset().mockResolvedValue(new Response("{}", { status: 200 }))
  vi.stubGlobal("fetch", fetchMock)
})

describe("OwnerDashboard", () => {
  it("shows the totals for each mode", () => {
    render(<OwnerDashboard rows={rows} email="owner@example.com" />)
    const totals = screen.getByRole("region", { name: "Totals" })
    expect(within(totals).getByText("View")).toBeInTheDocument()
    expect(within(totals).getByText("3")).toBeInTheDocument()
    expect(within(totals).getByText("15")).toBeInTheDocument()
    expect(within(totals).getByText("4")).toBeInTheDocument()
  })

  it("says the numbers are reported by browsers and not verified", () => {
    render(<OwnerDashboard rows={rows} email="owner@example.com" />)
    expect(screen.getByText(/reported by visitors.? browsers/i)).toBeInTheDocument()
    expect(screen.getByText(/not verified/i)).toBeInTheDocument()
  })

  it("says what the days are: UTC, and how many", () => {
    render(<OwnerDashboard rows={rows} email="owner@example.com" />)
    expect(screen.getByText(/photos processed in the last 30 days, counted per day in UTC/i)).toBeInTheDocument()
  })

  it("draws the chart as a labelled picture and gives the same data as a table", () => {
    render(<OwnerDashboard rows={rows} email="owner@example.com" />)
    expect(screen.getByRole("img", { name: /photos processed per day/i })).toBeInTheDocument()
    const table = screen.getByRole("table", { name: /photos processed per day/i })
    expect(within(table).getAllByRole("row")).toHaveLength(31) // header plus 30 days
    expect(within(table).getByRole("row", { name: /2026-10-25/ })).toHaveTextContent("1")
    expect(within(table).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Day (UTC)", "View", "Clean", "Tag"])
  })

  it("shows newest days first in the table", () => {
    render(<OwnerDashboard rows={rows} email="owner@example.com" />)
    const body = within(screen.getByRole("table")).getAllByRole("row")
    expect(body[1]).toHaveTextContent("2026-10-25")
    expect(body[30]).toHaveTextContent(days[0])
  })

  it("says so plainly when nothing has been counted yet", () => {
    render(<OwnerDashboard rows={rows.map((r) => ({ ...r, view: 0, clean: 0, tag: 0 }))} email="owner@example.com" />)
    expect(screen.getByText(/no photos counted yet/i)).toBeInTheDocument()
  })

  it("says so when the database cannot be reached, instead of showing zeros", () => {
    render(<OwnerDashboard rows={null} email="owner@example.com" />)
    expect(screen.getByRole("alert")).toHaveTextContent(/cannot reach the counter database/i)
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
  })

  it("shows who is signed in and signs out through the auth endpoint", async () => {
    const user = userEvent.setup()
    render(<OwnerDashboard rows={rows} email="owner@example.com" />)
    expect(screen.getByText("owner@example.com")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Sign out" }))
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("/api/auth/sign-out")
    expect(init.method).toBe("POST")
    expect(nav.replace).toHaveBeenCalledWith("/owner/sign-in")
  })
})
