import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ISSA Apparel | ระบบจัดการสต็อก",
    short_name: "ISSA Stock",
    description: "ระบบจัดการสต็อกสินค้าและอุปกรณ์ ISSA Apparel",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#eafdff",
    theme_color: "#00282d",
    lang: "th",
    icons: [
      { src: "/manifest-icon-192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/manifest-icon-192", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/manifest-icon-512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/manifest-icon-512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
