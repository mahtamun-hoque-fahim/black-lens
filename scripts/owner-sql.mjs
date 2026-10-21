// Creates the SQL for the single owner login. Run it on your own computer:
//   npm run owner:sql
// It asks for the email and a password (typing is hidden), then prints SQL to paste into the
// Neon SQL Editor. The password is never written to disk or sent anywhere; only its hash is printed.
import { randomUUID } from "node:crypto"
import { createInterface } from "node:readline"
import { hashPassword } from "better-auth/crypto"
import { buildOwnerSql, isValidEmail, passwordProblem } from "./owner-sql-lib.mjs"

// One reader for all prompts. While `muted` is on, typed characters are not echoed to the screen.
const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: Boolean(process.stdin.isTTY) })
let muted = false
const writeToOutput = rl._writeToOutput?.bind(rl)
rl._writeToOutput = (text) => {
  if (!muted) writeToOutput?.(text)
}
const lines = []
let waiting = null
rl.on("line", (line) => (waiting ? waiting(line) : lines.push(line)))
rl.on("close", () => waiting?.(""))

function ask(question, { hidden = false } = {}) {
  process.stdout.write(question)
  muted = hidden
  return new Promise((resolve) => {
    const finish = (answer) => {
      waiting = null
      muted = false
      if (hidden) process.stdout.write("\n")
      resolve(answer)
    }
    if (lines.length) return finish(lines.shift())
    waiting = finish
  })
}

const fail = (message) => {
  console.error(message)
  rl.close()
  process.exit(1)
}

const email = (await ask("Owner email: ")).trim()
if (!isValidEmail(email)) fail("That does not look like a valid email.")
const password = await ask("Password (at least 12 characters, hidden): ", { hidden: true })
const problem = passwordProblem(password)
if (problem) fail(problem)
const again = await ask("Password again: ", { hidden: true })
if (again !== password) fail("The two passwords do not match.")
rl.close()

const sql = buildOwnerSql({ id: randomUUID(), email, hash: await hashPassword(password) })
console.log("\n--- Paste everything below into the Neon SQL Editor and run it ---\n")
console.log(sql)
