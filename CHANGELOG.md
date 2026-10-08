# Changelog

## [v0.1.0] 2026-10-09

First release. Black Lens removes hidden metadata from photos, in your browser. Photos never leave your device.

### Added
- Clean mode for JPEG, PNG and WebP. It removes everything identifying: location, camera make, model and serial numbers, dates, editing software, author and copyright, captions and keywords, embedded preview images, and data hidden after the end of the image. Nothing is re-encoded, so the picture is untouched (306b819, 68e27d7, 86f581b)
- It keeps what a photo needs to look right: the rotation (Orientation), the colour profile (with a switch to remove it too), transparency, and every frame of animated PNG and WebP files (306b819, 68e27d7, 86f581b)
- Every cleaned photo is read again before it is handed back, and its image data is compared with the original. If either check fails, no file is returned (306b819)
- A plain-language summary of what each photo carries before cleaning, with a warning when it shows where it was taken, and a result screen that lists what was removed and what was kept (141eeaf, fa380be)
- Batches: choose many photos, choose or drop a folder, or drop a ZIP, then download one ZIP of the cleaned copies. A queue on the left and an inspector on the right show each photo (bab8d84)
- Limits of 200 photos, 100 MB each and 500 MB per batch, with plain notices when something is left out (a7b81dc)
- Heavy work runs in a Web Worker so the page stays responsive, with a safe fallback to the main thread (4856d00)
- Light and dark themes that follow your device until you choose, a skip link, keyboard-friendly tabs and switches, and a 404 page (fa380be)
- Written specs for every format Black Lens reads or writes, in `docs/formats/` (ac7b003, af7b2b2, 9638254, c9c70c5)

### Quality
- 356 automated tests. Test files come from independent encoders (Pillow, piexif, Python's zipfile), and the output was checked with exiftool, Pillow and unzip. Planted bugs were used to confirm the tests can fail

### Not yet
- View and Tag modes (the tabs are visible but switched off), HEIC photos, the owner dashboard, and the command line and local MCP tools
