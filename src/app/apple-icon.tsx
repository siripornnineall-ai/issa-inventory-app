import { ImageResponse } from "next/og";
import { AppIconMark, loadBrandLogoDataUrl } from "@/lib/utils/appIcon";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  return new ImageResponse(<AppIconMark size={180} logo={await loadBrandLogoDataUrl()} />, size);
}
