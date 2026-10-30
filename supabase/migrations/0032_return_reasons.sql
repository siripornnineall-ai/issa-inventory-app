-- สินค้าคืน/เปลี่ยน: เก็บเหตุผลที่ลูกค้าคืน (เลือกจากตัวเลือก) และ "เปลี่ยนเป็นรุ่นไหน" ต่อบรรทัดของใบรับคืน
-- เหตุผลใช้รหัสจากรายการคงที่ในแอป (src/lib/utils/returnReasons.ts) ใบเก่าที่ไม่มีค่า = ไม่ได้ระบุ
-- exchange_to_variant_id เป็นข้อมูลอย่างเดียว ไม่ตัดสต็อกของที่ส่งให้ลูกค้า (พนักงานยิงออกเองทีหลังตามปกติ)
alter table public.stock_in_lines
  add column if not exists return_reason text,
  add column if not exists return_tags text[],
  add column if not exists exchange_to_variant_id uuid references public.product_variants(id) on delete set null;
