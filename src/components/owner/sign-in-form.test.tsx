import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const nav = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }))
vi.mock("next/navigation", () => ({ useRouter: () => nav }))

import { SignInForm } from "./sign-in-form"

const fetchMock = vi.fn()
beforeEach(() => {
  vi.clearAllMocks()
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
})

async function submit(email = "owner@example.com", password = "a long password here") {
  const user = userEvent.setup()
  render(<SignInForm />)
  await user.type(screen.getByLabelText("Email"), email)
  await user.type(screen.getByLabelText("Password"), password)
  await user.click(screen.getByRole("button", { name: "Sign in" }))
  return user
}

describe("SignInForm", () => {
  it("has labelled fields that password managers understand, and hides the password", () => {
    render(<SignInForm />)
    expect(screen.getByLabelText("Email")).toHaveAttribute("type", "email")
    expect(screen.getByLabelText("Email")).toHaveAttribute("autocomplete", "username")
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password")
    expect(screen.getByLabelText("Password")).toHaveAttribute("autocomplete", "current-password")
  })

  it("signs in through the site's own auth endpoint and opens the dashboard", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }))
    await submit()
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/owner"))
    expect(nav.refresh).toHaveBeenCalled()
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("/api/auth/sign-in/email")
    expect(init.method).toBe("POST")
    expect(init.credentials).toBe("same-origin")
    expect(init.headers).toEqual({ "content-type": "application/json" })
    expect(JSON.parse(init.body)).toEqual({ email: "owner@example.com", password: "a long password here" })
  })

  it.each([
    [401, /do not match/i],
    [403, /do not match/i],
    [429, /too many attempts/i],
    [503, /not available/i],
  ])("says what went wrong for a %s answer, and does not leave the page", async (status, message) => {
    fetchMock.mockResolvedValue(new Response(null, { status }))
    await submit()
    expect(await screen.findByRole("alert")).toHaveTextContent(message)
    expect(nav.replace).not.toHaveBeenCalled()
  })

  it("says so when the network fails", async () => {
    fetchMock.mockRejectedValue(new TypeError("offline"))
    await submit()
    expect(await screen.findByRole("alert")).toHaveTextContent(/not available/i)
  })

  it("never puts the password in the page text or the error", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }))
    await submit("owner@example.com", "super secret phrase 1")
    const alert = await screen.findByRole("alert")
    expect(alert.textContent).not.toContain("super secret phrase 1")
  })

  it("is not clickable twice while a sign-in is in flight", async () => {
    let finish!: (r: Response) => void
    fetchMock.mockReturnValue(new Promise<Response>((resolve) => (finish = resolve)))
    const user = await submit()
    const button = screen.getByRole("button", { name: /signing in/i })
    expect(button).toHaveAttribute("aria-disabled", "true")
    await user.click(button)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    finish(new Response(null, { status: 401 }))
    await screen.findByRole("alert")
    expect(screen.getByRole("button", { name: "Sign in" })).toHaveAttribute("aria-disabled", "false")
  })

  it("needs both fields before it sends anything", async () => {
    const user = userEvent.setup()
    render(<SignInForm />)
    await user.click(screen.getByRole("button", { name: "Sign in" }))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(await screen.findByRole("alert")).toHaveTextContent(/enter your email and password/i)
  })
})
