// JSX ที่ใช้ร่วมกันสำหรับสร้างไอคอนแอป (favicon/apple-touch-icon/PWA manifest icon)
// ด้วย next/og ImageResponse — ดีไซน์เดียวกันทุกขนาด แค่ปรับสัดส่วนตัวอักษรตามขนาดไอคอน
export function AppIconMark({ size }: { size: number }) {
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
