import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { saveBytes, saveParts } from "@/lib/download"
import { summarizeMetadata } from "@/lib/metadata"
import { fixture } from "@/lib/metadata/test-utils"
import { readZip, zipToBytes } from "@/lib/zip"
import { Workspace } from "./workspace"

vi.mock("@/lib/download", () => ({ saveBytes: vi.fn(), saveParts: vi.fn() }))

const file = (bytes: Uint8Array, name: string, type = "") => new File([bytes as BlobPart], name, { type })
const jpg = (name: string) => file(fixture("phone-gps.jpg"), name, "image/jpeg")
const png = (name: string) => file(fixture("png-metadata.png"), name, "image/png")
const webp = (name: string) => file(fixture("webp-metadata.webp"), name, "image/webp")
const heic = (name: string) => file(new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63, 0, 0, 0, 0]), name, "image/heic")
const LIMITS = { maxEntries: 200, maxFileBytes: 1e9, maxTotalBytes: 1e9 }

async function choose(files: File[], testId = "file-input") {
  const user = userEvent.setup()
  await user.upload(screen.getByTestId(testId), files)
  return user
}
const rows = () => within(screen.getByRole("list", { name: "Photos" })).getAllByRole("listitem")

beforeEach(() => vi.clearAllMocks())

describe("Workspace: batches", () => {
  it("shows a queue with one row per photo, each with its own chip", async () => {
    render(<Workspace />)
    await choose([jpg("a.jpg"), png("b.png"), webp("c.webp")])
    await waitFor(() => expect(rows()).toHaveLength(3))
    expect(screen.getByRole("heading", { name: "3 photos" })).toBeInTheDocument()
    await waitFor(() => expect(within(rows()[0]).getByText("Has location")).toBeInTheDocument())
    expect(within(rows()[1]).getByText("Has location")).toBeInTheDocument()
    expect(within(rows()[2]).getByText("Has location")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Clean all and download ZIP" })).toBeEnabled()
  })

  it("shows the selected photo's details in the inspector and lets the person pick another", async () => {
    render(<Workspace />)
    const user = await choose([jpg("a.jpg"), file(fixture("no-metadata.jpg"), "clean.jpg", "image/jpeg")])
    await waitFor(() => expect(within(rows()[1]).getByText("Already clean")).toBeInTheDocument())
    const inspector = screen.getByRole("region", { name: "Details" })
    expect(within(inspector).getByText("a.jpg")).toBeInTheDocument()
    expect(within(inspector).getByText("This photo shows where it was taken.")).toBeInTheDocument()
    await user.click(within(rows()[1]).getByRole("button", { name: /^clean\.jpg/ }))
    expect(within(inspector).getByText("clean.jpg")).toBeInTheDocument()
    expect(within(inspector).getByText("This photo has nothing identifying to remove.")).toBeInTheDocument()
  })

  it("cleans everything and downloads one ZIP of verified, cleaned photos", async () => {
    render(<Workspace />)
    const user = await choose([jpg("a.jpg"), png("b.png"), webp("c.webp")])
    await user.click(await screen.findByRole("button", { name: "Clean all and download ZIP" }))
    expect(await screen.findByRole("heading", { name: "All identifying metadata removed from 3 photos" })).toBeInTheDocument()

    expect(saveBytes).not.toHaveBeenCalled()
    expect(saveParts).toHaveBeenCalledTimes(1)
    const [parts, name, mime] = vi.mocked(saveParts).mock.calls[0]
    expect(name).toBe("black-lens-clean.zip")
    expect(mime).toBe("application/zip")
    const entries = await readZip(zipToBytes(parts), LIMITS)
    expect(entries.map((e) => e.name)).toEqual(["a-clean.jpg", "b-clean.png", "c-clean.webp"])
    for (const e of entries) expect(summarizeMetadata(e.bytes).alreadyClean, e.name).toBe(true)

    await user.click(screen.getByRole("button", { name: "Download ZIP again" }))
    expect(saveParts).toHaveBeenCalledTimes(2)
  })

  it("numbers photos that share a name so nothing is overwritten in the ZIP", async () => {
    render(<Workspace />)
    const user = await choose([jpg("same.jpg"), jpg("same.jpg")])
    await user.click(await screen.findByRole("button", { name: "Clean all and download ZIP" }))
    await screen.findByRole("heading", { name: /All identifying metadata removed/ })
    const entries = await readZip(zipToBytes(vi.mocked(saveParts).mock.calls[0][0]), LIMITS)
    expect(entries.map((e) => e.name)).toEqual(["same-clean.jpg", "same-clean (2).jpg"])
  })

  it("marks a photo it cannot handle, still cleans the rest, and says how many worked", async () => {
    render(<Workspace />)
    const user = await choose([jpg("a.jpg"), heic("bad.heic"), png("b.png")])
    await waitFor(() => expect(within(rows()[1]).getByText("Not supported")).toBeInTheDocument())
    await user.click(screen.getByRole("button", { name: "Clean all and download ZIP" }))
    expect(await screen.findByRole("heading", { name: "Cleaned 2 of 3 photos" })).toBeInTheDocument()
    expect(screen.getByText(/bad\.heic/)).toBeInTheDocument()
    expect(screen.getByText(/HEIC photos are not supported yet/)).toBeInTheDocument()
    const entries = await readZip(zipToBytes(vi.mocked(saveParts).mock.calls[0][0]), LIMITS)
    expect(entries.map((e) => e.name)).toEqual(["a-clean.jpg", "b-clean.png"])
  })

  it("unpacks a ZIP into photos and says how many files were not photos", async () => {
    render(<Workspace />)
    await choose([file(fixture("zip-store.zip"), "shoot.zip", "application/zip")])
    await waitFor(() => expect(rows()).toHaveLength(3))
    expect(screen.getByText("1 file was not a photo and was left out.")).toBeInTheDocument()
    expect(within(rows()[0]).getByText("a.jpg")).toBeInTheDocument()
  })

  it("explains a broken ZIP in plain words", async () => {
    render(<Workspace />)
    await choose([file(fixture("zip-truncated.zip"), "broken.zip", "application/zip")])
    expect(await screen.findByRole("alert")).toHaveTextContent(/broken\.zip.*damaged/i)
    expect(screen.getByRole("button", { name: "Choose photos" })).toBeInTheDocument()
  })

  it("takes a folder, keeps the photos and says what it left out", async () => {
    render(<Workspace />)
    await choose([jpg("1.jpg"), png("2.png"), file(new Uint8Array([1]), "notes.txt", "text/plain")], "folder-input")
    await waitFor(() => expect(rows()).toHaveLength(2))
    expect(screen.getByText("1 file was not a photo and was left out.")).toBeInTheDocument()
  })

  it("offers the colour profile switch for the whole batch and honours it", async () => {
    render(<Workspace />)
    const user = await choose([jpg("a.jpg"), png("b.png")])
    await user.click(await screen.findByRole("switch", { name: /remove the colour profiles/i }))
    await user.click(screen.getByRole("button", { name: "Clean all and download ZIP" }))
    await screen.findByRole("heading", { name: /All identifying metadata removed/ })
    const entries = await readZip(zipToBytes(vi.mocked(saveParts).mock.calls[0][0]), LIMITS)
    for (const e of entries) expect(summarizeMetadata(e.bytes).colourProfile, e.name).toBe(false)
  })

  it("removes a photo from the queue, and a single photo left goes back to the one-photo screen", async () => {
    render(<Workspace />)
    const user = await choose([jpg("a.jpg"), png("b.png")])
    await waitFor(() => expect(rows()).toHaveLength(2))
    await user.click(screen.getByRole("button", { name: "Remove a.jpg" }))
    expect(await screen.findByRole("button", { name: "Clean and download" })).toBeInTheDocument()
    expect(screen.queryByRole("list", { name: "Photos" })).not.toBeInTheDocument()
  })

  it("starts over", async () => {
    render(<Workspace />)
    const user = await choose([jpg("a.jpg"), png("b.png")])
    await user.click(await screen.findByRole("button", { name: "Clear all" }))
    expect(await screen.findByRole("button", { name: "Choose photos" })).toBeInTheDocument()
  })

  it("keeps a photo over the size limit in the list as an error and still cleans the others", async () => {
    render(<Workspace />)
    const huge = jpg("huge.jpg")
    Object.defineProperty(huge, "size", { value: 101 * 1024 * 1024 }) // pretend it is 101 MB without allocating it
    const user = await choose([huge, jpg("ok.jpg")])
    await waitFor(() => expect(within(rows()[0]).getByText("Too big")).toBeInTheDocument())
    await user.click(within(rows()[0]).getByRole("button", { name: /^huge\.jpg/ }))
    expect(within(screen.getByRole("region", { name: "Details" })).getByRole("alert")).toHaveTextContent("bigger than 100 MB")
    await waitFor(() => expect(within(rows()[1]).getByText("Has location")).toBeInTheDocument())
    await user.click(screen.getByRole("button", { name: "Clean all and download ZIP" }))
    expect(await screen.findByRole("heading", { name: "Cleaned 1 of 2 photos" })).toBeInTheDocument()
  })

  it("keeps only the first 200 photos and says so", async () => {
    render(<Workspace />)
    const tiny = fixture("no-metadata.jpg")
    await choose(Array.from({ length: 203 }, (_, i) => file(tiny, `p${i}.jpg`, "image/jpeg")))
    await waitFor(() => expect(rows()).toHaveLength(200), { timeout: 15000 })
    expect(screen.getByText(/Only the first 200 photos were added\. 3 more were left out\./)).toBeInTheDocument()
  }, 30000)

  it("does not offer to clean when no photo can be cleaned", async () => {
    render(<Workspace />)
    const user = await choose([heic("a.heic"), heic("b.heic")])
    await waitFor(() => expect(within(rows()[1]).getByText("Not supported")).toBeInTheDocument())
    const button = screen.getByRole("button", { name: "Clean all and download ZIP" })
    expect(button).toHaveAttribute("aria-disabled", "true")
    await user.click(button)
    expect(saveParts).not.toHaveBeenCalled()
    expect(screen.queryByRole("heading", { name: /photos$/ })).toBeInTheDocument() // still the queue ("2 photos"), not a result
  })
})
