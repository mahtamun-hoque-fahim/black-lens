// Shared by every format's stripper, so the UI describes results the same way.

export interface StripOptions {
  /** Also remove the ICC colour profile. Off by default: removing it can shift colours. */
  removeIcc?: boolean
}

export type RemovedKind =
  | "exif"
  | "xmp"
  | "iptc"
  | "comment"
  | "text"
  | "modified-time"
  | "jfif-thumbnail"
  | "trailing-data"
  | "icc"
  | "other-segment"

export interface RemovedItem {
  kind: RemovedKind
  bytes: number
}

export type KeptItem =
  | { kind: "orientation"; value: number }
  | { kind: "icc"; bytes: number }
  | { kind: "structure" }

export interface VerifyOptions {
  /** Pass the same value given to the stripper: a surviving ICC profile is a finding when removal was requested. */
  removeIcc?: boolean
}

export interface Verification {
  clean: boolean
  /** Plain descriptions of anything found that should not be there. Empty when clean. */
  findings: string[]
}
