import { Workspace } from "@/components/workspace"

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:py-16">
      <h1 className="max-w-3xl text-3xl font-semibold text-balance sm:text-4xl">Remove the hidden details from your photos</h1>
      <p className="mt-4 max-w-prose text-lg text-muted-foreground">
        Photos carry more than the picture: where it was taken, which camera, and when. Black Lens removes that, and
        your photos never leave your device.
      </p>
      <div className="mt-10">
        <Workspace />
      </div>
    </div>
  )
}
