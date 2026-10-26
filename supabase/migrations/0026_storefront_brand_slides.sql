-- Per-brand image slider on the storefront home page: a carousel of
-- pictures (auto-advancing, with arrows and dots) placed in the middle of
-- that brand's "Shop the Feed" clips. Managed from the inventory app's
-- Settings page (settings.write). Each slide may link somewhere.

create table storefront_brand_slides (
  id               uuid primary key default gen_random_uuid(),
  brand_id         uuid not null references brands(id) on delete cascade,
  image_url        text not null,
  mobile_image_url text not null default '',
  link_url         text not null default '',
  sort_order       int  not null default 0,
  active           boolean not null default true,
  created_at       timestamptz not null default now()
);

alter table storefront_brand_slides enable row level security;

create policy storefront_brand_slides_select on storefront_brand_slides
  for select using (auth_is_active());
create policy storefront_brand_slides_write on storefront_brand_slides
  for all using (public.has_perm('settings.write')) with check (public.has_perm('settings.write'));

create view storefront_brand_slides_public as
select s.id, b.name as brand_name, s.image_url, s.mobile_image_url, s.link_url, s.sort_order
from storefront_brand_slides s
join brands b on b.id = s.brand_id
where s.active
order by b.name, s.sort_order, s.created_at;

grant select on storefront_brand_slides_public to anon, authenticated;
