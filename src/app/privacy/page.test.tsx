import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { COUNT_MODES } from "@/db/schema"
import { SiteFooter } from "@/components/site-footer"
import PrivacyPage, { metadata } from "./page"

const text = () => document.body.textContent ?? ""

describe("Privacy page", () => {
  it("has a title, a main heading and the sections a visitor looks for", () => {
    render(<PrivacyPage />)
    expect(metadata.title).toBe("Privacy")
    expect(screen.getByRole("heading", { level: 1, name: "Privacy" })).toBeInTheDocument()
    for (const name of ["Your photos", "What Black Lens counts", "What stays on your device", "Cookies", "Hosting", "Questions"]) {
      expect(screen.getByRole("heading", { level: 2, name })).toBeInTheDocument()
    }
  })

  it("says the photos never leave the device, including typed details", () => {
    render(<PrivacyPage />)
    expect(text()).toMatch(/inside your browser/i)
    expect(text()).toMatch(/never uploaded/i)
    expect(text()).toMatch(/details you type in Tag mode/i)
  })

  it("names every mode the counter records, and exactly what the message holds", () => {
    render(<PrivacyPage />)
    const section = screen.getByRole("heading", { name: "What Black Lens counts" }).parentElement!
    for (const mode of COUNT_MODES) expect(section.textContent).toMatch(new RegExp(mode, "i"))
    expect(section.textContent).toMatch(/which of the three you used and how many photos/i)
    for (const absent of ["file names", "photo data", "metadata", "details you typed", "cookie", "account"]) {
      expect(section.textContent).toContain(absent)
    }
    expect(section.textContent).toMatch(/the counter does not read or store your IP address/i)
    expect(section.textContent).toMatch(/one number for each day and each of the three modes/i)
  })

  it("lists what is saved in the browser and how to remove it", () => {
    render(<PrivacyPage />)
    const section = screen.getByRole("heading", { name: "What stays on your device" }).parentElement!
    expect(section.textContent).toMatch(/theme/i)
    expect(section.textContent).toMatch(/presets/i)
    expect(section.textContent).toMatch(/clear your site data/i)
  })

  it("says no cookies are set for visitors and what the one exception is", () => {
    render(<PrivacyPage />)
    const section = screen.getByRole("heading", { name: "Cookies" }).parentElement!
    expect(section.textContent).toMatch(/no cookies for visitors/i)
    expect(section.textContent).toMatch(/owner/i)
  })

  it("is honest about the host: Vercel sees addresses and keeps short-lived logs", () => {
    render(<PrivacyPage />)
    const section = screen.getByRole("heading", { name: "Hosting" }).parentElement!
    expect(section.textContent).toMatch(/Vercel/)
    expect(section.textContent).toMatch(/address of each visitor/i)
    expect(section.textContent).toMatch(/between one hour and one day/i)
    expect(section.textContent).toMatch(/Neon/)
    expect(section.textContent).toMatch(/no analytics, no advertising and no third-party scripts/i)
  })

  it("shows when it was last updated", () => {
    render(<PrivacyPage />)
    expect(screen.getByText(/last updated/i)).toHaveTextContent(/25 October 2026/)
  })

  it("gives the contact from BRAIN.md and the project's issues, and opens the second one safely", () => {
    render(<PrivacyPage />)
    const links = within(screen.getByRole("heading", { name: "Questions" }).parentElement!).getAllByRole("link")
    expect(links.map((l) => l.getAttribute("href"))).toEqual([
      "mailto:mahtamunhoquefahim@pm.me",
      "https://github.com/mahtamun-hoque-fahim/black-lens/issues",
    ])
    expect(links[1]).toHaveAttribute("rel", expect.stringContaining("noopener"))
  })

  it("follows the house copy rules: no em dashes, no emoji", () => {
    render(<PrivacyPage />)
    expect(text()).not.toMatch(/\u2014/)
    expect(text()).not.toMatch(/\p{Extended_Pictographic}/u)
  })
})

describe("Footer", () => {
  it("links to the privacy page", () => {
    render(<SiteFooter />)
    expect(screen.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy")
    expect(screen.getByText("Photos never leave your device.")).toBeInTheDocument()
  })
})
