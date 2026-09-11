-- Self-service hero/promo banner images, uploaded from the Settings page
-- via a new public "storefront-assets" storage bucket. Defaults match the
-- image already hardcoded in issa-storefront's hero.tsx/promo-banner.tsx so
-- nothing changes visually until the user uploads her own.

alter table storefront_settings
  add column hero_image_url text not null default
    'https://lh3.googleusercontent.com/aida-public/AB6AXuDW5FEck25ju-fz2vAkbZvAqDrxJrbrj0gZ1rKlct-h7upvC6n7h781j_PKQjAeA_7XD81HMThgKfRyGw81bvKN4bBGoVBdc-isxzj33kam2HyrSzhDtVkt_WIFU8VrhCHC5Uvd0Za0ZHrHijS-WzP_jt3ENHg4vSgKt6ErI1z3j7KZKauFABl7E1wvO_5S9ge2Sw-UwMrpq31rLlvhbr3bVKMd6TM9UyYlHupcAQkSwOViSNsnHl0B',
  add column promo_image_url text not null default
    'https://lh3.googleusercontent.com/aida-public/AB6AXuDW5FEck25ju-fz2vAkbZvAqDrxJrbrj0gZ1rKlct-h7upvC6n7h781j_PKQjAeA_7XD81HMThgKfRyGw81bvKN4bBGoVBdc-isxzj33kam2HyrSzhDtVkt_WIFU8VrhCHC5Uvd0Za0ZHrHijS-WzP_jt3ENHg4vSgKt6ErI1z3j7KZKauFABl7E1wvO_5S9ge2Sw-UwMrpq31rLlvhbr3bVKMd6TM9UyYlHupcAQkSwOViSNsnHl0B';

drop view storefront_settings_public;

create view storefront_settings_public as
select
  announcement_text, hero_heading_line1, hero_heading_line2, hero_tagline,
  promo_heading_line1, promo_heading_line2, promo_subtext,
  contact_phone, social_line, social_facebook, social_instagram, social_tiktok,
  hero_image_url, promo_image_url
from storefront_settings
where id = 'default';

grant select on storefront_settings_public to anon, authenticated;

-- Public bucket for hero/promo/fit-cover images. Read is public (storefront
-- fetches these directly), write is admin/manager only — same roles as
-- storefront_fit_covers_write and broader than storefront_settings_write
-- (admin-only), since the UI itself gates who sees the hero/promo upload
-- widgets vs. the fit-cover ones.
insert into storage.buckets (id, name, public)
values ('storefront-assets', 'storefront-assets', true)
on conflict (id) do nothing;

create policy storefront_assets_select on storage.objects
  for select using (bucket_id = 'storefront-assets');
create policy storefront_assets_write on storage.objects
  for all using (
    bucket_id = 'storefront-assets'
    and auth_role() = any (array['admin'::user_role, 'manager'::user_role])
  );
