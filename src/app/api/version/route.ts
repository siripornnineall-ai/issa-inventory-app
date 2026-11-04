// เวอร์ชันของแอปที่เซิร์ฟเวอร์ให้บริการอยู่ตอนนี้ แอปที่เปิดค้างไว้ถามเพื่อเทียบกับเวอร์ชันของตัวเอง (ดู UpdateBanner)
// ต้องไม่ถูกแคชเด็ดขาด ไม่งั้นเครื่องที่ค้างเวอร์ชันเก่าจะไม่รู้ว่ามีของใหม่
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ id: process.env.NEXT_PUBLIC_BUILD_ID ?? "dev" }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
