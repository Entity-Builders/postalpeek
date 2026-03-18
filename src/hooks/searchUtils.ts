import type { FeedItem } from '../components/Postcard';
import { t } from '../utils/i18n';

/** Normalize a string for accent-insensitive, lowercase comparison */
export function normalize(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/** Extract all searchable text fields from a postcard item */
export function getSearchableFields(item: FeedItem): string[] {
  return [
    item.city,
    item.country,
    t(item.category),
    ...(item.visual_tags || []),
    ...(item.aesthetic_vibes || []),
    item.architecture_style,
    item.color_palette,
    item.scene_type,
    item.time_of_day,
    item.weather,
    item.human_activity,
    ...(item.detailed_tags || [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .flatMap((dt: any) => [dt.label?.es, dt.label?.en, dt.spanish_label])
      .filter(Boolean),
  ]
    .filter((v): v is string => typeof v === 'string' && v.length > 0)
    .map(normalize);
}

/** Match active filter chips against an item (OR logic — at least one must match) */
export function matchesActiveFilters(
  item: FeedItem,
  activeFilters: string[],
): boolean {
  if (activeFilters.length === 0) return true;

  const fields = getSearchableFields(item);
  return activeFilters.some((f) => {
    const fNorm = normalize(f);
    return fields.some((v) => v.includes(fNorm));
  });
}
