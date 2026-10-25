-- Per-brand sections on the storefront home page. Each brand can have its
-- own full-width banner (shown above that brand's product rail — the main
-- hero stays at the top of the page), and "Shop the Feed" clips are tagged
-- with a brand so the video row sits under that brand's products.
-- Managed from the inventory app's Settings page (settings.write).

create table storefront_brand_banners (
  brand_id         uuid primary key references brands(id) on delete cascade,
  image_url        text    not null default '',
  mobile_image_url text    not null default '',
  heading_line1    text    not null default '',
  heading_line2    text    not null default '',
  tagline          text    not null default '',
  text_align       text    not null default 'left',
  show_text        boolean not null default true,
  overlay          text    not null default 'soft',
  focus_x          integer not null default 50,
  focus_y          integer not null default 50,
  updated_at       timestamptz not null default now()
);

alter table storefront_brand_banners enable row level security;

create policy storefront_brand_banners_select on storefront_brand_banners
  for select using (auth_is_active());
create policy storefront_brand_banners_write on storefront_brand_banners
  for all using (public.has_perm('settings.write')) with check (public.has_perm('settings.write'));

-- Only banners that actually have a picture; the storefront keys them by brand name.
create view storefront_brand_banners_public as
select b.name as brand_name,
       bb.image_url, bb.mobile_image_url, bb.heading_line1, bb.heading_line2, bb.tagline,
       bb.text_align, bb.show_text, bb.overlay, bb.focus_x, bb.focus_y
from storefront_brand_banners bb
join brands b on b.id = bb.brand_id
where bb.image_url <> '';

grant select on storefront_brand_banners_public to anon, authenticated;

-- Feed clips: which brand's section they belong to. Backfilled from the
-- linked product; clips with neither are shown under the first brand.
alter table storefront_feed_items
  add column brand_id uuid references brands(id) on delete set null;

update storefront_feed_items f
set brand_id = p.brand_id
from products p
where p.id = f.product_id and f.brand_id is null;

drop view storefront_feed_items_public;

create view storefront_feed_items_public as
select f.id, f.video_url, f.poster_url, f.product_id, f.caption, f.sort_order,
       f.brand_id, b.name as brand_name
from storefront_feed_items f
left join brands b on b.id = f.brand_id
where f.active
order by f.sort_order, f.created_at;

grant select on storefront_feed_items_public to anon, authenticated;
