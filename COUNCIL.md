# COUNCIL.md — Black Lens

## PRE-BUILD verdict (2026-10-05)

Context: BRAIN.md and SITETREE.md (6 routes). Singularity interview done; Council interview skipped.

### SALESMAN
Demand is real but thin and already served. Free options exist: browser cleaners such as inbrowser.app's, the ExifCleaner desktop app, and OS built-ins. Nobody searches for this daily. They need it at one moment: before posting, selling or sending a photo. Black Lens will not win on features. It wins on a believable trust story and finish: client-side, batch, clear "what we found", your own fields written back. As a showcase, the proof is a verifiable demo (clean, then re-scan, zero tags) plus a repo with tests. The showcase audience is still unpicked, and it decides how much landing-page polish earns its place.

### COIN-MASTER
There is nothing to monetize by design: no payments, no ads, no accounts. Ongoing cost is a domain, and Neon and Vercel at hobby scale. The return is indirect: portfolio credibility and conversation starters for freelance work. Do not bolt on a paid tier later; it contradicts the locked anti-goals. If it ever needs to earn, the honest route is "built by Mahtamun, available for hire" in the footer.

### WIZARD
The flow is short: drop, see what was found, clean, download. Risks:
- Clean is the default, so users may never see what was removed. Show a plain "removed N items, including location" summary before the download button.
- Browsers block many simultaneous downloads. Batches must default to one ZIP.
- Folder picking does not exist on iPhone, and phone pickers can change the file (HEIC converted to JPEG, location options). Test on real phones, not just a narrow desktop window.
- HEIC is "not supported yet" in v1, and iPhone photos are often HEIC. Expect people to hit that wall first and word the message so it tells them what to do.

### ARCHITECT
- Correctness is the product. A strip that leaves one segment (PNG text chunks, WebP EXIF/XMP, JPEG APP segments, trailing data, embedded thumbnails) breaks the promise. It needs fixtures and a re-read check.
- Removing the EXIF Orientation tag makes rotated photos display sideways. Orientation is not private, so it must be kept (or applied losslessly). The colour profile (ICC) is the same kind of decision: stripping it shifts colours. "Strip everything" is not yet precisely defined.
- Big batches and ZIPs can exhaust the user's tab memory (zip bombs included). Cap count and size, and process sequentially.
- The counter endpoint is unauthenticated: validate the schema, rate-limit it, store no IPs, accept counts only. Vercel's own logs still see IPs, and the privacy page must say so.
- Better Auth for one owner: disable sign-up at the server, not just hide the button; seed the owner by script; rate-limit login.
- CSP with `connect-src 'self'`, fonts through next/font, no third-party hosts. Keep dependencies minimal and audit the ZIP library.
- MEDIUM: Neon + Drizzle + Better Auth is heavy for a counters page. It is locked and it is a learning goal, so accepted, but it is the part most likely to slow the first working version.

### GENERAL
**CONDITIONAL GO.** The idea is small, honest and checkable, which is its strength. The real risk is scope: Clean, View, Tag, three formats, batch/ZIP, a dashboard, then a CLI and an MCP server, built solo. Ship vertical slices.

Top 5 before line 1:
1. **Define "everything" precisely, in writing.** Per format, which segments are removed and which are kept (Orientation, and a decision on the ICC profile). Lock it in BRAIN.md.
2. **Fixtures first.** Test files per format with known metadata. Every strip is verified by re-reading the output (zero metadata) and by comparing the image data (unchanged). Tests before code.
3. **Build order: vertical slices.** Clean on JPEG, one file, end to end. Then PNG and WebP. Then batch and ZIP. Then View, Tag, the dashboard (gate for the public showcase, not for the first working Clean), then CLI and MCP.
4. **Make the trust surface true.** CSP locks network access, the privacy page names the counters and what Vercel logs, and "check the Network tab" appears only if the wording matches what the tab will show. After cleaning, show a verified re-scan result.
5. **Harden the two server pieces.** Counter endpoint: counts only, validated, rate-limited, no IPs. Owner auth: sign-up disabled server-side, seeded owner, rate-limited login.
