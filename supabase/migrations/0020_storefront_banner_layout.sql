-- Per-banner layout controls for the storefront hero and promo banners so the
-- owner can tune them from Settings instead of editing code:
--   *_mobile_image_url  separate portrait image for phones ('' = reuse desktop)
--   *_focus_x/_focus_y  focal point in % (object-position) used when cropping
--   *_text_align        'left' | 'center' | 'right'
--   *_show_text         false hides the website's own heading/tagline/button
--                       text when the uploaded picture already carries text
--   *_overlay           'none' | 'soft' | 'medium' darkening behind the copy

alter table storefront_settings
  add column hero_mobile_image_url  text    not null default '',
  add column hero_focus_x           integer not null default 50,
  add column hero_focus_y           integer not null default 50,
  add column hero_text_align        text    not null default 'left',
  add column hero_show_text         boolean not null default true,
  add column hero_overlay           text    not null default 'soft',
  add column promo_mobile_image_url text    not null default '',
  add column promo_focus_x          integer not null default 50,
  add column promo_focus_y          integer not null default 50,
  add column promo_text_align       text    not null default 'left',
  add column promo_show_text        boolean not null default true,
  add column promo_overlay          text    not null default 'soft';

drop view storefront_settings_public;

create view storefront_settings_public as
select
  announcement_text, hero_heading_line1, hero_heading_line2, hero_tagline,
  promo_heading_line1, promo_heading_line2, promo_subtext,
  contact_phone, social_line, social_facebook, social_instagram, social_tiktok,
  social_shopee, social_lazada, social_line_shopping, social_youtube,
  hero_image_url, promo_image_url,
  hero_mobile_image_url, hero_focus_x, hero_focus_y, hero_text_align, hero_show_text, hero_overlay,
  promo_mobile_image_url, promo_focus_x, promo_focus_y, promo_text_align, promo_show_text, promo_overlay
from storefront_settings
where id = 'default';

grant select on storefront_settings_public to anon, authenticated;
