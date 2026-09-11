-- ISSA Apparel Inventory Manager — Initial schema
-- ใช้เงินบาท เก็บราคาเป็น numeric(12,2) เพื่อความแม่นยำของทศนิยม (ไม่ใช้ float)
-- Timezone ของแอปคือ Asia/Bangkok (จัดการที่ชั้น UI, ฐานข้อมูลเก็บเป็น timestamptz เสมอ)

create extension if not exists "pgcrypto";

-- =========================================================
-- 1. ผู้ใช้งานและสิทธิ์
-- =========================================================
create type user_role as enum ('admin', 'manager', 'warehouse', 'sales', 'viewer');

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  email text not null,
  role user_role not null default 'viewer',
  active boolean not null default true,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- helper: อ่าน role ของผู้ใช้ปัจจุบันโดยไม่วน RLS ซ้ำ
create function auth_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid();
$$;

create function auth_is_active() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select active from profiles where id = auth.uid()), false);
$$;

-- =========================================================
-- 2. คลัง/สถานที่จัดเก็บ
-- =========================================================
create type warehouse_type as enum ('main', 'office', 'store', 'other');

create table warehouses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type warehouse_type not null default 'main',
  address text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- =========================================================
-- 3. ร้านค้า/ซัพพลายเออร์
-- =========================================================
create type supplier_category as enum ('fabric_mill', 'garment_factory', 'trim_accessory', 'packaging', 'other');

create table suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category supplier_category not null default 'other',
  contact_name text,
  phone text,
  line text,
  email text,
  address text,
  tax_id text,
  payment_terms text,
  lead_time_days int,
  note text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- =========================================================
-- 4. สินค้าและตัวเลือก (variant)
-- =========================================================
create type product_status as enum ('active', 'inactive', 'discontinued');

create table products (
  id uuid primary key default gen_random_uuid(),
  source_supplier_id uuid references suppliers (id) on delete set null,
  source_model_name text,
  source_purchase_price numeric(12, 2),
  source_description text,
  source_code text,
  first_received_date date,
  source_note text,
  selling_name text not null,
  selling_price numeric(12, 2) not null default 0,
  selling_description text,
  category text not null default 'อื่น ๆ',
  status product_status not null default 'active',
  sell_start_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products (id) on delete cascade,
  url text not null,
  is_main boolean not null default false,
  sort_order int not null default 0,
  kind text not null check (kind in ('source', 'selling'))
);

create table product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products (id) on delete cascade,
  color text not null,
  size text not null,
  sku text not null unique,
  purchase_price numeric(12, 2) not null default 0,
  selling_price numeric(12, 2) not null default 0,
  reorder_point int not null default 0,
  storage_location text,
  active boolean not null default true,
  unique (product_id, color, size)
);

create table variant_stock (
  variant_id uuid not null references product_variants (id) on delete cascade,
  warehouse_id uuid not null references warehouses (id) on delete cascade,
  qty_on_hand int not null default 0 check (qty_on_hand >= 0),
  qty_reserved int not null default 0 check (qty_reserved >= 0 and qty_reserved <= qty_on_hand),
  primary key (variant_id, warehouse_id)
);

-- =========================================================
-- 5. อุปกรณ์ (แยกจากสินค้าเด็ดขาด)
-- =========================================================
create type equipment_type as enum
  ('packaging', 'hangtag', 'hanger', 'sticker', 'button_zipper', 'repair', 'office', 'other');
create type equipment_unit as enum
  ('ชิ้น', 'ใบ', 'ตัว', 'ม้วน', 'กล่อง', 'แพ็ก', 'คู่', 'ชุด', 'เมตร', 'กิโลกรัม');

create table equipment (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  type equipment_type not null default 'other',
  description text,
  supplier_id uuid references suppliers (id) on delete set null,
  purchase_price_per_unit numeric(12, 2) not null default 0,
  unit equipment_unit not null default 'ชิ้น',
  reorder_point int not null default 0,
  reorder_qty int not null default 0,
  storage_location text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table equipment_images (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references equipment (id) on delete cascade,
  url text not null,
  is_main boolean not null default false,
  sort_order int not null default 0
);

create table equipment_stock (
  equipment_id uuid not null references equipment (id) on delete cascade,
  warehouse_id uuid not null references warehouses (id) on delete cascade,
  qty_on_hand int not null default 0 check (qty_on_hand >= 0),
  primary key (equipment_id, warehouse_id)
);

-- =========================================================
-- 6. ประวัติการเคลื่อนไหว (audit log, ห้ามแก้/ลบโดยพนักงานทั่วไป)
-- =========================================================
create type movement_item_type as enum ('product', 'equipment');
create type movement_type as enum (
  'stock_in', 'sale', 'transfer_out', 'transfer_in', 'damaged', 'lost', 'photoshoot',
  'internal_use', 'return_to_source', 'adjustment', 'size_change', 'color_change',
  'send_to_store', 'cancel_restock', 'other'
);

create table stock_movements (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  ref_no text not null,
  item_type movement_item_type not null,
  item_id uuid not null,
  variant_id uuid,
  item_name text not null,
  sku text not null,
  color text,
  size text,
  movement_type movement_type not null,
  qty_change int not null,
  qty_before int not null,
  qty_after int not null,
  warehouse_from_id uuid references warehouses (id),
  warehouse_to_id uuid references warehouses (id),
  actor_id uuid references profiles (id),
  actor_name text not null,
  reason text,
  note text,
  related_doc_no text,
  edited_note text
);

-- ป้องกันการแก้ไข/ลบ ยกเว้นการเติม edited_note โดยผู้ดูแลระบบ
create function protect_stock_movements() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'ห้ามลบประวัติการเคลื่อนไหว';
  end if;
  if tg_op = 'UPDATE' then
    if auth_role() <> 'admin' then
      raise exception 'เฉพาะผู้ดูแลระบบเท่านั้นที่แก้ไขหมายเหตุประวัติได้';
    end if;
    if new.* is distinct from old.* and
       (new.ref_no, new.item_type, new.item_id, new.variant_id, new.item_name, new.sku,
        new.color, new.size, new.movement_type, new.qty_change, new.qty_before, new.qty_after,
        new.warehouse_from_id, new.warehouse_to_id, new.actor_id, new.actor_name, new.reason,
        new.note, new.related_doc_no)
       is distinct from
       (old.ref_no, old.item_type, old.item_id, old.variant_id, old.item_name, old.sku,
        old.color, old.size, old.movement_type, old.qty_change, old.qty_before, old.qty_after,
        old.warehouse_from_id, old.warehouse_to_id, old.actor_id, old.actor_name, old.reason,
        old.note, old.related_doc_no)
    then
      raise exception 'แก้ไขได้เฉพาะหมายเหตุแก้ไข (edited_note) เท่านั้น';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_protect_stock_movements
  before update or delete on stock_movements
  for each row execute function protect_stock_movements();

-- =========================================================
-- 7. เอกสารรับเข้า / เบิกออก / โอนย้าย
-- =========================================================
create table stock_in_docs (
  id uuid primary key default gen_random_uuid(),
  doc_no text not null unique,
  date date not null,
  item_type movement_item_type not null,
  supplier_id uuid references suppliers (id),
  po_number text,
  bill_number text,
  receipt_images text[] not null default '{}',
  warehouse_id uuid not null references warehouses (id),
  received_by uuid references profiles (id),
  note text,
  status text not null default 'confirmed' check (status in ('draft', 'confirmed')),
  created_at timestamptz not null default now()
);

create table stock_in_lines (
  id uuid primary key default gen_random_uuid(),
  doc_id uuid not null references stock_in_docs (id) on delete cascade,
  item_id uuid not null,
  variant_id uuid,
  qty int not null check (qty > 0),
  unit_cost numeric(12, 2)
);

create table stock_out_docs (
  id uuid primary key default gen_random_uuid(),
  doc_no text not null unique,
  date date not null,
  item_type movement_item_type not null,
  reason_type movement_type not null,
  warehouse_id uuid not null references warehouses (id),
  actor_id uuid references profiles (id),
  note text,
  status text not null default 'confirmed' check (status in ('draft', 'confirmed')),
  created_at timestamptz not null default now()
);

create table stock_out_lines (
  id uuid primary key default gen_random_uuid(),
  doc_id uuid not null references stock_out_docs (id) on delete cascade,
  item_id uuid not null,
  variant_id uuid,
  qty int not null check (qty > 0)
);

create type transfer_status as enum ('pending', 'shipping', 'received', 'cancelled');

create table transfers (
  id uuid primary key default gen_random_uuid(),
  transfer_no text not null unique,
  item_type movement_item_type not null,
  date date not null,
  from_warehouse_id uuid not null references warehouses (id),
  to_warehouse_id uuid not null references warehouses (id),
  sender_id uuid references profiles (id),
  receiver_id uuid references profiles (id),
  note text,
  status transfer_status not null default 'pending',
  created_at timestamptz not null default now(),
  received_at timestamptz,
  cancelled_at timestamptz,
  check (from_warehouse_id <> to_warehouse_id)
);

create table transfer_lines (
  id uuid primary key default gen_random_uuid(),
  transfer_id uuid not null references transfers (id) on delete cascade,
  item_id uuid not null,
  variant_id uuid,
  qty int not null check (qty > 0)
);

-- =========================================================
-- 8. คำสั่งขาย / ยอดยกเลิก
-- =========================================================
create type sales_channel as enum
  ('shopee', 'lazada', 'tiktok', 'facebook', 'instagram', 'store', 'website', 'other');
create type order_status as enum
  ('pending_payment', 'paid', 'preparing', 'shipped', 'completed', 'cancelled', 'returned');

create table orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique,
  date date not null,
  channel sales_channel not null default 'other',
  warehouse_id uuid not null references warehouses (id),
  status order_status not null default 'pending_payment',
  note text,
  cancel_reason text,
  cancelled_at timestamptz,
  restocked boolean not null default false,
  created_at timestamptz not null default now()
);

create table order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  product_id uuid not null references products (id),
  variant_id uuid not null references product_variants (id),
  qty int not null check (qty > 0),
  unit_price numeric(12, 2) not null,
  discount numeric(12, 2) not null default 0
);

-- =========================================================
-- Row Level Security
-- =========================================================
alter table profiles enable row level security;
alter table warehouses enable row level security;
alter table suppliers enable row level security;
alter table products enable row level security;
alter table product_images enable row level security;
alter table product_variants enable row level security;
alter table variant_stock enable row level security;
alter table equipment enable row level security;
alter table equipment_images enable row level security;
alter table equipment_stock enable row level security;
alter table stock_movements enable row level security;
alter table stock_in_docs enable row level security;
alter table stock_in_lines enable row level security;
alter table stock_out_docs enable row level security;
alter table stock_out_lines enable row level security;
alter table transfers enable row level security;
alter table transfer_lines enable row level security;
alter table orders enable row level security;
alter table order_lines enable row level security;

-- profiles: ทุกคนที่ login แล้วอ่านได้ (ต้องใช้แสดงชื่อผู้ทำรายการ), แก้ไขได้เฉพาะ admin หรือเจ้าของแถว (ยกเว้น role)
create policy profiles_select on profiles for select using (auth_is_active());
create policy profiles_admin_write on profiles for all using (auth_role() = 'admin') with check (auth_role() = 'admin');

-- ข้อมูลอ้างอิงทั่วไป: อ่านได้ทุก role ที่ active, เขียนได้ admin/manager/warehouse ตามความรับผิดชอบ
create policy warehouses_select on warehouses for select using (auth_is_active());
create policy warehouses_write on warehouses for all
  using (auth_role() in ('admin', 'manager')) with check (auth_role() in ('admin', 'manager'));

create policy suppliers_select on suppliers for select using (auth_is_active());
create policy suppliers_write on suppliers for all
  using (auth_role() in ('admin', 'manager')) with check (auth_role() in ('admin', 'manager'));

create policy products_select on products for select using (auth_is_active());
create policy products_write on products for all
  using (auth_role() in ('admin', 'manager', 'warehouse')) with check (auth_role() in ('admin', 'manager', 'warehouse'));

create policy product_images_select on product_images for select using (auth_is_active());
create policy product_images_write on product_images for all
  using (auth_role() in ('admin', 'manager', 'warehouse')) with check (auth_role() in ('admin', 'manager', 'warehouse'));

create policy product_variants_select on product_variants for select using (auth_is_active());
create policy product_variants_write on product_variants for all
  using (auth_role() in ('admin', 'manager', 'warehouse')) with check (auth_role() in ('admin', 'manager', 'warehouse'));

create policy variant_stock_select on variant_stock for select using (auth_is_active());
create policy variant_stock_write on variant_stock for all
  using (auth_role() in ('admin', 'manager', 'warehouse', 'sales')) with check (auth_role() in ('admin', 'manager', 'warehouse', 'sales'));

create policy equipment_select on equipment for select using (auth_is_active());
create policy equipment_write on equipment for all
  using (auth_role() in ('admin', 'manager', 'warehouse')) with check (auth_role() in ('admin', 'manager', 'warehouse'));

create policy equipment_images_select on equipment_images for select using (auth_is_active());
create policy equipment_images_write on equipment_images for all
  using (auth_role() in ('admin', 'manager', 'warehouse')) with check (auth_role() in ('admin', 'manager', 'warehouse'));

create policy equipment_stock_select on equipment_stock for select using (auth_is_active());
create policy equipment_stock_write on equipment_stock for all
  using (auth_role() in ('admin', 'manager', 'warehouse')) with check (auth_role() in ('admin', 'manager', 'warehouse'));

-- ประวัติการเคลื่อนไหว: อ่านได้ทุกคน, insert ได้ทุก role ปฏิบัติการ, update/delete ถูกบล็อกด้วย trigger ด้านบนอยู่แล้ว
create policy stock_movements_select on stock_movements for select using (auth_is_active());
create policy stock_movements_insert on stock_movements for insert
  with check (auth_role() in ('admin', 'manager', 'warehouse', 'sales'));
create policy stock_movements_update on stock_movements for update
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

create policy stock_in_docs_select on stock_in_docs for select using (auth_is_active());
create policy stock_in_docs_write on stock_in_docs for all
  using (auth_role() in ('admin', 'manager', 'warehouse')) with check (auth_role() in ('admin', 'manager', 'warehouse'));
create policy stock_in_lines_select on stock_in_lines for select using (auth_is_active());
create policy stock_in_lines_write on stock_in_lines for all
  using (auth_role() in ('admin', 'manager', 'warehouse')) with check (auth_role() in ('admin', 'manager', 'warehouse'));

create policy stock_out_docs_select on stock_out_docs for select using (auth_is_active());
create policy stock_out_docs_write on stock_out_docs for all
  using (auth_role() in ('admin', 'manager', 'warehouse', 'sales')) with check (auth_role() in ('admin', 'manager', 'warehouse', 'sales'));
create policy stock_out_lines_select on stock_out_lines for select using (auth_is_active());
create policy stock_out_lines_write on stock_out_lines for all
  using (auth_role() in ('admin', 'manager', 'warehouse', 'sales')) with check (auth_role() in ('admin', 'manager', 'warehouse', 'sales'));

create policy transfers_select on transfers for select using (auth_is_active());
create policy transfers_write on transfers for all
  using (auth_role() in ('admin', 'manager', 'warehouse')) with check (auth_role() in ('admin', 'manager', 'warehouse'));
create policy transfer_lines_select on transfer_lines for select using (auth_is_active());
create policy transfer_lines_write on transfer_lines for all
  using (auth_role() in ('admin', 'manager', 'warehouse')) with check (auth_role() in ('admin', 'manager', 'warehouse'));

-- คำสั่งขาย: พนักงานขายบันทึกได้ แต่ยกเลิก/ปรับยอดสต็อกโดยตรงต้อง admin/manager/warehouse
create policy orders_select on orders for select using (auth_is_active());
create policy orders_insert on orders for insert
  with check (auth_role() in ('admin', 'manager', 'sales'));
create policy orders_update on orders for update
  using (auth_role() in ('admin', 'manager', 'sales')) with check (auth_role() in ('admin', 'manager', 'sales'));
create policy order_lines_select on order_lines for select using (auth_is_active());
create policy order_lines_write on order_lines for all
  using (auth_role() in ('admin', 'manager', 'sales')) with check (auth_role() in ('admin', 'manager', 'sales'));

-- =========================================================
-- Seed: คลังเริ่มต้น
-- =========================================================
insert into warehouses (name, type, address, active) values
  ('คลังหลัก', 'main', 'กรุงเทพมหานคร', true),
  ('สำนักงาน', 'office', 'กรุงเทพมหานคร', true),
  ('หน้าร้าน SOS Flagship', 'store', 'กรุงเทพมหานคร', true),
  ('หน้าร้าน SOS Mega', 'store', 'กรุงเทพมหานคร', true);
