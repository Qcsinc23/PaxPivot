import type { Metadata, Viewport } from "next";
import "@fontsource-variable/manrope";
import "@fontsource/dm-serif-display";
import "@/styles/tokens.css";
import "@/styles/base.css";
import "@/styles/components.css";
import { AppShell } from "@/components/shell/AppShell";

export const metadata: Metadata = {
  title: "PaxPivot",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#faf3e7",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
