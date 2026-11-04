-- ตรวจเพิ่ม: ยอดรวมในใบรับเข้า/ออเดอร์ ต้องเท่ากับยอดรวมรายการเคลื่อนไหวที่อ้างเลขใบนั้น
-- ถ้าไม่เท่า แปลว่ามีการบันทึกที่เลขที่ใบชนกับของอีกเครื่อง (เกิดก่อนแอปจะออกเลขใหม่ให้เอง 4 พ.ย. 2026 เช่น SIN-20261104-0706 ใบ 1 ชิ้น รายการเคลื่อนไหว 493 ชิ้น)
-- นับตั้งแต่ 5 พ.ย. 2026 เป็นต้นไปเท่านั้น (รายการเก่าที่ทราบแล้วไม่ขึ้นเตือนซ้ำทุกคืน)
create or replace function public.integrity_issues()
returns table (kind text, ref text, at timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select 'order_without_lines'::text, o.order_no, o.created_at
    from orders o
   where o.created_at >= '2026-10-09' and not exists (select 1 from order_lines l where l.order_id = o.id)
  union all
  select 'stock_in_doc_without_lines', d.doc_no, d.created_at
    from stock_in_docs d
   where d.created_at >= '2026-10-09' and not exists (select 1 from stock_in_lines l where l.doc_id = d.id)
  union all
  select 'stock_out_doc_without_lines', d.doc_no, d.created_at
    from stock_out_docs d
   where d.created_at >= '2026-10-09' and not exists (select 1 from stock_out_lines l where l.doc_id = d.id)
  union all
  select 'transfer_without_lines', t.transfer_no, t.created_at
    from transfers t
   where t.created_at >= '2026-10-09' and not exists (select 1 from transfer_lines l where l.transfer_id = t.id)
  union all
  select 'sale_movement_without_order', m.related_doc_no, min(m.created_at)
    from stock_movements m
   where m.movement_type = 'sale' and m.created_at >= '2026-10-09' and m.related_doc_no is not null
     and not exists (select 1 from orders o where o.stock_out_doc_no = m.related_doc_no)
   group by m.related_doc_no
  union all
  select 'image_color_without_variant', p.selling_name || ' / ' || i.color, null::timestamptz
    from (select distinct product_id, color from product_images where color is not null) i
    join products p on p.id = i.product_id
   where not exists (select 1 from product_variants v where v.product_id = i.product_id and v.color = i.color)
  union all
  select 'product_without_variants', p.selling_name, p.created_at
    from products p
   where p.created_at >= '2026-10-09' and not exists (select 1 from product_variants v where v.product_id = p.id)
  union all
  select 'stock_in_doc_qty_mismatch', d.doc_no, d.created_at
    from stock_in_docs d
   where d.created_at >= '2026-11-05' and d.status <> 'cancelled'
     and (select coalesce(sum(l.qty), 0) from stock_in_lines l where l.doc_id = d.id)
      <> (select coalesce(sum(m.qty_change), 0) from stock_movements m
           where m.related_doc_no = d.doc_no and m.movement_type in ('stock_in', 'return_rts', 'return_customer', 'return_exchange', 'return_defective'))
  union all
  select 'order_qty_mismatch', o.order_no, o.created_at
    from orders o
   where o.created_at >= '2026-11-05' and o.stock_out_doc_no is not null
     and (select coalesce(sum(l.qty), 0) from order_lines l where l.order_id = o.id)
      <> (select coalesce(sum(-m.qty_change), 0) from stock_movements m where m.related_doc_no = o.stock_out_doc_no and m.movement_type = 'sale')
$$;

revoke all on function public.integrity_issues() from public, anon, authenticated;
grant execute on function public.integrity_issues() to service_role;
