-- เข้าสู่ระบบด้วย PIN 6 หลัก (ช่องทางเสริม ไม่แทนอีเมล+รหัสผ่าน)
-- เป็นตารางใหม่ล้วน ไม่แตะข้อมูลเดิม ตารางสองตัวนี้เปิด RLS และไม่มีนโยบายสำหรับผู้ใช้ทั่วไปเลย
-- อ่าน/เขียนได้เฉพาะ Edge Function pin-auth (service role) เพื่อไม่ให้ใครดึง hash ของ PIN ผ่าน API ได้

create table if not exists public.user_pins (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  pin_hash text not null,
  failed_count integer not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

comment on table public.user_pins is
  'PIN เข้าสู่ระบบของผู้ใช้ (เก็บเป็น hash แบบ PBKDF2 พร้อม salt) ตรวจเฉพาะใน Edge Function pin-auth ผิดครบกำหนดจะล็อกชั่วคราวด้วย locked_until';

alter table public.user_pins enable row level security;

-- บันทึกการลอง PIN ที่ผิดต่อที่อยู่ IP ใช้จำกัดการไล่เดาข้ามหลายบัญชี
create table if not exists public.pin_attempts (
  id bigint generated always as identity primary key,
  ip text not null,
  created_at timestamptz not null default now()
);

create index if not exists pin_attempts_ip_created_idx on public.pin_attempts (ip, created_at desc);

alter table public.pin_attempts enable row level security;

-- ผู้ใช้ที่เข้าสู่ระบบแล้วถามได้ว่าตัวเองตั้ง PIN ไว้หรือยัง (ไม่เห็น hash)
create or replace function public.has_pin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.user_pins where user_id = auth.uid());
$$;

revoke all on function public.has_pin() from public, anon;
grant execute on function public.has_pin() to authenticated;
