import { ImageResponse } from "next/og";
import { AppIconMark, loadBrandLogoDataUrl } from "@/lib/utils/appIcon";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default async function Icon() {
  return new ImageResponse(<AppIconMark size={32} logo={await loadBrandLogoDataUrl()} />, size);
}
