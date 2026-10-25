import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Privacy",
  description: "What Black Lens does and does not collect. Your photos stay on your device.",
}

const H2 = "text-xl font-semibold"
const P = "mt-3 text-muted-foreground"
const LINK =
  "font-medium text-foreground underline underline-offset-4 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"

export default function PrivacyPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:py-16">
      <h1 className="text-3xl font-semibold sm:text-4xl">Privacy</h1>
      <p className="mt-4 max-w-prose text-lg text-muted-foreground">
        Black Lens is built so that your photos stay with you. This page says what the site does and does not collect.
      </p>
      <p className="mt-2 text-sm text-muted-foreground">Last updated 25 October 2026</p>

      <div className="mt-10 space-y-10">
        <section>
          <h2 className={H2}>Your photos</h2>
          <p className={P}>
            Black Lens reads, cleans and tags your photos inside your browser. They are never uploaded. Nothing leaves
            your device, including the details you type in Tag mode.
          </p>
        </section>

        <section>
          <h2 className={H2}>What Black Lens counts</h2>
          <p className={P}>
            After you view, clean or tag photos, your browser sends one small message to Black Lens saying which of the
            three you used and how many photos it was. For example: clean, 3.
          </p>
          <p className={P}>
            That is all it holds. It has no file names, no photo data, no metadata, no details you typed, no cookie and
            no account.
          </p>
          <p className={P}>
            The counter does not read or store your IP address. Its database keeps one number for each day and each of
            the three modes, and the site owner sees those totals on a private page. The numbers are not linked to any
            person, so there is nothing to look up about you.
          </p>
        </section>

        <section>
          <h2 className={H2}>What stays on your device</h2>
          <p className={P}>
            Black Lens saves two things in your browser’s own storage: your light or dark theme choice, and any Tag
            presets you save, which are a name and the details you typed. They are never sent anywhere. To remove them,
            clear your site data in your browser.
          </p>
        </section>

        <section>
          <h2 className={H2}>Cookies</h2>
          <p className={P}>
            Black Lens sets no cookies for visitors. The only cookie belongs to the owner’s sign-in page, and it exists
            only after the owner signs in.
          </p>
        </section>

        <section>
          <h2 className={H2}>Hosting</h2>
          <p className={P}>
            Black Lens is hosted by Vercel. Like any host, Vercel’s servers see the address of each visitor, the page
            requested and the time, and its request logs can include them. Vercel’s documentation says these logs are
            short-lived, kept for between one hour and one day depending on the plan. They are there for running and
            fixing the site.
          </p>
          <p className={P}>
            The daily totals are stored in a Neon database. Black Lens has no analytics, no advertising and no
            third-party scripts, and its fonts are served from the site itself.
          </p>
        </section>

        <section>
          <h2 className={H2}>Questions</h2>
          <p className={P}>
            If something here is unclear, email{" "}
            <a href="mailto:mahtamunhoquefahim@pm.me" className={LINK}>
              mahtamunhoquefahim@pm.me
            </a>{" "}
            or open an issue on the{" "}
            <a href="https://github.com/mahtamun-hoque-fahim/black-lens/issues" target="_blank" rel="noopener noreferrer" className={LINK}>
              project’s GitHub page
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  )
}
