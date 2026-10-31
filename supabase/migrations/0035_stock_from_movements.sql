-- ยอดสต็อก (variant_stock / equipment_stock) ให้ฐานข้อมูลคิดเอง จากรายการเคลื่อนไหวที่บันทึกเข้ามา
-- เดิมแอปส่ง "ยอดทั้งก้อน" ขึ้นมาเขียนทับ เครื่องที่ข้อมูลเก่าค้างหรือส่งช้า/ส่งซ้ำจึงทับยอดที่คนอื่นเพิ่งทำได้ (ยอดไม่ตรงประวัติ)
-- ใหม่: ทุกครั้งที่มีรายการเคลื่อนไหวเข้าตาราง ฐานข้อมูลบวก/ลบยอดให้เองในคำสั่งเดียวกัน (สำเร็จหรือล้มพร้อมกัน)
--   - รายการเดียวกันส่งซ้ำ: ชนคีย์ id ซ้ำแล้วทั้งคำสั่งถูกย้อนกลับ ยอดจึงไม่ถูกบวกซ้ำ
--   - ยอดไม่ติดลบ: ถ้าจะติดลบ ตั้งเป็น 0 และรายการยังบันทึกตามจริง (ความต่างไปโผล่ในการตรวจสต็อกกับประวัติ ไม่ใช่บันทึกไม่ได้)
--   - qty_before / qty_after ของรายการ = ยอดจริงในฐานข้อมูล ณ ตอนบันทึก (ไม่ใช่ยอดในเครื่องที่อาจเก่า)

-- ---------- 1) บวก/ลบยอดตามรายการเคลื่อนไหว ----------
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
    after_qty := greatest(0, cur + new.qty_change);
    update variant_stock
       set qty_on_hand = after_qty, qty_reserved = least(qty_reserved, after_qty)
     where variant_id = new.variant_id and warehouse_id = wh;
    new.qty_before := cur;
    new.qty_after := after_qty;

  elsif new.item_type = 'equipment' then
    insert into equipment_stock (equipment_id, warehouse_id, qty_on_hand)
    values (new.item_id, wh, 0)
    on conflict (equipment_id, warehouse_id) do nothing;

    select qty_on_hand into cur from equipment_stock where equipment_id = new.item_id and warehouse_id = wh for update;
    after_qty := greatest(0, cur + new.qty_change);
    update equipment_stock set qty_on_hand = after_qty where equipment_id = new.item_id and warehouse_id = wh;
    new.qty_before := cur;
    new.qty_after := after_qty;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_apply_stock_movement on public.stock_movements;
create trigger trg_apply_stock_movement
  before insert on public.stock_movements
  for each row execute function public.apply_stock_movement();

-- ---------- 2) กันแอป (รวมเครื่องที่ยังเปิดเวอร์ชันเก่า) ไม่ให้เขียนยอดคงเหลือตรง ๆ ----------
-- แอปเก่ายังส่ง qty_on_hand ทั้งก้อนมา: ไม่ให้ error (ไม่งั้นแถบแดงเด้งทั้งที่ข้อมูลเข้าแล้ว) แต่ไม่เอายอดนั้น
-- ใช้ได้เฉพาะ authenticated/anon (ผู้ใช้แอป) ส่วน service_role และงานของผู้ดูแลฐานข้อมูลยังแก้ยอดตรง ๆ ได้
create or replace function public.guard_stock_qty()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.qty_on_hand := 0;
    if tg_table_name = 'variant_stock' then
      new.qty_reserved := 0;
    end if;
  else
    new.qty_on_hand := old.qty_on_hand;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_variant_stock on public.variant_stock;
create trigger trg_guard_variant_stock
  before insert or update on public.variant_stock
  for each row execute function public.guard_stock_qty();

drop trigger if exists trg_guard_equipment_stock on public.equipment_stock;
create trigger trg_guard_equipment_stock
  before insert or update on public.equipment_stock
  for each row execute function public.guard_stock_qty();

-- ---------- 3) ตรวจสต็อกกับประวัติ ----------
-- ยอดที่ควรเป็น = ผลรวม qty_change ของรายการเคลื่อนไหวในคลังนั้น (คลัง = ปลายทาง ถ้าไม่มีใช้ต้นทาง)
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
   where p.expected <> p.actual
  union all
  select 'equipment'::text, e.id, q.code, e.wh, e.expected, e.actual, e.actual - e.expected
    from e join equipment q on q.id = e.id
   where e.expected <> e.actual
$$;

revoke all on function public.stock_reconciliation() from public, anon, authenticated;
grant execute on function public.stock_reconciliation() to service_role;

create table if not exists public.stock_check_log (
  id bigserial primary key,
  checked_at timestamptz not null default now(),
  mismatches integer not null,
  detail jsonb not null default '[]'::jsonb
);
alter table public.stock_check_log enable row level security;
drop policy if exists stock_check_log_select on public.stock_check_log;
create policy stock_check_log_select on public.stock_check_log for select using (auth_role() = 'admin'::user_role);

create or replace function public.run_stock_check()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  n integer;
  d jsonb;
begin
  select count(*), coalesce(jsonb_agg(jsonb_build_object('type', r.item_type, 'sku', r.sku, 'expected', r.expected, 'actual', r.actual, 'diff', r.diff) order by abs(r.diff) desc), '[]'::jsonb)
    into n, d
    from stock_reconciliation() r;
  insert into stock_check_log (mismatches, detail) values (n, d);
  delete from stock_check_log where checked_at < now() - interval '60 days';
  return n;
end;
$$;

revoke all on function public.run_stock_check() from public, anon, authenticated;
grant execute on function public.run_stock_check() to service_role;

-- ทุกวัน 03:10 เวลาไทย (หลังสำรองข้อมูล 03:00)
select cron.schedule('daily-stock-check', '10 20 * * *', 'select public.run_stock_check();')
 where not exists (select 1 from cron.job where jobname = 'daily-stock-check');

-- ฟังก์ชัน trigger ไม่ต้องให้ผู้ใช้แอปเรียกตรง ๆ (trigger ยังทำงานตามปกติ)
revoke all on function public.apply_stock_movement() from public, anon, authenticated;
revoke all on function public.guard_stock_qty() from public, anon, authenticated;
