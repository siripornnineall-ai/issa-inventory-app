import { ImageResponse } from "next/og";
import { AppIconMark } from "@/lib/utils/appIcon";

// เส้นทางคงที่ (ไม่เปลี่ยนแปลง) สำหรับให้ manifest.ts อ้างอิงได้โดยตรง
// ต่างจาก icon.tsx/apple-icon.tsx ที่ Next.js จัดการ URL ให้เองสำหรับ <link> ในหน้าเว็บเท่านั้น
export async function GET() {
  return new ImageResponse(<AppIconMark size={192} />, { width: 192, height: 192 });
}
