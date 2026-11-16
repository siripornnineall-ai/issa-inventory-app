import { ImageResponse } from "next/og";
import { AppIconMark, loadBrandLogoDataUrl } from "@/lib/utils/appIcon";

// เส้นทางคงที่ (ไม่เปลี่ยนแปลง) สำหรับให้ manifest.ts อ้างอิงได้โดยตรง
// ต่างจาก icon.tsx/apple-icon.tsx ที่ Next.js จัดการ URL ให้เองสำหรับ <link> ในหน้าเว็บเท่านั้น
// สร้างครั้งเดียวตอน build (ไม่ดึงโลโก้ซ้ำทุกครั้งที่เรียก)
export const dynamic = "force-static";

export async function GET() {
  return new ImageResponse(<AppIconMark size={192} logo={await loadBrandLogoDataUrl()} />, { width: 192, height: 192 });
}
