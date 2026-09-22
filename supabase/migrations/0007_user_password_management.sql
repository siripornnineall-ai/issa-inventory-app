-- จัดการรหัสผ่านผู้ใช้งาน: บังคับเปลี่ยนรหัสผ่านเมื่อเข้าระบบครั้งแรก (หรือหลังผู้ดูแลระบบตั้งรหัสผ่านให้ใหม่)
-- เป็นการเพิ่มคอลัมน์/ฟังก์ชันใหม่เท่านั้น (additive) ไม่แตะข้อมูลเดิม ผู้ใช้เดิมทุกคนได้ค่า false

alter table public.profiles
  add column if not exists must_change_password boolean not null default false;

comment on column public.profiles.must_change_password is
  'true = ผู้ใช้ต้องตั้งรหัสผ่านใหม่ก่อนใช้งานระบบ ตั้งเป็น true โดย Edge Function admin-users ตอนสร้างบัญชี/รีเซ็ตรหัสผ่าน';

-- RLS ของ profiles ให้เขียนได้เฉพาะ admin ผู้ใช้ทั่วไปจึงล้างธงของตัวเองตรง ๆ ไม่ได้
-- ฟังก์ชันนี้ (security definer) ล้างได้เฉพาะแถวของผู้เรียกเอง (auth.uid()) เท่านั้น — เรียกหลังเปลี่ยนรหัสผ่านสำเร็จ
create or replace function public.clear_must_change_password()
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles set must_change_password = false where id = auth.uid();
$$;

revoke all on function public.clear_must_change_password() from public, anon;
grant execute on function public.clear_must_change_password() to authenticated;
