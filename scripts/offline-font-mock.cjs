// Offline stand-in for Google Fonts, for local production builds where fonts.googleapis.com is unreachable.
// Not used by Vercel. Run (from the repo root, PowerShell: set the variable first):
//   NEXT_FONT_GOOGLE_MOCKED_RESPONSES=$PWD/scripts/offline-font-mock.cjs npx next build --webpack
// --webpack because Turbopack's font loader reads Google's CSS in Rust and ignores this mock.
const face = (family, weight) => `/* latin */
@font-face {
  font-family: '${family}';
  font-style: normal;
  font-weight: ${weight};
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/mock/${family.replace(/ /g, "")}-latin.woff2) format('woff2');
  unicode-range: U+0000-00FF;
}`
module.exports = new Proxy({}, {
  has(_, url) { return typeof url === 'string' && url.startsWith('http') },
  get(_, url) {
    if (typeof url !== "string" || !url.startsWith("http")) return undefined
    if (url.includes("Inter")) return face("Inter", "100 900")
    if (url.includes("JetBrains")) return face("JetBrains Mono", "100 800")
    throw new Error("MOCK MISSING: " + url)
  },
})
