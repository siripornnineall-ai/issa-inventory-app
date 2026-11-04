-- แก้บั๊กใน 0035: ตัวคำนวณสต็อก "ตั้งเป็น 0 ถ้าจะติดลบ" ทำให้ยอดเกินจริงเมื่อรายการมาถึงไม่เรียงลำดับ
-- เกิดตอนขายรุ่นที่เย็บตามออเดอร์ (เช่น Bobbie Mid): แอปส่งรายการ "แปลงรุ่นเข้า" (+1) กับ "ขาย" (-1) ใต้ใบเดียวกัน
-- ถ้ารายการขายถึงก่อน ยอดตอนนั้น 0 จึงถูกตั้งเป็น 0 แล้วรายการแปลงรุ่นบวก 1 ตามมา ได้ยอดเกิน 1 ชิ้นทุกครั้ง (พบ 11 ครั้งช่วง 2-4 พ.ย. 2026)
-- ใหม่: บวก/ลบตามจริงโดยไม่ตั้งเพดาน ลำดับที่มาถึงจึงไม่มีผลต่อยอดสุดท้าย (ผลรวมเท่าเดิมเสมอ)
--       ยอดติดลบถูกยอมให้เกิดได้ (เช่น สองเครื่องขายชิ้นสุดท้ายพร้อมกัน) และการตรวจประจำคืนจะรายงานยอดติดลบเป็นรายการเตือน
alter table public.variant_stock drop constraint if exists variant_stock_qty_on_hand_check;
alter table public.variant_stock drop constraint if exists variant_stock_check;
alter table public.variant_stock add constraint variant_stock_qty_reserved_check check (qty_reserved >= 0);
alter table public.equipment_stock drop constraint if exists equipment_stock_qty_on_hand_check;

create or replace function public.apply_stock_movement()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  wh uuid := coalesce(new.warehouse_to_id, new.warehouse_from_id);
  cur integer;
  after_qty integer;
begin
  if wh is null then
    return new;
  end if;

  if new.item_type = 'product' and new.variant_id is not null then
    insert into variant_stock (variant_id, warehouse_id, qty_on_hand)
    values (new.variant_id, wh, 0)
    on conflict (variant_id, warehouse_id) do nothing;

    select qty_on_hand into cur from variant_stock where variant_id = new.variant_id and warehouse_id = wh for update;
    after_qty := cur + new.qty_change;
    update variant_stock set qty_on_hand = after_qty where variant_id = new.variant_id and warehouse_id = wh;
    new.qty_before := cur;
    new.qty_after := after_qty;

  elsif new.item_type = 'equipment' then
    insert into equipment_stock (equipment_id, warehouse_id, qty_on_hand)
    values (new.item_id, wh, 0)
    on conflict (equipment_id, warehouse_id) do nothing;

    select qty_on_hand into cur from equipment_stock where equipment_id = new.item_id and warehouse_id = wh for update;
    after_qty := cur + new.qty_change;
    update equipment_stock set qty_on_hand = after_qty where equipment_id = new.item_id and warehouse_id = wh;
    new.qty_before := cur;
    new.qty_after := after_qty;
  end if;

  return new;
end;
$$;

revoke all on function public.apply_stock_movement() from public, anon, authenticated;

-- ตรวจสต็อกกับประวัติ: รายงานทั้งยอดที่ไม่เท่าผลรวมรายการเคลื่อนไหว และยอดที่ติดลบ
create or replace function public.stock_reconciliation()
returns table (item_type text, item_id uuid, sku text, warehouse_id uuid, expected integer, actual integer, diff integer)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with mv as (
    select m.variant_id as id, coalesce(m.warehouse_to_id, m.warehouse_from_id) as wh, sum(m.qty_change)::integer as s
      from stock_movements m
     where m.item_type = 'product' and m.variant_id is not null
     group by 1, 2
  ), p as (
    select coalesce(mv.id, vs.variant_id) as id, coalesce(mv.wh, vs.warehouse_id) as wh,
           coalesce(mv.s, 0) as expected, coalesce(vs.qty_on_hand, 0) as actual
      from mv full join variant_stock vs on vs.variant_id = mv.id and vs.warehouse_id = mv.wh
  ), em as (
    select m.item_id as id, coalesce(m.warehouse_to_id, m.warehouse_from_id) as wh, sum(m.qty_change)::integer as s
      from stock_movements m
     where m.item_type = 'equipment'
     group by 1, 2
  ), e as (
    select coalesce(em.id, es.equipment_id) as id, coalesce(em.wh, es.warehouse_id) as wh,
           coalesce(em.s, 0) as expected, coalesce(es.qty_on_hand, 0) as actual
      from em full join equipment_stock es on es.equipment_id = em.id and es.warehouse_id = em.wh
  )
  select 'product'::text, p.id, v.sku, p.wh, p.expected, p.actual, p.actual - p.expected
    from p join product_variants v on v.id = p.id
   where p.expected <> p.actual or p.actual < 0
  union all
  select 'equipment'::text, e.id, q.code, e.wh, e.expected, e.actual, e.actual - e.expected
    from e join equipment q on q.id = e.id
   where e.expected <> e.actual or e.actual < 0
$$;
