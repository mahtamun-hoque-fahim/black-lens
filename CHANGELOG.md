# Changelog

## [v0.2.0] 2026-10-09

View mode: see everything a photo gives away before you decide what to do about it. Licensed under MIT.

### Added
- View mode. Open the View tab to read what a photo carries, grouped the way people think about it: Location, Camera, Dates, Software, Author and copyright, Captions and notes, Picture, and Hidden extras. Values are shown in a monospaced font so serial numbers and coordinates are easy to read (04075ff)
- A copy button on every value, named after what it copies, and a "Copy everything" button that copies the whole list as plain text. Copying is announced to screen readers, and there is a fallback for browsers that block the clipboard (04075ff)
- Real values, not just labels: coordinates in decimal and degrees, altitude above or below sea level, exposure time, aperture, ISO, focal length, lens, serial numbers, dates with time zones, orientation, resolution and size. Reads EXIF from JPEG, PNG and WebP, plus XMP, IPTC captions and credits, JPEG comments, and PNG text, including compressed text (9def43c, 7ec88f4, 20aae49)
- "Hidden extras" lists what you would not think to look for: an embedded preview image, private maker notes, extra data attached after the image, unrecognised chunks and the unique document ID that can link copies of a photo (20aae49)
- A location warning in View, using the same destructive colours as Clean. There is no map and no link out: coordinates never leave the page unless you copy them yourself
- View and Clean share the same photos. Load photos in either mode, switch tabs, and nothing is lost. Details are read only for the photo you are looking at, and remembered (04075ff, 65fca25)
- Details are read in the background worker, so large photos do not freeze the page (e1deead)
- MIT licence, README badges, and a GitHub description and topics (6f7dbe1)

### Fixed
- The location warning no longer appears for photos whose GPS section holds no coordinates. Phones with location turned off write such a section, and v0.1.0 told you "This photo shows where it was taken" for them. A photo now counts as having a location only if it stores latitude or longitude. A GPS section with no coordinates is noted plainly instead (20aae49)

### Changed
- Back to top now watches a marker at the top of the page instead of listening to every scroll, so it costs nothing while you scroll. The skip link now appears for keyboard focus only (01520f6)

### Quality
- 458 automated tests. Every value View shows was checked against exiftool on 28 files, in both directions: 128 values verified, none invented, none missed. Non-square test images in every format catch width and height mix-ups, and 40 planted bugs were used to find and close gaps in the tests (7590181)
- The refinery design and copy linter passes with no findings

### Not yet
- Tag mode (the tab is visible but switched off), HEIC photos, the owner dashboard, and the command line and local MCP tools

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
