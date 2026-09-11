import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Thai } from "next/font/google";
import "./globals.css";
import { AppHydration } from "@/lib/store/hydration";
import { ToastViewport } from "@/lib/toast";
import { ServiceWorkerRegister } from "@/components/layout/ServiceWorkerRegister";

const ibmPlexSansThai = IBM_Plex_Sans_Thai({
  variable: "--font-ibm-plex-thai",
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "ISSA Apparel | ระบบจัดการสต็อก",
  description: "ระบบจัดการสต็อกสินค้าและอุปกรณ์ ISSA Apparel",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ISSA Stock",
  },
};

export const viewport: Viewport = {
  themeColor: "#00282d",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className={`${ibmPlexSansThai.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans bg-[var(--color-bg)] text-[var(--color-on-surface)]">
        <AppHydration>{children}</AppHydration>
        <ToastViewport />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
