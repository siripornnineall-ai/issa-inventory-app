-- เหตุผลที่ลูกค้าคืน / คำที่ลูกค้าพูด ที่ผู้ใช้เพิ่มเองหน้าสต็อกคืนสินค้า เก็บกลางให้ทุกเครื่องใช้ต่อได้
-- ตารางใหม่ ไม่แตะข้อมูลเดิม: เหตุผลที่เลือกเก็บใน stock_in_lines.return_reason เป็น "x:" + ข้อความ (ข้อของระบบยังใช้รหัสเดิม)
-- ใครที่ดูสินค้าได้อ่านได้ เพิ่ม/ลบได้เฉพาะผู้มีสิทธิ์ stock.in (ผู้บันทึกสินค้าคืน)
create table if not exists public.return_custom_options (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('reason', 'tag')),
  label text not null check (char_length(btrim(label)) between 1 and 40),
  created_by uuid references auth.users(id) on delete set null,
  created_by_name text,
  created_at timestamptz not null default now(),
  unique (kind, label)
);

alter table public.return_custom_options enable row level security;

drop policy if exists return_custom_options_select on public.return_custom_options;
create policy return_custom_options_select on public.return_custom_options for select
  using ((select public.auth_is_active()));

drop policy if exists return_custom_options_write on public.return_custom_options;
create policy return_custom_options_write on public.return_custom_options for all
  using ((select public.has_perm('stock.in')))
  with check ((select public.has_perm('stock.in')));
