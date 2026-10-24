-- "Shop the Feed" on the storefront homepage: short styling videos, each
-- optionally linked to a product. Managed from the inventory app's
-- Settings page (admin/manager), same narrow pattern as storefront_fit_covers.
-- Videos live in the public "storefront-assets" bucket under feed/.

create table storefront_feed_items (
  id uuid primary key default gen_random_uuid(),
  video_url text not null,
  poster_url text not null default '',
  product_id uuid references products(id) on delete set null,
  caption text not null default '',
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table storefront_feed_items enable row level security;

create policy storefront_feed_items_select on storefront_feed_items
  for select using (auth_is_active());
create policy storefront_feed_items_write on storefront_feed_items
  for all using (auth_role() = any (array['admin'::user_role, 'manager'::user_role]));

create view storefront_feed_items_public as
select id, video_url, poster_url, product_id, caption, sort_order
from storefront_feed_items
where active
order by sort_order, created_at;

grant select on storefront_feed_items_public to anon, authenticated;
