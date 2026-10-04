import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Black Lens",
    template: "%s | Black Lens",
  },
  description: "Remove hidden metadata from photos in your browser. Nothing is uploaded.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
