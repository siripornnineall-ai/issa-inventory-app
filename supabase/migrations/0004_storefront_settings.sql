-- Editable storefront website copy (announcement bar, hero, promo banner).
-- Single-row table (id = 'default'), same pattern as company_info. Editable
-- from the inventory app's Settings page (admin only); read publicly by
-- issa-storefront via storefront_settings_public.

create table storefront_settings (
  id text primary key default 'default',
  announcement_text text not null default 'ส่งฟรีเมื่อช้อปครบ ฿1,500 • เปลี่ยนไซซ์ง่าย',
  hero_heading_line1 text not null default 'Everyday,',
  hero_heading_line2 text not null default 'Effortlessly Better.',
  hero_tagline text not null default 'ผ้าดี • ทรงสวย • ไม่ต้องรีด',
  promo_heading_line1 text not null default 'Buy 2, Save 10%.',
  promo_heading_line2 text not null default 'Buy 3, Save 15%.',
  promo_subtext text not null default 'ส่วนลดคำนวณให้อัตโนมัติที่ตะกร้า ไม่ต้องใช้โค้ด',
  updated_at timestamptz not null default now()
);

insert into storefront_settings (id) values ('default');

alter table storefront_settings enable row level security;

create policy storefront_settings_select on storefront_settings
  for select using (auth_is_active());
create policy storefront_settings_write on storefront_settings
  for all using (auth_role() = 'admin'::user_role);

create view storefront_settings_public as
select
  announcement_text, hero_heading_line1, hero_heading_line2, hero_tagline,
  promo_heading_line1, promo_heading_line2, promo_subtext
from storefront_settings
where id = 'default';

grant select on storefront_settings_public to anon, authenticated;
