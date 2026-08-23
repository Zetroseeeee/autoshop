import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ServiceWorker } from "@/components/ServiceWorker";

export const metadata: Metadata = {
  title: "Basket",
  description: "Personal multi-store shopping basket",
  applicationName: "Basket",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Basket",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#f5f5f7",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB" className="h-full">
      <body className="min-h-full">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
