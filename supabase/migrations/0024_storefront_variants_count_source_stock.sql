-- เว็บหน้าร้าน: ตัวเลือกที่เย็บตามออเดอร์ (product_variants.source_variant_id) นับตัวเปล่าของรุ่นต้นทางเป็นของที่ซื้อได้ด้วย
-- (สต็อกที่ซื้อได้ = ของที่เย็บแล้วของตัวเอง + ตัวเปล่าต้นทาง) คอลัมน์และสิทธิ์ของ view เหมือนเดิมทุกอย่าง
create or replace view public.storefront_variants as
select
  v.id,
  v.product_id,
  v.color,
  v.size,
  v.sku,
  v.selling_price,
  (coalesce(s.available_qty, 0::bigint) + coalesce(src.available_qty, 0::bigint)) > 0 as in_stock,
  least(coalesce(s.available_qty, 0::bigint) + coalesce(src.available_qty, 0::bigint), 5::bigint) as stock_hint
from product_variants v
join products p on p.id = v.product_id
left join (
  select vs.variant_id, sum(greatest(vs.qty_on_hand - vs.qty_reserved, 0)) as available_qty
  from variant_stock vs
  join warehouses w on w.id = vs.warehouse_id
  where (w.type = any (array['main'::warehouse_type, 'store'::warehouse_type])) and w.active
  group by vs.variant_id
) s on s.variant_id = v.id
left join (
  select vs.variant_id, sum(greatest(vs.qty_on_hand - vs.qty_reserved, 0)) as available_qty
  from variant_stock vs
  join warehouses w on w.id = vs.warehouse_id
  where (w.type = any (array['main'::warehouse_type, 'store'::warehouse_type])) and w.active
  group by vs.variant_id
) src on src.variant_id = v.source_variant_id
where v.active = true and p.status = 'active'::product_status;
