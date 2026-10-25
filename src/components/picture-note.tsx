/**
 * Shown on every finished result. The heading says identifying metadata was removed, which is true,
 * but a person could read it as "this photo can no longer identify me". It can: by what it shows.
 */
export function PictureNote() {
  return (
    <p className="text-sm text-muted-foreground">
      Black Lens does not remove what the picture itself shows. A face, a street sign, a reflection or a name written
      in the photo is still there for anyone who looks, and so is the file name unless you rename it.
    </p>
  )
}
