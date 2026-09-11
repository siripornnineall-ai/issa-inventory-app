-- Add self-service contact/social fields to storefront_settings so the
-- storefront's Contact page + footer icons no longer come from a hardcoded
-- src/lib/site-config.ts object. Same single-row table, same admin-only
-- write policy as the rest of storefront_settings.

alter table storefront_settings
  add column contact_phone text not null default '02-xxx-xxxx',
  add column social_line text not null default 'https://line.me/ti/p/issaapparel',
  add column social_facebook text not null default 'https://facebook.com/issaapparel',
  add column social_instagram text not null default 'https://instagram.com/issaapparel',
  add column social_tiktok text not null default 'https://tiktok.com/@issaapparel';

drop view storefront_settings_public;

create view storefront_settings_public as
select
  announcement_text, hero_heading_line1, hero_heading_line2, hero_tagline,
  promo_heading_line1, promo_heading_line2, promo_subtext,
  contact_phone, social_line, social_facebook, social_instagram, social_tiktok
from storefront_settings
where id = 'default';

grant select on storefront_settings_public to anon, authenticated;
