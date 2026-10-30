-- สินค้าคืน/เปลี่ยน/ตีกลับ: ราคาต่อชิ้นของที่ถูกคืน (ตั้งต้นจากราคาขาย แก้ได้) ใช้รวมเป็นมูลค่าของที่ถูกคืนในหน้าสรุป
alter table public.stock_in_lines
  add column if not exists unit_price numeric(12,2);
