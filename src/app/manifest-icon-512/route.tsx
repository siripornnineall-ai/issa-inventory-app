import { ImageResponse } from "next/og";
import { AppIconMark, loadBrandLogoDataUrl } from "@/lib/utils/appIcon";

// สร้างครั้งเดียวตอน build (ไม่ดึงโลโก้ซ้ำทุกครั้งที่เรียก)
export const dynamic = "force-static";

export async function GET() {
  return new ImageResponse(<AppIconMark size={512} logo={await loadBrandLogoDataUrl()} />, { width: 512, height: 512 });
}
