# ISSA Apparel — Inventory Management System

ระบบจัดการสต็อกสินค้าและอุปกรณ์สำหรับแบรนด์ ISSA Apparel พัฒนาด้วย Next.js (App Router) + TypeScript + Tailwind CSS โดยออกแบบให้ตรงกับ Stitch design system ของแบรนด์ **เชื่อมต่อฐานข้อมูล Supabase จริงแล้ว** ไม่ใช่โหมดเดโม

## เทคโนโลยีที่ใช้

- **Next.js 16** (App Router, Turbopack) + React 19 + TypeScript
- **Tailwind CSS 4** สำหรับ styling ตาม design tokens ของแบรนด์
- **Supabase** — ฐานข้อมูลจริง (Postgres + Auth + RLS) ดู `supabase/migrations/0001_init.sql` สำหรับ schema
- **Zustand + Immer** เป็น in-memory cache ฝั่ง client: `engine.ts` รัน business logic แบบ sync ทันที ส่วน `src/lib/supabase/sync.ts` บันทึกทุกการเปลี่ยนแปลงกลับไปที่ Supabase แบบ write-through เบื้องหลัง
- **Recharts** สำหรับกราฟในแดชบอร์ด, **xlsx** สำหรับ export Excel
- **Vitest** สำหรับทดสอบ business logic

## เริ่มต้นใช้งาน

ต้องมีไฟล์ `.env.local` พร้อมค่าเชื่อมต่อ Supabase (ดูตัวอย่างด้านล่าง) ก่อนรัน:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

```bash
npm install
npm run dev
```

เปิด [http://localhost:3000](http://localhost:3000)

### บัญชีผู้ใช้งาน

หน้า login มีปุ่มเข้าสู่ระบบด่วนสำหรับแต่ละบทบาท (บัญชีจริงใน Supabase Auth) รหัสผ่านเริ่มต้นคือ `issa2024` — ควรเปลี่ยนก่อนใช้งานจริงกับทีม

| บทบาท | อีเมล |
|---|---|
| ผู้ดูแลระบบ (admin) | admin@issa.demo |
| ผู้จัดการ (manager) | manager@issa.demo |
| พนักงานคลัง (warehouse) | warehouse@issa.demo |
| พนักงานขาย (sales) | sales@issa.demo |
| ผู้ดูรายงาน (viewer) | viewer@issa.demo |

## คำสั่งที่ใช้บ่อย

```bash
npm run dev        # เริ่ม dev server
npm run build      # build สำหรับ production
npm run lint       # ตรวจสอบ ESLint ทั้งโปรเจกต์
npm run test       # รัน automated tests (Vitest)
npx tsc --noEmit   # ตรวจสอบ TypeScript type
```

## โครงสร้างโปรเจกต์

```
src/
  app/(app)/            หน้าเว็บทั้งหมดในระบบ (ต้องผ่าน layout ที่มี Sidebar/Header)
  components/           UI components แบ่งตามโดเมน (products, equipment, stock, suppliers, users, settings, ui/)
  lib/
    store/               engine.ts (business logic ล้วน, sync), state.ts, index.ts (zustand + write-through), selectors.ts
    supabase/             client.ts/server.ts (Supabase client), fetch.ts (โหลดข้อมูลทั้งหมด), sync.ts (บันทึกส่วนต่างกลับไปฐานข้อมูล)
    auth/                 permissions.ts (role → permission matrix), session.ts (hooks)
    types.ts              โครงสร้างข้อมูลหลัก ตรงกับ supabase/migrations/0001_init.sql
    utils/                 ตัวช่วยจัดการเงิน/วันที่/รหัสเอกสาร
supabase/migrations/     SQL schema ที่ใช้งานจริงกับโปรเจกต์ Supabase
```

## สถาปัตยกรรมการเชื่อมต่อฐานข้อมูล

1. เมื่อโหลดหน้าเว็บ `AppHydration` เช็ค Supabase session แล้วดึงข้อมูลทั้งหมดจากฐานข้อมูลมาไว้ใน Zustand store (`fetch.ts`)
2. ทุกการทำรายการ (รับเข้า/เบิกออก/โอนย้าย/สร้างสินค้า ฯลฯ) รันผ่าน `engine.ts` แบบ synchronous ในหน่วยความจำก่อน (ทำให้ UI ตอบสนองทันที พร้อม validation ครบ)
3. หลังจากนั้น `sync.ts` จะเทียบ state ก่อน/หลัง แล้วบันทึกส่วนต่างกลับไปที่ Supabase แบบเรียงคิวตามลำดับ (write-through) — ถ้าบันทึกไม่สำเร็จจะแจ้งเตือนผู้ใช้ทันที

ดูรายละเอียดฟีเจอร์ที่ทำเสร็จแล้วทั้งหมด รวมถึงบั๊กที่พบระหว่างทดสอบกับฐานข้อมูลจริงและวิธีแก้ไข ใน [`TASKS.md`](./TASKS.md)
