import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { fixture } from "@/lib/metadata/test-utils"
import { saveBytes } from "@/lib/download"
import { Workspace } from "./workspace"

vi.mock("@/lib/download", () => ({ saveBytes: vi.fn() }))

const asFile = (bytes: Uint8Array, name: string, type: string) =>
  new File([bytes as BlobPart], name, { type })

async function choose(file: File) {
  const user = userEvent.setup()
  await user.upload(screen.getByTestId("file-input"), file)
  return user
}

beforeEach(() => vi.clearAllMocks())

describe("Workspace", () => {
  it("starts on Clean, with View and Tag not available yet", () => {
    render(<Workspace />)
    expect(screen.getByRole("tab", { name: "Clean" })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByRole("tab", { name: /View/ })).toBeDisabled()
    expect(screen.getByRole("tab", { name: /Tag/ })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Choose a photo" })).toBeInTheDocument()
  })

  it("shows what a photo carries and warns about location", async () => {
    render(<Workspace />)
    await choose(asFile(fixture("phone-gps.jpg"), "phone-gps.jpg", "image/jpeg"))
    expect(await screen.findByText("phone-gps.jpg")).toBeInTheDocument()
    expect(screen.getByText("Has location")).toBeInTheDocument()
    expect(screen.getByText("This photo shows where it was taken.")).toBeInTheDocument()
    expect(screen.getByText("Camera make, model or serial numbers")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Clean and download" })).toBeEnabled()
  })

  it("cleans, downloads, and lists what was removed and kept", async () => {
    render(<Workspace />)
    const user = await choose(asFile(fixture("phone-gps.jpg"), "phone-gps.jpg", "image/jpeg"))
    await user.click(await screen.findByRole("button", { name: "Clean and download" }))

    expect(await screen.findByRole("heading", { name: "All identifying metadata removed" })).toBeInTheDocument()
    expect(saveBytes).toHaveBeenCalledTimes(1)
    const [bytes, name, mime] = vi.mocked(saveBytes).mock.calls[0]
    expect(name).toBe("phone-gps-clean.jpg")
    expect(mime).toBe("image/jpeg")
    expect(bytes.length).toBeLessThan(fixture("phone-gps.jpg").length)

    expect(screen.getByText("Camera, date, location and software details")).toBeInTheDocument()
    expect(screen.getByText("Rotation, so the photo still shows the right way up")).toBeInTheDocument()
    expect(screen.getByText("Colour profile, so colours look the same")).toBeInTheDocument()
    expect(screen.getByText(/nothing identifying was found/i)).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Download again" }))
    expect(saveBytes).toHaveBeenCalledTimes(2)
  })

  it("removes the colour profile only when the switch is on", async () => {
    render(<Workspace />)
    const user = await choose(asFile(fixture("phone-gps.jpg"), "p.jpg", "image/jpeg"))
    await user.click(await screen.findByRole("switch", { name: /remove the colour profile/i }))
    await user.click(screen.getByRole("button", { name: "Clean and download" }))
    await screen.findByRole("heading", { name: "All identifying metadata removed" })
    expect(screen.queryByText("Colour profile, so colours look the same")).not.toBeInTheDocument()
  })

  it("says so when a photo is already clean and offers no cleaning", async () => {
    render(<Workspace />)
    await choose(asFile(fixture("no-metadata.jpg"), "clean.jpg", "image/jpeg"))
    expect(await screen.findByText("Already clean")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Clean and download" })).not.toBeInTheDocument()
  })

  it("explains plainly when a format is not supported yet", async () => {
    render(<Workspace />)
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
    await choose(asFile(png, "shot.png", "image/png"))
    expect(await screen.findByRole("alert")).toHaveTextContent("PNG cleaning is not supported yet.")
    expect(screen.getByRole("button", { name: "Choose a photo" })).toBeInTheDocument()
  })

  it("explains plainly when a file is damaged", async () => {
    render(<Workspace />)
    await choose(asFile(fixture("corrupt-truncated.jpg"), "bad.jpg", "image/jpeg"))
    expect(await screen.findByRole("alert")).toHaveTextContent(/damaged/i)
  })

  it("lets the person start over with another photo", async () => {
    render(<Workspace />)
    const user = await choose(asFile(fixture("phone-gps.jpg"), "a.jpg", "image/jpeg"))
    await user.click(await screen.findByRole("button", { name: "Choose another photo" }))
    await waitFor(() => expect(screen.getByRole("button", { name: "Choose a photo" })).toBeInTheDocument())
    expect(screen.queryByText("a.jpg")).not.toBeInTheDocument()
  })
})
