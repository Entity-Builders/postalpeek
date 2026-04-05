/**
 * deriveGameStats.ts — Client-side deterministic stat generator.
 *
 * Mirrors the server-side fallback in vision-analyzer.ts.
 * Used to generate RPG stats from scene metadata when Gemini
 * doesn't return them (or for backfilling existing postcards).
 */

export interface GameStats {
  hp: number;
  attack: number;
  defense: number;
  magic: number;
  element: string;
  rarity: string;
}

interface SceneData {
  category?: { es?: string; en?: string } | string | null;
  scene_type?: string | null;
  weather?: string | null;
  architecture_style?: string | null;
  aesthetic_vibes?: string[] | null;
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h % 100) / 100;
}

export function deriveGameStats(scene: SceneData): GameStats {
  const catObj = scene.category;
  const cat = (
    typeof catObj === 'object' && catObj?.en
      ? catObj.en
      : typeof catObj === 'string'
        ? catObj
        : ''
  ).toLowerCase();
  const sceneType = (scene.scene_type || '').toLowerCase();
  const weather = (scene.weather || '').toLowerCase();
  const arch = (scene.architecture_style || '').toLowerCase();
  const vibes = (scene.aesthetic_vibes || []).map((v) => v.toLowerCase());
  const seed = hash(cat + sceneType + weather + arch);

  // ── Element ──
  let element = 'earth';
  if (['rainy', 'stormy'].includes(weather)) element = 'water';
  else if (['snowy', 'foggy'].includes(weather)) element = 'air';
  else if (['sunny'].includes(weather) && vibes.includes('cyberpunk')) element = 'electric';
  else if (['sunny'].includes(weather)) element = 'fire';
  else if (['overcast', 'hazy'].includes(weather)) element = 'dark';
  else if (vibes.includes('neon_dream') || vibes.includes('cyberpunk')) element = 'electric';
  else if (vibes.includes('zen_peace') || vibes.includes('cottagecore')) element = 'nature';
  else if (vibes.includes('dark_academia') || vibes.includes('melancholic')) element = 'dark';
  else if (vibes.includes('solarpunk')) element = 'light';
  else if (cat.includes('coast') || cat.includes('water')) element = 'water';
  else if (cat.includes('mountain') || cat.includes('nature')) element = 'earth';
  else if (cat.includes('urban') || cat.includes('industrial')) element = 'steel';

  // ── HP ──
  let hp = 50 + Math.round(seed * 20);
  if (cat.includes('monument') || cat.includes('historic')) hp += 20;
  if (cat.includes('mountain')) hp += 25;
  if (sceneType.includes('industrial') || sceneType.includes('highway')) hp += 10;
  if (cat.includes('abandoned')) hp -= 15;

  // ── Attack ──
  let attack = 30 + Math.round(seed * 25);
  if (['stormy', 'rainy'].includes(weather)) attack += 25;
  if (vibes.includes('urban_chaos')) attack += 20;
  if (vibes.includes('cyberpunk') || vibes.includes('neon_dream')) attack += 15;
  if (sceneType.includes('highway') || sceneType.includes('traffic')) attack += 10;
  if (vibes.includes('zen_peace') || vibes.includes('cottagecore')) attack -= 15;

  // ── Defense ──
  let defense = 40 + Math.round(seed * 20);
  if (['brutalist', 'gothic', 'classical', 'colonial'].includes(arch)) defense += 25;
  if (['modern', 'contemporary_glass'].includes(arch)) defense += 10;
  if (cat.includes('mountain')) defense += 20;
  if (cat.includes('coast') || cat.includes('water')) defense -= 10;

  // ── Magic ──
  let magic = 30 + Math.round(seed * 20);
  if (vibes.includes('dark_academia') || vibes.includes('vintage_nostalgia')) magic += 25;
  if (vibes.includes('romantic') || vibes.includes('zen_peace')) magic += 20;
  if (vibes.includes('neon_dream') || vibes.includes('solarpunk')) magic += 15;
  if (cat.includes('cultural') || cat.includes('historic')) magic += 15;
  if (cat.includes('oddity')) magic += 30;
  if (sceneType.includes('industrial')) magic -= 10;

  // Clamp
  hp = Math.max(1, Math.min(100, hp));
  attack = Math.max(1, Math.min(100, attack));
  defense = Math.max(1, Math.min(100, defense));
  magic = Math.max(1, Math.min(100, magic));

  // ── Rarity ──
  const totalPower = hp + attack + defense + magic;
  let rarity: string;
  if (totalPower >= 320) rarity = 'legendary';
  else if (totalPower >= 260) rarity = 'epic';
  else if (totalPower >= 210) rarity = 'rare';
  else if (totalPower >= 160) rarity = 'uncommon';
  else rarity = 'common';

  if (cat.includes('oddity') || cat.includes('postal') || cat.includes('time capsule')) {
    rarity = rarity === 'common' ? 'uncommon' : rarity === 'uncommon' ? 'rare' : rarity;
  }

  return { hp, attack, defense, magic, element, rarity };
}

/** Check if game_stats object is empty/missing actual values */
export function hasValidGameStats(gs: unknown): gs is GameStats {
  return !!gs && typeof gs === 'object' && 'hp' in gs && typeof (gs as GameStats).hp === 'number';
}
