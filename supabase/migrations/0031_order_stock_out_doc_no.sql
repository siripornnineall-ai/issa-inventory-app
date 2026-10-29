-- ออเดอร์ขายผูกกับใบเบิกออก (SOUT-...) ที่ตัดสต็อกให้ออเดอร์นั้น
-- ใช้ตอนผู้ดูแลระบบ "ยกเลิกแบบไม่คืนสต็อก" (ขายหลอกเพื่อลบของที่ลงผิด): ตัวเลขสต็อกออกบนแดชบอร์ดจะข้ามรายการของใบเบิกนั้นด้วย
alter table public.orders
  add column if not exists stock_out_doc_no text;

-- เติมให้ออเดอร์เดิม: จับคู่เฉพาะที่ชัดเจน (คลังเดียวกัน จำนวนชิ้นรวมเท่ากัน สร้างห่างกันไม่เกิน 5 วินาที และเป็นคู่เดียวกันทั้งสองฝั่ง)
with o as (
  select o.id, o.warehouse_id, o.created_at, (select sum(qty) from public.order_lines where order_id = o.id) q
  from public.orders o
  where o.stock_out_doc_no is null
),
d as (
  select d.id, d.doc_no, d.warehouse_id, d.created_at, (select sum(qty) from public.stock_out_lines where doc_id = d.id) q
  from public.stock_out_docs d
  where d.reason_type = 'sale' and d.item_type = 'product'
),
m as (
  select o.id oid, d.doc_no,
         count(*) over (partition by o.id) n_o,
         count(*) over (partition by d.id) n_d
  from o join d
    on d.warehouse_id = o.warehouse_id and d.q = o.q
   and abs(extract(epoch from (d.created_at - o.created_at))) <= 5
)
update public.orders t
set stock_out_doc_no = m.doc_no
from m
where t.id = m.oid and m.n_o = 1 and m.n_d = 1;
