-- ยกเลิกใบรับเข้า/ใบรับคืน: รับเข้าผิดรุ่น/ผิดจำนวนแล้วย้อนได้โดยไม่ต้อง "ขายหลอก"
-- ใบเดิมไม่ถูกลบ (ประวัติ stock_movements ห้ามลบ/แก้ตัวเลข) แค่ทำเครื่องหมายว่ายกเลิก แล้วมีรายการเคลื่อนไหวติดลบมาหักคืนชนิด cancel_stock_in
alter type public.movement_type add value if not exists 'cancel_stock_in';

alter table public.stock_in_docs
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancel_reason text,
  add column if not exists cancelled_by_name text;
