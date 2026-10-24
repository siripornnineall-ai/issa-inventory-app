-- สต็อกคืนสินค้า: แยกจากรับสินค้าเข้า 4 ประเภท (ตีกลับ / คืน / ตำหนิ / เปลี่ยน)
alter type public.movement_type add value if not exists 'return_rts';
alter type public.movement_type add value if not exists 'return_customer';
alter type public.movement_type add value if not exists 'return_defective';
alter type public.movement_type add value if not exists 'return_exchange';

-- ใบรับคืนใช้ตารางใบรับเข้าเดิม แต่ระบุประเภทคืนไว้ (ว่าง = ใบรับเข้าสินค้าใหม่ตามปกติ)
alter table public.stock_in_docs add column if not exists return_type text;
alter table public.stock_in_docs drop constraint if exists stock_in_docs_return_type_check;
alter table public.stock_in_docs add constraint stock_in_docs_return_type_check
  check (return_type is null or return_type in ('return_rts', 'return_customer', 'return_defective', 'return_exchange'));
