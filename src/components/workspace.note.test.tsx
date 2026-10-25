import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { fixture } from "@/lib/metadata/test-utils"
import { Workspace } from "./workspace"

vi.mock("@/lib/download", () => ({ saveBytes: vi.fn(), saveParts: vi.fn() }))
vi.mock("@/lib/report-count", () => ({ reportCount: vi.fn() }))

const jpg = (name: string) => new File([fixture("phone-gps.jpg") as BlobPart], name, { type: "image/jpeg" })
const NOTE = /does not remove what the picture itself shows/i

beforeEach(() => localStorage.clear())

describe("the note about what is not removed", () => {
  it("appears on the result of cleaning one photo, saying what can still give a photo away", async () => {
    const user = userEvent.setup()
    render(<Workspace />)
    await user.upload(screen.getByTestId("file-input"), [jpg("a.jpg")])
    await user.click(await screen.findByRole("button", { name: "Clean and download" }))
    await screen.findByRole("heading", { name: "All identifying metadata removed" })
    const note = screen.getByText(NOTE)
    expect(note.textContent).toMatch(/face/i)
    expect(note.textContent).toMatch(/street sign/i)
    expect(note.textContent).toMatch(/file name/i)
  })

  it("appears on the result of a batch", async () => {
    const user = userEvent.setup()
    render(<Workspace />)
    await user.upload(screen.getByTestId("file-input"), [jpg("a.jpg"), jpg("b.jpg")])
    await user.click(await screen.findByRole("button", { name: "Clean all and download ZIP" }))
    await screen.findByRole("heading", { name: /All identifying metadata removed from 2 photos/ })
    expect(screen.getByText(NOTE)).toBeInTheDocument()
  })

  it("appears on the result of tagging", async () => {
    const user = userEvent.setup()
    render(<Workspace />)
    await user.upload(screen.getByTestId("file-input"), [jpg("a.jpg")])
    await user.click(screen.getByRole("tab", { name: "Tag" }))
    await user.type(await screen.findByLabelText("Artist"), "Fahim")
    await user.click(screen.getByRole("button", { name: "Clean, tag, and download" }))
    await screen.findByRole("heading", { name: "Photo cleaned and tagged" })
    expect(screen.getByText(NOTE)).toBeInTheDocument()
  })

  it("is not shown before anything has been cleaned", async () => {
    const user = userEvent.setup()
    render(<Workspace />)
    await user.upload(screen.getByTestId("file-input"), [jpg("a.jpg")])
    await screen.findByRole("button", { name: "Clean and download" })
    expect(screen.queryByText(NOTE)).not.toBeInTheDocument()
  })

  it("follows the house copy rules: no em dash", async () => {
    const user = userEvent.setup()
    render(<Workspace />)
    await user.upload(screen.getByTestId("file-input"), [jpg("a.jpg")])
    await user.click(await screen.findByRole("button", { name: "Clean and download" }))
    await screen.findByRole("heading", { name: "All identifying metadata removed" })
    expect(screen.getByText(NOTE).textContent).not.toMatch(/\u2014/)
  })
})
