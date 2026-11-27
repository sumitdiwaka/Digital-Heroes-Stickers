import { Bike, Hash, Stamp, Tag, Trophy, Zap, Boxes } from 'lucide-react';
export const DIVISION_META = {
  'labels-stickers': { icon: Tag, color: '#C77D2E', no: '01' },
  'race-event-numbers': { icon: Hash, color: '#4F8A62', no: '02' },
  'mtb-boards': { icon: Bike, color: '#3A6EA5', no: '03' },
  stamps: { icon: Stamp, color: '#C8432F', no: '04' },
  trophies: { icon: Trophy, color: '#D9962B', no: '05' },
  'laser-cut': { icon: Zap, color: '#2F8F8A', no: '06' },
};
export const metaFor = (slug, i = 0) => DIVISION_META[slug] || { icon: Boxes, color: '#454A60', no: String(i + 1).padStart(2, '0') };

/** Material swatch colour (purely visual) */
export const materialTint = (key = '') => {
  const k = key.toLowerCase();
  if (/clear|acrylic/.test(k)) return ['#DDF1F0', '#9FD3CF'];
  if (/vinyl/.test(k)) return ['#FFFFFF', '#E7EAF0'];
  if (/tyvek/.test(k)) return ['#FAFAF6', '#E4E4DA'];
  if (/brass/.test(k)) return ['#EBD28D', '#B98A2E'];
  if (/wood|ply|walnut/.test(k)) return ['#E2BE8E', '#B98A58'];
  if (/mdf/.test(k)) return ['#C9A57A', '#9C7A52'];
  if (/coro|pvc/.test(k)) return ['#F3F0E8', '#D8D2C2'];
  if (/black/.test(k)) return ['#3B3F4D', '#1B1E2C'];
  if (/blue/.test(k)) return ['#7FA6D8', '#3A6EA5'];
  if (/red/.test(k)) return ['#E58C7D', '#C8432F'];
  return ['#FBF8F2', '#E3DBC9'];
};
