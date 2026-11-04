-- ตรวจความครบถ้วนของข้อมูลประจำคืน (ต่อจากตรวจสต็อกกับประวัติ ใน 0035)
-- เจอเร็วถ้ามีบันทึกไม่ครบ เช่น ออเดอร์/ใบไม่มีรายการสินค้า หรือสินค้าที่มีรูปของสีแต่ไม่มีตัวเลือกของสีนั้น (กรณี Blair Wide 4 พ.ย. 2026)
-- นับเฉพาะข้อมูลจริงตั้งแต่ 9 ต.ค. 2026 (ก่อนหน้านั้นเป็นข้อมูลทดสอบ)
alter table public.stock_check_log add column if not exists integrity jsonb not null default '[]'::jsonb;

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
$$;

revoke all on function public.integrity_issues() from public, anon, authenticated;
grant execute on function public.integrity_issues() to service_role;

create or replace function public.run_stock_check()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  n integer;
  d jsonb;
  g jsonb;
begin
  select count(*), coalesce(jsonb_agg(jsonb_build_object('type', r.item_type, 'sku', r.sku, 'expected', r.expected, 'actual', r.actual, 'diff', r.diff) order by abs(r.diff) desc), '[]'::jsonb)
    into n, d
    from stock_reconciliation() r;
  select coalesce(jsonb_agg(jsonb_build_object('kind', i.kind, 'ref', i.ref, 'at', i.at) order by i.kind, i.ref), '[]'::jsonb)
    into g
    from integrity_issues() i;
  insert into stock_check_log (mismatches, detail, integrity) values (n, d, g);
  delete from stock_check_log where checked_at < now() - interval '60 days';
  return n;
end;
$$;

revoke all on function public.run_stock_check() from public, anon, authenticated;
grant execute on function public.run_stock_check() to service_role;
