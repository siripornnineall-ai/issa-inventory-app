-- ลำดับสีของแต่ละรุ่นที่ใช้แสดงในทุกหน้า (สต็อก ยอดขาย นับสต็อก โรงงาน BC ฯลฯ)
-- ว่าง = ใช้ลำดับมาตรฐานในโค้ด (src/lib/utils/colorOrder.ts) เป็นการแสดงผลอย่างเดียว ไม่แตะตารางสต็อกหรือประวัติการเคลื่อนไหว
alter table public.products
  add column if not exists color_order text[];
