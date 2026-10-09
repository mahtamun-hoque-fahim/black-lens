import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { fixture } from "@/lib/metadata/test-utils"
import { Workspace } from "./workspace"

vi.mock("@/lib/download", () => ({ saveBytes: vi.fn(), saveParts: vi.fn() }))

// Record every photo whose details are read, so laziness and caching can be tested.
const inspected: string[] = []
vi.mock("@/lib/clean-runner", async (original) => {
  const real = await original<typeof import("@/lib/clean-runner")>()
  return {
    ...real,
    createRunner: () => {
      const runner = real.createRunner()
      return { ...runner, inspect: (file: File) => (inspected.push(file.name), runner.inspect(file)) }
    },
  }
})

const file = (name: string, fx: string, type = "image/jpeg") => new File([fixture(fx) as BlobPart], name, { type })

async function setup(files: File[], openView = true) {
  const user = userEvent.setup()
  render(<Workspace />)
  await user.upload(screen.getByTestId("file-input"), files)
  if (openView) await user.click(screen.getByRole("tab", { name: "View" }))
  return user
}
const details = () => screen.getByRole("region", { name: "Details" })
const row = (label: string) => within(details()).getByText(label, { selector: "dt" }).closest("div")!

beforeEach(() => {
  vi.clearAllMocks()
  inspected.length = 0
})

describe("View mode", () => {
  it("shows what a photo carries, in groups, with real values", async () => {
    await setup([file("phone.jpg", "phone-gps.jpg")])
    expect(await within(details()).findByRole("heading", { name: "Location" })).toBeInTheDocument()
    for (const group of ["Camera", "Dates", "Software", "Picture", "Hidden extras"]) {
      expect(within(details()).getByRole("heading", { name: group })).toBeInTheDocument()
    }
    expect(within(row("Coordinates")).getByText("22.365067, 91.830033")).toBeInTheDocument()
    expect(within(row("Make")).getByText("FixtureCo")).toBeInTheDocument()
    expect(within(row("Camera serial number")).getByText("SN-0000-PHONE")).toBeInTheDocument()
    expect(within(row("Orientation")).getByText("Rotated 90 degrees clockwise")).toBeInTheDocument()
  })

  it("warns about location only when coordinates are stored, and offers no map", async () => {
    await setup([file("phone.jpg", "phone-gps.jpg")])
    expect(await within(details()).findByText("This photo shows where it was taken.")).toBeInTheDocument()
    expect(document.querySelector("a[href*='map'], iframe, img[src*='tile']")).toBeNull()
  })

  it("does not raise the warning for a GPS section with no coordinates, and says what it holds", async () => {
    await setup([file("le.jpg", "little-endian.jpg")])
    expect(await within(details()).findByText("GPS data")).toBeInTheDocument()
    expect(within(row("GPS data")).getByText("Present, but it holds no coordinates")).toBeInTheDocument()
    // no warning panel at all, in either wording
    expect(within(details()).queryByText(/where it was taken|location data/)).not.toBeInTheDocument()
  })

  it("names the source when it is not plain EXIF", async () => {
    await setup([file("cam.jpg", "camera-xmp-iptc.jpg")])
    expect(await within(details()).findByRole("heading", { name: "Author and copyright" })).toBeInTheDocument()
    expect(within(row("Creator")).getByText("XMP")).toBeInTheDocument()
    expect(within(row("Photographer")).getByText("IPTC")).toBeInTheDocument()
    expect(within(row("Comment")).getByText("Fixture comment: shot at the secret place")).toBeInTheDocument()
  })

  it("says so when there is nothing identifying", async () => {
    await setup([file("clean.jpg", "no-metadata.jpg")])
    expect(await within(details()).findByText("Nothing identifying was found in this photo.")).toBeInTheDocument()
  })

  it("copies a single value, and announces it", async () => {
    const user = await setup([file("phone.jpg", "phone-gps.jpg")])
    await within(details()).findByText("Coordinates")
    await user.click(within(details()).getByRole("button", { name: "Copy Coordinates" }))
    expect(await navigator.clipboard.readText()).toBe("22.365067, 91.830033")
    expect(await within(details()).findByText("Copied")).toBeInTheDocument()
  })

  it("copies the whole list as plain text", async () => {
    const user = await setup([file("holiday.jpg", "phone-gps.jpg")])
    await within(details()).findByText("Coordinates")
    await user.click(within(details()).getByRole("button", { name: "Copy everything" }))
    const text = await navigator.clipboard.readText()
    expect(text.split("\n")[0]).toBe("holiday.jpg")
    expect(text).toContain("Location\n  Coordinates: 22.365067, 91.830033")
  })

  it("stays in View when photos are added there", async () => {
    const user = await setup([], false)
    await user.click(screen.getByRole("tab", { name: "View" }))
    await user.upload(screen.getByTestId("file-input"), [file("phone.jpg", "phone-gps.jpg")])
    expect(await within(details()).findByRole("heading", { name: "Location" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "View" })).toHaveAttribute("aria-selected", "true")
  })

  it("keeps the same photos when switching between modes", async () => {
    const user = await setup([file("phone.jpg", "phone-gps.jpg")], false)
    await screen.findByText("phone.jpg")
    await user.click(screen.getByRole("tab", { name: "View" }))
    await within(details()).findByText("Coordinates")
    await user.click(screen.getByRole("tab", { name: "Clean" }))
    expect(await screen.findByRole("button", { name: "Clean and download" })).toBeInTheDocument()
  })

  it("jumps to Clean from View", async () => {
    const user = await setup([file("phone.jpg", "phone-gps.jpg")])
    await within(details()).findByText("Coordinates")
    await user.click(within(details()).getByRole("button", { name: "Clean this photo" }))
    expect(screen.getByRole("tab", { name: "Clean" })).toHaveAttribute("aria-selected", "true")
    expect(await screen.findByRole("button", { name: "Clean and download" })).toBeInTheDocument()
  })

  it("shows a queue for several photos and each photo's own details", async () => {
    const user = await setup([file("phone.jpg", "phone-gps.jpg"), file("cam.jpg", "camera-xmp-iptc.jpg")])
    await within(details()).findByText("Coordinates")
    expect(within(screen.getByRole("list", { name: "Photos" })).getAllByRole("listitem")).toHaveLength(2)
    await user.click(within(screen.getByRole("list", { name: "Photos" })).getByRole("button", { name: /^cam\.jpg/ }))
    expect(await within(details()).findByText("Photographer")).toBeInTheDocument()
    expect(within(details()).queryByText("Coordinates")).not.toBeInTheDocument()
  })

  it("reads the details only when View is opened", async () => {
    const user = await setup([file("phone.jpg", "phone-gps.jpg")], false)
    await screen.findByText("phone.jpg")
    expect(screen.queryByText("Coordinates")).not.toBeInTheDocument()
    await user.click(screen.getByRole("tab", { name: "View" }))
    await waitFor(() => expect(within(details()).getByText("Coordinates")).toBeInTheDocument())
  })

  it("reads each photo's details once, only when it is looked at in View, and remembers them", async () => {
    const user = await setup([file("a.jpg", "phone-gps.jpg"), file("b.jpg", "camera-xmp-iptc.jpg"), file("c.png", "png-metadata.png", "image/png")], false)
    await screen.findByText("Clean all and download ZIP")
    expect(inspected).toEqual([]) // nothing read while in Clean mode

    await user.click(screen.getByRole("tab", { name: "View" }))
    await within(details()).findByText("Coordinates")
    expect(inspected).toEqual(["a.jpg"]) // only the photo on screen, not all three

    await user.click(within(screen.getByRole("list", { name: "Photos" })).getByRole("button", { name: /^b\.jpg/ }))
    await within(details()).findByText("Photographer")
    expect(inspected).toEqual(["a.jpg", "b.jpg"])

    await user.click(within(screen.getByRole("list", { name: "Photos" })).getByRole("button", { name: /^a\.jpg/ }))
    await within(details()).findByText("Coordinates")
    expect(inspected).toEqual(["a.jpg", "b.jpg"]) // a.jpg was remembered, not read again
  })
})
