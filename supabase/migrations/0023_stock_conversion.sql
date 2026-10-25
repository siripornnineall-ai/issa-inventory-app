-- สินค้าที่เย็บเพิ่มตามออเดอร์ (เช่น Bobbie Mid เย็บจากตัวเปล่า Billie Wide): ตัวเลือกปลายทางชี้ไปที่ตัวเลือกต้นทาง
-- ตอนขาย ถ้าปลายทางไม่มีสต็อก ระบบตัดตัวเปล่าจากต้นทางมาเป็นปลายทางก่อน (แปลงรุ่น) แล้วค่อยขาย
alter type public.movement_type add value if not exists 'convert_out';
alter type public.movement_type add value if not exists 'convert_in';

alter table public.product_variants add column if not exists source_variant_id uuid references public.product_variants(id) on delete set null;
create index if not exists product_variants_source_variant_id_idx on public.product_variants(source_variant_id);
