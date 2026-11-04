import type { NextConfig } from "next";

// เลขเวอร์ชันของ build นี้ (ฝังลงทั้งโค้ดหน้าเว็บและเซิร์ฟเวอร์) ใช้ให้แอปที่เปิดค้างอยู่รู้ว่ามีเวอร์ชันใหม่ ดู UpdateBanner และ /api/version
// Vercel ใส่รหัส commit ให้ตอน build ถ้าไม่มี (เครื่องตัวเอง) ใช้ "dev" ซึ่งปิดการตรวจเวอร์ชัน
const buildId = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.VERCEL_DEPLOYMENT_ID ?? "dev";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_ID: buildId,
  },
};

export default nextConfig;
