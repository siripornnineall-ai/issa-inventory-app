-- storefront_feed_items write access must follow has_perm() like every other
-- table (see 0012/0015), not role names. settings.write is the permission
-- that gates the Settings card where these videos are managed.
drop policy if exists storefront_feed_items_write on storefront_feed_items;
create policy storefront_feed_items_write on storefront_feed_items
  for all
  using (public.has_perm('settings.write'))
  with check (public.has_perm('settings.write'));
