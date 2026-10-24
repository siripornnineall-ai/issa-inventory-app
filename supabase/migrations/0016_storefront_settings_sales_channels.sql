-- More sales channels for the storefront's Contact page + footer.
-- The owner sells on Shopee, Lazada and LINE Shopping as well as the
-- social channels already stored; YouTube added for video content.
-- Empty string = channel not used; the storefront hides empty links.

alter table storefront_settings
  add column social_shopee        text not null default '',
  add column social_lazada        text not null default '',
  add column social_line_shopping text not null default '',
  add column social_youtube       text not null default '';

drop view storefront_settings_public;

create view storefront_settings_public as
select
  announcement_text, hero_heading_line1, hero_heading_line2, hero_tagline,
  promo_heading_line1, promo_heading_line2, promo_subtext,
  contact_phone, social_line, social_facebook, social_instagram, social_tiktok,
  social_shopee, social_lazada, social_line_shopping, social_youtube,
  hero_image_url, promo_image_url
from storefront_settings
where id = 'default';

grant select on storefront_settings_public to anon, authenticated;
