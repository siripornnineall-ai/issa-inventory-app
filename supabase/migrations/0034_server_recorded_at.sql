-- เวลาที่ "เซิร์ฟเวอร์รับข้อมูลจริง" (ใส่ให้อัตโนมัติ) ต่างจาก created_at ที่มาจากนาฬิกาของเครื่องคนบันทึก
-- ใช้ตรวจย้อนหลังว่าบันทึกช้า (ส่งค้าง/ส่งซ้ำ) หรือนาฬิกาเครื่องเพี้ยน แถวเดิมปล่อยว่าง ไม่เดาให้
alter table public.stock_movements add column if not exists recorded_at timestamptz;
alter table public.stock_in_docs add column if not exists recorded_at timestamptz;
alter table public.stock_out_docs add column if not exists recorded_at timestamptz;
alter table public.orders add column if not exists recorded_at timestamptz;
alter table public.transfers add column if not exists recorded_at timestamptz;

alter table public.stock_movements alter column recorded_at set default now();
alter table public.stock_in_docs alter column recorded_at set default now();
alter table public.stock_out_docs alter column recorded_at set default now();
alter table public.orders alter column recorded_at set default now();
alter table public.transfers alter column recorded_at set default now();
