import { readFile } from "node:fs/promises";
import path from "node:path";

// JSX ที่ใช้ร่วมกันสำหรับสร้างไอคอนแอป (favicon/apple-touch-icon/PWA manifest icon) ด้วย next/og ImageResponse
// ใช้โลโก้ ISSA Apparel (ไฟล์ public/brand/issa-apparel-logo.png ขนาด 1200x1200 พื้นเขียวอมฟ้า ตัวอักษรขาว) เต็มกรอบไอคอน
// อ่านไฟล์ตอน build แล้วฝังเป็น data URL ถ้าอ่านไม่ได้ ใช้ตัวอักษร "IS" บนพื้นเขียวเข้มแบบเดิมแทน ไม่ให้ build ล้ม
// ถ้าจะเปลี่ยนโลโก้ ให้แทนที่ไฟล์นี้ (ต้องเป็นรูปจัตุรัส เว้นขอบรอบข้อความอย่างน้อย ~15% เพื่อไม่ให้ถูกตัดเมื่อมือถือครอบไอคอนเป็นวงกลม) แล้ว deploy ใหม่

export const ISSA_LOGO_FILE = "issa-apparel-logo.png"; // ไฟล์ใน public/brand

export async function loadBrandLogoDataUrl(fileName: string = ISSA_LOGO_FILE): Promise<string | null> {
  try {
    // จำกัดเส้นทางให้อยู่ในโฟลเดอร์ public/brand เท่านั้น (ไม่ให้ตัวสร้างแอปเก็บทั้งโปรเจกต์ไปกับเซิร์ฟเวอร์)
    const bytes = await readFile(path.join(process.cwd(), "public", "brand", fileName));
    if (bytes.length === 0) return null;
    return `data:image/png;base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

export function AppIconMark({ size, logo }: { size: number; logo?: string | null }) {
  if (logo) {
    return (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#234d5b" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} width={size} height={size} alt="ISSA" style={{ width: "100%", height: "100%" }} />
      </div>
    );
  }
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#00282d",
      }}
    >
      <span
        style={{
          fontSize: size * 0.42,
          fontWeight: 700,
          color: "#eafdff",
          letterSpacing: -1,
        }}
      >
        IS
      </span>
    </div>
  );
}
