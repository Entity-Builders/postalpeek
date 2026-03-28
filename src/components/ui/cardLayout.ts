import type { FeedItem } from '../Postcard';

export interface CardLayout {
  aspectRatio: string;
  monumental?: boolean;
}

/** Deterministic hash → 0-1 float from a string */
export function hashToFloat(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h % 1000) / 1000;
}

/** Aspect-ratio buckets for Pinterest-style height variation */
export const ASPECT_RATIOS = [
  '3/4',   // tall
  '4/5',   // medium-tall
  '1/1',   // square
  '5/4',   // slightly wide
  '2/3',   // tallest
] as const;

/** Normalize a category object/string into a searchable lowercase string */
export function normCategory(catObj: string | { en?: string; es?: string } | undefined): string {
  let category = '';
  if (typeof catObj === 'string') {
    category = catObj.toLowerCase();
  } else if (catObj) {
    category = [catObj.en, catObj.es].filter(Boolean).join(' ').toLowerCase();
  }
  return category.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Scene types that qualify a postcard as "monumental" (full-width in grid) */
export const MONUMENTAL_SCENE_TYPES = new Set([
  'historic_center', 'plaza', 'monument', 'landmark',
  'cathedral', 'church', 'palace', 'temple', 'castle',
]);

/** Category keywords that qualify a postcard as "monumental" */
export const MONUMENTAL_KEYWORDS = [
  'monument', 'landmark', 'architecture', 'arquitectura',
  'historical', 'historico', 'iglesia', 'church',
  'cathedral', 'catedral', 'palace', 'palacio',
  'temple', 'templo', 'castle', 'castillo',
  'basilica', 'basilica', 'centro historico', 'historic center',
];

/** Returns true if this postcard should display as a full-width feature card */
export function isMonumentalCard(item: FeedItem): boolean {
  // Check scene_type
  const scene = (item.scene_type || '').toLowerCase().trim();
  if (MONUMENTAL_SCENE_TYPES.has(scene)) return true;

  // Check rarity
  if (item.rarity === 'legendary' || item.rarity === 'epic') return true;

  // Check category keywords
  const catNorm = normCategory(item.category);
  return MONUMENTAL_KEYWORDS.some((kw) => catNorm.includes(kw));
}

/** Precalculate layout for a single item (pure, no side effects) */
export function computeCardLayout(itemOrId: FeedItem | string): CardLayout {
  const isItem = typeof itemOrId !== 'string';
  const id = isItem ? itemOrId.id : itemOrId;
  const h = hashToFloat(id);
  
  let aspectRatio: string = ASPECT_RATIOS[Math.floor(h * ASPECT_RATIOS.length)];

  if (isItem) {
    const categoryNorm = normCategory(itemOrId.category);
    
    const isImportant = isMonumentalCard(itemOrId);

    const isBasic = 
      itemOrId.rarity === 'common' || 
      categoryNorm.includes('street') || 
      categoryNorm.includes('calle') ||
      categoryNorm.includes('object') ||
      categoryNorm.includes('objeto') ||
      categoryNorm.includes('everyday') ||
      categoryNorm.includes('cotidiano') ||
      categoryNorm.includes('vida');

    if (isImportant) {
      // Monumental → tallest card
      const tallRatios = ['9/16', '2/3', '9/14'];
      aspectRatio = tallRatios[Math.floor(h * tallRatios.length)];
    } else if (isBasic) {
      const shortRatios = ['1/1', '5/4', '4/5'] as const;
      aspectRatio = shortRatios[Math.floor(h * shortRatios.length)];
    }
  }

  return { aspectRatio, monumental: isItem ? isMonumentalCard(itemOrId as FeedItem) : false };
}
