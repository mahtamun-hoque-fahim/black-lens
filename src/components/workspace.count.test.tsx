import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { reportCount } from "@/lib/report-count"
import { fixture } from "@/lib/metadata/test-utils"
import { Workspace } from "./workspace"

vi.mock("@/lib/download", () => ({ saveBytes: vi.fn(), saveParts: vi.fn() }))
vi.mock("@/lib/report-count", () => ({ reportCount: vi.fn() }))

const jpg = (name: string) => new File([fixture("phone-gps.jpg") as BlobPart], name, { type: "image/jpeg" })
const heic = (name: string) =>
  new File([new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63, 0, 0, 0, 0])], name, { type: "image/heic" })

async function setup(files: File[], tab?: "View" | "Tag") {
  const user = userEvent.setup()
  render(<Workspace />)
  if (tab) await user.click(screen.getByRole("tab", { name: tab }))
  await user.upload(screen.getByTestId("file-input"), files)
  return user
}
const reports = () => vi.mocked(reportCount).mock.calls

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

describe("usage counter: Clean", () => {
  it("reports one photo cleaned, only after it succeeded", async () => {
    const user = await setup([jpg("a.jpg")])
    await user.click(await screen.findByRole("button", { name: "Clean and download" }))
    await screen.findByRole("heading", { name: "All identifying metadata removed" })
    expect(reports()).toEqual([["clean", 1]])
  })

  it("reports a whole batch once, counting only the photos that were cleaned", async () => {
    const user = await setup([jpg("a.jpg"), jpg("b.jpg"), jpg("c.jpg"), heic("d.heic")])
    await user.click(await screen.findByRole("button", { name: "Clean all and download ZIP" }))
    await waitFor(() => expect(reports()).toHaveLength(1))
    expect(reports()).toEqual([["clean", 3]])
  })

  it("reports nothing when nothing was cleaned", async () => {
    await setup([heic("a.heic")])
    await screen.findByText(/can't|cannot|not supported|unsupported/i)
    expect(reports()).toEqual([])
  })

  it("does not report merely for adding photos or switching tabs", async () => {
    const user = await setup([jpg("a.jpg"), jpg("b.jpg")])
    await screen.findByRole("button", { name: "Clean all and download ZIP" })
    await user.click(screen.getByRole("tab", { name: "Tag" }))
    expect(reports()).toEqual([])
  })
})

describe("usage counter: Tag", () => {
  it("reports one photo tagged", async () => {
    const user = await setup([jpg("a.jpg")], "Tag")
    await user.type(await screen.findByLabelText("Artist"), "Fahim")
    await user.click(screen.getByRole("button", { name: "Clean, tag, and download" }))
    await waitFor(() => expect(reports()).toEqual([["tag", 1]]))
  })

  it("reports a tagged batch under Tag, not Clean, and never sends what was typed", async () => {
    const user = await setup([jpg("a.jpg"), jpg("b.jpg")], "Tag")
    await user.type(await screen.findByLabelText("Artist"), "Secret Name")
    await user.click(screen.getByRole("button", { name: "Clean, tag, and download" }))
    await waitFor(() => expect(reports()).toHaveLength(1))
    expect(reports()).toEqual([["tag", 2]])
    expect(JSON.stringify(reports())).not.toContain("Secret Name")
  })
})

describe("usage counter: View", () => {
  it("reports a photo once when its details are read", async () => {
    await setup([jpg("a.jpg")], "View")
    await waitFor(() => expect(reports()).toEqual([["view", 1]]))
  })

  it("does not report again when the person comes back to the same photo", async () => {
    const user = await setup([jpg("a.jpg")], "View")
    await waitFor(() => expect(reports()).toHaveLength(1))
    await user.click(screen.getByRole("tab", { name: "Clean" }))
    await user.click(screen.getByRole("tab", { name: "View" }))
    await within(screen.getByRole("region", { name: "Details" })).findByRole("heading", { name: "Location" })
    expect(reports()).toEqual([["view", 1]])
  })

  it("reports each photo of a batch the first time it is looked at", async () => {
    const user = await setup([jpg("a.jpg"), jpg("b.jpg")], "View")
    await waitFor(() => expect(reports()).toHaveLength(1))
    await user.click(within(screen.getByRole("list", { name: "Photos" })).getAllByRole("listitem")[1].querySelector("button")!)
    await waitFor(() => expect(reports()).toHaveLength(2))
    expect(reports().every((c) => c[0] === "view" && c[1] === 1)).toBe(true)
  })
})
