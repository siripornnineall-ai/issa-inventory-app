// JSX ที่ใช้ร่วมกันสำหรับสร้างไอคอนแอป (favicon/apple-touch-icon/PWA manifest icon)
// ด้วย next/og ImageResponse — ดีไซน์เดียวกันทุกขนาด
// ใช้โลโก้ ISSA Apparel (ไฟล์สาธารณะในที่เก็บรูปของฐานข้อมูล bucket brand-logos) ดึงตอน build แล้วฝังเป็น data URL
// ถ้าดึงไม่ได้ (เครือข่ายล้ม/ไฟล์หาย) ใช้ตัวอักษร "IS" บนพื้นเขียวเข้มแบบเดิมแทน ไม่ให้ build ล้ม
// ถ้าเปลี่ยนโลโก้ในหน้าตั้งค่าแบรนด์ ให้แก้ค่า ISSA_LOGO_URL ที่นี่ให้ตรงกัน แล้ว deploy ใหม่

export const ISSA_LOGO_URL = "https://wcdprwvcrqpxtajchalr.supabase.co/storage/v1/object/public/brand-logos/dce06b13-918a-48c4-9021-40758c347fb6/f74085b5-5e62-4508-a9e8-06339325bac5.jpg";

export async function loadBrandLogoDataUrl(url: string = ISSA_LOGO_URL, timeoutMs = 8000): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) return null;
      const type = res.headers.get("content-type") ?? "";
      if (!type.startsWith("image/")) return null;
      const bytes = Buffer.from(await res.arrayBuffer());
      if (bytes.length === 0) return null;
      return `data:${type};base64,${bytes.toString("base64")}`;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return null;
  }
}

export function AppIconMark({ size, logo }: { size: number; logo?: string | null }) {
  if (logo) {
    // โลโก้อยู่กลางพื้นขาว เว้นขอบรอบ ~14% (มือถือบางรุ่นตัดมุมไอคอนเป็นวงกลม/มุมมน)
    const inner = Math.round(size * 0.72);
    return (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#ffffff" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} width={inner} height={inner} alt="ISSA" style={{ width: inner, height: inner, objectFit: "contain" }} />
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
