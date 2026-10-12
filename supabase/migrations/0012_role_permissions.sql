-- สิทธิ์ตามตำแหน่งที่ผู้ดูแลระบบกำหนดเองได้ (หน้า ผู้ใช้งานและสิทธิ์ > สิทธิ์ตามตำแหน่ง)
-- เดิมสิทธิ์ของแต่ละตำแหน่งตายตัวอยู่ในโค้ด และกฎของฐานข้อมูล (RLS) อ้างชื่อตำแหน่งตรง ๆ
-- ตอนนี้เก็บเป็นตาราง role_permissions แล้วให้ RLS ถามผ่านฟังก์ชัน has_perm() จึงเปลี่ยนสิทธิ์แล้วมีผลทั้งหน้าจอและฐานข้อมูล
-- ค่าเริ่มต้นเท่ากับของเดิมทุกประการ (ยกเว้นที่ระบุไว้ท้ายไฟล์)

create table if not exists public.role_permissions (
  role public.user_role not null,
  permission text not null,
  primary key (role, permission)
);

alter table public.role_permissions enable row level security;

drop policy if exists role_permissions_select on public.role_permissions;
create policy role_permissions_select on public.role_permissions for select using (public.auth_is_active());

-- แก้ไขได้เฉพาะผู้ดูแลระบบ (ห้ามอ้างสิทธิ์ใน role_permissions เอง กันยกสิทธิ์ให้ตัวเอง)
drop policy if exists role_permissions_admin_write on public.role_permissions;
create policy role_permissions_admin_write on public.role_permissions for all
  using (public.auth_role() = 'admin') with check (public.auth_role() = 'admin');

-- ผู้ดูแลระบบมีสิทธิ์ทุกอย่างเสมอ (กันล็อกตัวเองออก) ตำแหน่งอื่นดูจากตาราง
create or replace function public.has_perm(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select r = 'admin' or exists (select 1 from public.role_permissions rp where rp.role = r and rp.permission = p)
       from (select public.auth_role() as r) x),
    false);
$$;

create or replace function public.has_any_perm(p text[]) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select r = 'admin' or exists (select 1 from public.role_permissions rp where rp.role = r and rp.permission = any (p))
       from (select public.auth_role() as r) x),
    false);
$$;

-- ค่าเริ่มต้น: เหมือนตารางสิทธิ์เดิมในโค้ด + สิทธิ์เข้าถึงหน้า (view.*) ให้ทุกตำแหน่งเหมือนเดิมที่ทุกคนเห็นทุกหน้า
insert into public.role_permissions (role, permission)
select r.role::public.user_role, p
from (values
  ('manager', array['product.write','equipment.write','master.write','stock.in','stock.out','order.create','order.cancel','stock.transfer','stock.adjust','cost.view','report.view','report.export','user.manage','requisition.approve']),
  ('warehouse', array['stock.in','stock.out','stock.transfer','stock.adjust','product.write','equipment.write','requisition.create']),
  ('sales', array['order.create','order.cancel','stock.out','requisition.create']),
  ('viewer', array['report.view','report.export']),
  ('admin', array['product.write','equipment.write','master.write','stock.in','stock.out','order.create','order.cancel','stock.transfer','stock.adjust','cost.view','report.view','report.export','user.manage','user.admin','settings.write','requisition.create','requisition.approve'])
) as r(role, perms), unnest(r.perms) as p
on conflict do nothing;

insert into public.role_permissions (role, permission)
select r, p
from unnest(enum_range(null::public.user_role)) as r,
     unnest(array['view.dashboard','view.products','view.equipment','view.orders','view.purchase_orders','view.invoices','view.history','view.suppliers','view.settings']) as p
on conflict do nothing;

-- ===== กฎของฐานข้อมูล: เปลี่ยนจากชื่อตำแหน่งเป็นสิทธิ์ =====
do $$
declare
  rec record;
begin
  -- (ตาราง, ชื่อกฎ, เงื่อนไข)
  for rec in select * from (values
    ('brands', 'brands_write', $q$public.has_perm('master.write')$q$),
    ('company_info', 'company_info_write', $q$public.has_perm('master.write')$q$),
    ('suppliers', 'suppliers_write', $q$public.has_perm('master.write')$q$),
    ('supplier_images', 'supplier_images_write', $q$public.has_perm('master.write')$q$),
    ('warehouses', 'warehouses_write', $q$public.has_perm('master.write')$q$),
    ('storefront_fit_covers', 'storefront_fit_covers_write', $q$public.has_perm('master.write')$q$),
    ('storefront_settings', 'storefront_settings_write', $q$public.has_perm('settings.write')$q$),
    ('color_codes', 'color_codes_write', $q$public.has_perm('product.write')$q$),
    ('custom_sizes', 'custom_sizes_write', $q$public.has_perm('product.write')$q$),
    ('products', 'products_write', $q$public.has_perm('product.write')$q$),
    ('product_variants', 'product_variants_write', $q$public.has_perm('product.write')$q$),
    ('product_images', 'product_images_write', $q$public.has_perm('product.write')$q$),
    ('product_shape_options', 'product_shape_options_write', $q$public.has_perm('product.write')$q$),
    ('equipment', 'equipment_write', $q$public.has_perm('equipment.write')$q$),
    ('equipment_images', 'equipment_images_write', $q$public.has_perm('equipment.write')$q$),
    ('equipment_type_options', 'equipment_type_options_write', $q$public.has_perm('equipment.write')$q$),
    ('equipment_stock', 'equipment_stock_write', $q$public.has_any_perm(array['equipment.write','stock.in','stock.out','stock.transfer','requisition.approve'])$q$),
    ('po_signatories', 'po_signatories_write', $q$public.has_perm('stock.in')$q$),
    ('stock_in_docs', 'stock_in_docs_write', $q$public.has_perm('stock.in')$q$),
    ('stock_in_lines', 'stock_in_lines_write', $q$public.has_perm('stock.in')$q$),
    ('stock_out_docs', 'stock_out_docs_write', $q$public.has_perm('stock.out')$q$),
    ('stock_out_lines', 'stock_out_lines_write', $q$public.has_perm('stock.out')$q$),
    ('transfers', 'transfers_write', $q$public.has_perm('stock.transfer')$q$),
    ('transfer_lines', 'transfer_lines_write', $q$public.has_perm('stock.transfer')$q$),
    ('order_lines', 'order_lines_write', $q$public.has_perm('order.create')$q$),
    ('variant_stock', 'variant_stock_write', $q$public.has_any_perm(array['product.write','stock.in','stock.out','stock.transfer','stock.adjust','order.create','order.cancel'])$q$)
  ) as t(tbl, pol, cond)
  loop
    execute format('drop policy if exists %I on public.%I', rec.pol, rec.tbl);
    execute format('create policy %I on public.%I for all using (%s) with check (%s)', rec.pol, rec.tbl, rec.cond, rec.cond);
  end loop;

  -- กฎเฉพาะคำสั่ง (insert / update)
  for rec in select * from (values
    ('orders', 'orders_insert', 'insert', null, $q$public.has_perm('order.create')$q$),
    ('invoices', 'invoices_insert', 'insert', null, $q$public.has_perm('order.create')$q$),
    ('stock_movements', 'stock_movements_insert', 'insert', null, $q$public.has_any_perm(array['stock.in','stock.out','stock.transfer','stock.adjust','order.create','order.cancel','requisition.approve'])$q$),
    ('unit_tokens', 'unit_tokens_insert', 'insert', null, $q$public.has_any_perm(array['stock.in','stock.out','stock.transfer','stock.adjust','order.create','order.cancel'])$q$),
    ('equipment_requisitions', 'equipment_requisitions_insert', 'insert', null, $q$public.has_perm('requisition.create')$q$),
    ('orders', 'orders_update', 'update', $q$public.has_any_perm(array['order.create','order.cancel'])$q$, $q$public.has_any_perm(array['order.create','order.cancel'])$q$),
    ('unit_tokens', 'unit_tokens_update', 'update', $q$public.has_any_perm(array['stock.in','stock.out','stock.transfer','stock.adjust','order.create','order.cancel'])$q$, $q$public.has_any_perm(array['stock.in','stock.out','stock.transfer','stock.adjust','order.create','order.cancel'])$q$),
    ('equipment_requisitions', 'equipment_requisitions_update', 'update', $q$(public.has_perm('requisition.approve') or requester_id = auth.uid())$q$, $q$(public.has_perm('requisition.approve') or requester_id = auth.uid())$q$)
  ) as t(tbl, pol, cmd, using_cond, check_cond)
  loop
    execute format('drop policy if exists %I on public.%I', rec.pol, rec.tbl);
    if rec.cmd = 'insert' then
      execute format('create policy %I on public.%I for insert with check (%s)', rec.pol, rec.tbl, rec.check_cond);
    else
      execute format('create policy %I on public.%I for update using (%s) with check (%s)', rec.pol, rec.tbl, rec.using_cond, rec.check_cond);
    end if;
  end loop;
end $$;

-- ที่ต่างจากเดิมเล็กน้อย:
--  * ฝ่ายขาย (มีสิทธิ์ "เบิกออก") เบิกอุปกรณ์ออกได้จริงในฐานข้อมูลแล้ว เดิมหน้าจออนุญาตแต่ฐานข้อมูลปฏิเสธ
--  * ผู้จัดการไม่มีสิทธิ์ "ขอเบิกอุปกรณ์" ตามตารางสิทธิ์ในแอป (เดิมฐานข้อมูลปล่อยแต่หน้าจอไม่ให้)
--  * profiles (จัดการบัญชี) และการแก้หมายเหตุประวัติสต็อก ยังเป็นผู้ดูแลระบบเท่านั้นเหมือนเดิม
