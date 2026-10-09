/**
 * Copy text to the clipboard. Tries the modern API first; if the browser lacks it or refuses
 * (some embedded browsers do), falls back to selecting a hidden text box. Returns whether it worked,
 * so the screen never claims "Copied" when nothing was copied.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // fall through to the older way
  }
  try {
    const box = document.createElement("textarea")
    box.value = text
    box.setAttribute("readonly", "")
    box.style.position = "fixed"
    box.style.opacity = "0"
    document.body.appendChild(box)
    box.focus() // some browsers, iOS Safari in particular, only copy a selection inside a focused field
    box.select()
    box.setSelectionRange(0, text.length)
    const ok = document.execCommand("copy")
    box.remove()
    return ok
  } catch {
    return false
  }
}
