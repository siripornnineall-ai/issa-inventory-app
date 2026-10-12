-- สิทธิ์รายบุคคล: profiles.permissions
--   null  = ใช้สิทธิ์ตามตำแหน่ง (role_permissions) เหมือนเดิม
--   array = ผู้ดูแลระบบกำหนดสิทธิ์ของคนนี้เอง ใช้รายการนี้แทนสิทธิ์ตามตำแหน่งทั้งชุด
-- ผู้ดูแลระบบมีสิทธิ์ทุกอย่างเสมอ และสิทธิ์ที่ให้ได้เฉพาะผู้ดูแลระบบ (user.manage, user.admin, settings.write) ยังตามตำแหน่งเท่านั้น
alter table public.profiles add column if not exists permissions text[];

create or replace function public.has_perm(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select case
        when pr.role = 'admin' then true
        when pr.permissions is not null and p <> all (array['user.manage','user.admin','settings.write']) then p = any (pr.permissions)
        else exists (select 1 from public.role_permissions rp where rp.role = pr.role and rp.permission = p)
      end
     from public.profiles pr where pr.id = auth.uid()),
    false);
$$;

create or replace function public.has_any_perm(p text[]) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select case
        when pr.role = 'admin' then true
        when pr.permissions is not null then exists (select 1 from unnest(p) x where x = any (pr.permissions))
        else exists (select 1 from public.role_permissions rp where rp.role = pr.role and rp.permission = any (p))
      end
     from public.profiles pr where pr.id = auth.uid()),
    false);
$$;
