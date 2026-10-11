import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { saveBytes, saveParts } from "@/lib/download"
import { buildReport } from "@/lib/metadata"
import { fixture } from "@/lib/metadata/test-utils"
import { readZip, zipToBytes } from "@/lib/zip"
import { Workspace } from "./workspace"

vi.mock("@/lib/download", () => ({ saveBytes: vi.fn(), saveParts: vi.fn() }))

const file = (name: string, fx: string, type = "image/jpeg") => new File([fixture(fx) as BlobPart], name, { type })
const heic = (name: string) => new File([new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63, 0, 0, 0, 0])], name, { type: "image/heic" })
const LIMITS = { maxEntries: 200, maxFileBytes: 1e9, maxTotalBytes: 1e9 }
const authors = async (bytes: Uint8Array) => (await buildReport(bytes)).groups.find((g) => g.id === "author")?.fields.map((f) => f.value) ?? []

async function setup(files: File[], openTag = true) {
  const user = userEvent.setup()
  render(<Workspace />)
  if (openTag) await user.click(screen.getByRole("tab", { name: "Tag" }))
  if (files.length) await user.upload(screen.getByTestId("file-input"), files)
  return user
}
const type = (user: ReturnType<typeof userEvent.setup>, label: string, text: string) => user.type(screen.getByLabelText(label), text)
const runButton = () => screen.getByRole("button", { name: "Clean, tag, and download" })

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

describe("Tag mode: the form", () => {
  it("is a real tab now, and starts with the drop zone when nothing is loaded", async () => {
    await setup([])
    expect(screen.getByRole("tab", { name: "Tag" })).toBeEnabled()
    expect(screen.getByRole("tab", { name: "Tag" })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByRole("button", { name: "Choose photos" })).toBeInTheDocument()
  })

  it("shows the six labelled fields once a photo is loaded", async () => {
    await setup([file("phone.jpg", "phone-gps.jpg")])
    for (const label of ["Artist", "Copyright", "Title", "Description", "Keywords", "Date"]) {
      expect(await screen.findByLabelText(label)).toBeInTheDocument()
    }
  })

  it("will not run until a field is filled in, and says so", async () => {
    const user = await setup([file("phone.jpg", "phone-gps.jpg")])
    await screen.findByLabelText("Artist")
    expect(runButton()).toHaveAttribute("aria-disabled", "true")
    expect(screen.getByText("Fill in at least one field.")).toBeInTheDocument()
    await type(user, "Artist", "Fahim Hoque")
    expect(runButton()).toHaveAttribute("aria-disabled", "false")
  })

  it("lists exactly what will be written, and what happens to everything else", async () => {
    const user = await setup([file("phone.jpg", "phone-gps.jpg")])
    await type(user, "Artist", "Fahim Hoque")
    await type(user, "Keywords", "sea, boats")
    const preview = screen.getByRole("region", { name: "What will be written" })
    expect(within(preview).getByText("Fahim Hoque")).toBeInTheDocument()
    expect(within(preview).getByText("sea, boats")).toBeInTheDocument()
    expect(within(preview).queryByText("Copyright")).not.toBeInTheDocument() // empty fields are not listed
    expect(within(preview).getByText(/Everything else that identifies this photo is removed first/)).toBeInTheDocument()
  })

  it("explains a bad date next to the field and blocks the run", async () => {
    const user = await setup([file("phone.jpg", "phone-gps.jpg")])
    await type(user, "Artist", "Fahim")
    await type(user, "Date", "2026-02-30")
    expect(screen.getByText("Date must be a real date, like 2026-01-02.")).toBeInTheDocument()
    expect(screen.getByLabelText("Date")).toHaveAccessibleDescription(/Date must be a real date/)
    expect(runButton()).toHaveAttribute("aria-disabled", "true")
  })

  it("explains text that is too long", async () => {
    const user = await setup([file("phone.jpg", "phone-gps.jpg")])
    await user.click(screen.getByLabelText("Artist"))
    await user.paste("x".repeat(201))
    expect(screen.getByText("Artist is longer than 200 characters.")).toBeInTheDocument()
  })

  it("keeps the photos when switching between Clean, View and Tag", async () => {
    const user = await setup([file("phone.jpg", "phone-gps.jpg")], false)
    await screen.findByText("phone.jpg")
    await user.click(screen.getByRole("tab", { name: "Tag" }))
    expect(await screen.findByLabelText("Artist")).toBeInTheDocument()
    await user.click(screen.getByRole("tab", { name: "Clean" }))
    expect(await screen.findByRole("button", { name: "Clean and download" })).toBeInTheDocument()
  })
})

describe("Tag mode: one photo", () => {
  it("cleans, writes the fields, downloads, and says what was written", async () => {
    const user = await setup([file("phone.jpg", "phone-gps.jpg")])
    await type(user, "Artist", "Fahim Hoque")
    await type(user, "Copyright", "(c) 2026 Fahim Hoque")
    await user.click(runButton())
    expect(await screen.findByRole("heading", { name: "Photo cleaned and tagged" })).toBeInTheDocument()

    expect(saveParts).not.toHaveBeenCalled()
    const [bytes, name, mime] = vi.mocked(saveBytes).mock.calls[0]
    expect(name).toBe("phone-tagged.jpg")
    expect(mime).toBe("image/jpeg")
    expect(await authors(bytes)).toEqual(expect.arrayContaining(["Fahim Hoque", "(c) 2026 Fahim Hoque"]))
    expect((await buildReport(bytes)).location).toBeNull()

    expect(screen.getByText(/the picture is unchanged and your details read back exactly/i)).toBeInTheDocument()
    expect(screen.getByText("Fahim Hoque")).toBeInTheDocument() // the Written list
    await user.click(screen.getByRole("button", { name: "Download again" }))
    expect(saveBytes).toHaveBeenCalledTimes(2)
  })

  it("honours the colour profile switch", async () => {
    const user = await setup([file("phone.jpg", "phone-gps.jpg")])
    await type(user, "Artist", "Fahim")
    await user.click(screen.getByRole("switch", { name: /remove the colour profile/i }))
    await user.click(runButton())
    await screen.findByRole("heading", { name: "Photo cleaned and tagged" })
    expect((await buildReport(vi.mocked(saveBytes).mock.calls[0][0])).groups.find((g) => g.id === "picture")?.fields.some((f) => f.label === "Colour profile")).toBe(false)
  })

  it("keeps the person's typing if the photo cannot be tagged", async () => {
    const user = await setup([file("bad.jpg", "corrupt-truncated.jpg")])
    expect(await screen.findByRole("alert")).toHaveTextContent(/damaged/i) // reading fails before the form even appears
    expect(screen.getByRole("button", { name: "Choose photos" })).toBeInTheDocument()
    expect(user).toBeDefined()
  })
})

describe("Tag mode: batches", () => {
  it("applies the same details to every photo and downloads one ZIP", async () => {
    const user = await setup([file("a.jpg", "phone-gps.jpg"), file("b.png", "png-metadata.png", "image/png"), file("c.webp", "webp-metadata.webp", "image/webp")])
    await type(user, "Artist", "Fahim Hoque")
    await user.click(await screen.findByRole("button", { name: "Clean, tag, and download" }))
    expect(await screen.findByRole("heading", { name: "3 photos cleaned and tagged" })).toBeInTheDocument()
    const [parts, name, mime] = vi.mocked(saveParts).mock.calls[0]
    expect([name, mime]).toEqual(["black-lens-tagged.zip", "application/zip"])
    const entries = await readZip(zipToBytes(parts), LIMITS)
    expect(entries.map((e) => e.name)).toEqual(["a-tagged.jpg", "b-tagged.png", "c-tagged.webp"])
    for (const e of entries) expect(await authors(e.bytes), e.name).toContain("Fahim Hoque")
  })

  it("can give each photo its own details when 'apply to all' is switched off", async () => {
    const user = await setup([file("a.jpg", "phone-gps.jpg"), file("b.jpg", "camera-xmp-iptc.jpg")])
    await user.click(await screen.findByRole("switch", { name: /same details to all/i }))
    await type(user, "Artist", "First Person")
    await user.click(within(screen.getByRole("list", { name: "Photos" })).getByRole("button", { name: /^b\.jpg/ }))
    expect(screen.getByLabelText("Artist")).toHaveValue("") // a fresh form for the second photo
    await type(user, "Artist", "Second Person")
    await user.click(runButton())
    await screen.findByRole("heading", { name: "2 photos cleaned and tagged" })
    const entries = await readZip(zipToBytes(vi.mocked(saveParts).mock.calls[0][0]), LIMITS)
    // the name appears twice per photo (EXIF Artist and XMP Creator), so compare the set of names
    expect(new Set(await authors(entries[0].bytes))).toEqual(new Set(["First Person"]))
    expect(new Set(await authors(entries[1].bytes))).toEqual(new Set(["Second Person"]))
  })

  it("refuses to start when a photo has no details of its own, and names it", async () => {
    const user = await setup([file("a.jpg", "phone-gps.jpg"), file("b.jpg", "camera-xmp-iptc.jpg")])
    await user.click(await screen.findByRole("switch", { name: /same details to all/i }))
    await type(user, "Artist", "Only the first")
    expect(runButton()).toHaveAttribute("aria-disabled", "true")
    expect(screen.getByText(/b\.jpg has nothing to write yet/)).toBeInTheDocument()
  })

  it("tags what it can and says what it could not", async () => {
    const user = await setup([file("a.jpg", "phone-gps.jpg"), heic("bad.heic"), file("b.png", "png-metadata.png", "image/png")])
    await type(user, "Artist", "Fahim")
    await waitFor(() => expect(within(screen.getByRole("list", { name: "Photos" })).getByText("Not supported")).toBeInTheDocument())
    await user.click(runButton())
    expect(await screen.findByRole("heading", { name: "Cleaned and tagged 2 of 3 photos" })).toBeInTheDocument()
    expect(screen.getByText(/HEIC photos are not supported yet/)).toBeInTheDocument()
    const entries = await readZip(zipToBytes(vi.mocked(saveParts).mock.calls[0][0]), LIMITS)
    expect(entries.map((e) => e.name)).toEqual(["a-tagged.jpg", "b-tagged.png"])
  })
})

describe("Tag mode: presets", () => {
  const savePreset = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
    await user.type(screen.getByLabelText("Preset name"), name)
    await user.click(screen.getByRole("button", { name: "Save preset" }))
  }

  it("saves the six fields under a name, on this device only", async () => {
    const user = await setup([file("phone.jpg", "phone-gps.jpg")])
    await type(user, "Artist", "Fahim Hoque")
    await type(user, "Keywords", "sea, boats")
    await savePreset(user, "Studio")
    const stored = JSON.parse(localStorage.getItem("black-lens:presets")!)
    expect(stored).toHaveLength(1)
    expect(stored[0]).toMatchObject({ name: "Studio", tags: { artist: "Fahim Hoque", keywords: "sea, boats" } })
    expect(screen.getByLabelText("Preset name")).toHaveValue("")
  })

  it("fills the form from a saved preset, even after the page is reopened", async () => {
    const user = await setup([file("phone.jpg", "phone-gps.jpg")])
    await type(user, "Artist", "Fahim Hoque")
    await type(user, "Copyright", "(c) 2026")
    await savePreset(user, "Studio")
    // a brand new page
    document.body.innerHTML = ""
    const again = userEvent.setup()
    render(<Workspace />)
    await again.click(screen.getByRole("tab", { name: "Tag" }))
    await again.upload(screen.getByTestId("file-input"), [file("other.jpg", "camera-xmp-iptc.jpg")])
    await again.selectOptions(await screen.findByLabelText("Preset"), "Studio")
    expect(screen.getByLabelText("Artist")).toHaveValue("Fahim Hoque")
    expect(screen.getByLabelText("Copyright")).toHaveValue("(c) 2026")
  })

  it("deletes a preset", async () => {
    const user = await setup([file("phone.jpg", "phone-gps.jpg")])
    await type(user, "Artist", "Fahim")
    await savePreset(user, "Studio")
    await user.selectOptions(screen.getByLabelText("Preset"), "Studio")
    await user.click(screen.getByRole("button", { name: "Delete preset" }))
    expect(JSON.parse(localStorage.getItem("black-lens:presets")!)).toEqual([])
    expect(within(screen.getByLabelText("Preset")).queryByRole("option", { name: "Studio" })).not.toBeInTheDocument()
  })

  it("will not save an unnamed or empty preset", async () => {
    const user = await setup([file("phone.jpg", "phone-gps.jpg")])
    await type(user, "Artist", "Fahim")
    expect(screen.getByRole("button", { name: "Save preset" })).toHaveAttribute("aria-disabled", "true") // no name yet
    await user.type(screen.getByLabelText("Preset name"), "Empty one")
    await user.clear(screen.getByLabelText("Artist"))
    expect(screen.getByRole("button", { name: "Save preset" })).toHaveAttribute("aria-disabled", "true") // nothing to save
  })

  it("survives blocked or damaged storage without breaking the form", async () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked")
    })
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked")
    })
    const user = await setup([file("phone.jpg", "phone-gps.jpg")])
    await type(user, "Artist", "Fahim")
    expect(screen.getByLabelText("Artist")).toHaveValue("Fahim")
    expect(runButton()).toHaveAttribute("aria-disabled", "false")
    expect(getItem).toHaveBeenCalled()
    expect(screen.queryByLabelText("Preset name")).not.toBeInTheDocument() // presets are simply not offered
    getItem.mockRestore()
    vi.restoreAllMocks()
  })

  it("ignores stored presets that are not valid", async () => {
    localStorage.setItem("black-lens:presets", JSON.stringify([{ name: "Good", tags: { artist: "A" } }, { nope: true }, "text", null, { name: 5 }]))
    await setup([file("phone.jpg", "phone-gps.jpg")])
    const options = within(await screen.findByLabelText("Preset")).getAllByRole("option").map((o) => o.textContent)
    expect(options).toEqual(["Choose a preset", "Good"])
  })
})
