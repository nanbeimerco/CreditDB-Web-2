// 検索用の文字列正規化（Android 版 TextNormalizer.kt と同じ規則。DB の *_norm 列もこの規則で作られている）

const PUNCTUATION = /[\s\-_・:：,，.．!！?？/／★☆♪〜~()（）「」『』[\]【】]/g;

const KANJI_VARIANTS: Record<string, string> = {
  惡: '悪', 櫻: '桜', 鐵: '鉄', 國: '国', 龍: '竜', 廣: '広', 髙: '高', 﨑: '崎', 壽: '寿', 體: '体',
  戰: '戦', 畫: '画', 號: '号', 變: '変', 戀: '恋', 黑: '黒', 蟲: '虫', 擊: '撃', 寫: '写', 眞: '真',
  遙: '遥', 條: '条', 齊: '斉', 齋: '斉', 斎: '斉', 藪: '薮', 峰: '峯', 嶋: '島', 濱: '浜', 濵: '浜',
};

export function normalizeText(text: string | null | undefined): string {
  if (!text) return '';
  const s = text.toLowerCase().normalize('NFKC');
  let out = '';
  for (const ch of s) {
    const code = ch.charCodeAt(0);
    if (KANJI_VARIANTS[ch]) out += KANJI_VARIANTS[ch];
    else if (ch === 'ゐ' || ch === 'ヰ') out += 'い';
    else if (ch === 'ゑ' || ch === 'ヱ') out += 'え';
    else if (ch === 'ゔ' || ch === 'ヴ') out += 'ぶ';
    else if (code >= 0x30a1 && code <= 0x30f6) out += String.fromCharCode(code - 0x60);
    else out += ch;
  }
  return out.replace(PUNCTUATION, '');
}

/** LIKE 検索用に % と _ を逃がす */
export const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => '\\' + c);

export const fmt = (n: number | null | undefined, digits = 1) =>
  n === null || n === undefined || Number.isNaN(n) ? '—' : n.toFixed(digits);

export const fmtSigned = (n: number | null | undefined, digits = 1) =>
  n === null || n === undefined || Number.isNaN(n) ? '—' : (n > 0 ? '+' : '') + n.toFixed(digits);

export const fmtInt = (n: number | null | undefined) => (n === null || n === undefined ? '—' : n.toLocaleString('ja-JP'));

/** 作品の表紙画像（Bangumi の画像 API。target が URL ならそのまま） */
export function coverUrl(target: string | null | undefined, size: 'small' | 'medium' | 'large' = 'small'): string | null {
  if (!target) return null;
  if (target.startsWith('http')) return target;
  return `https://api.bgm.tv/v0/subjects/${target}/image?type=${size}`;
}

/** 担当話数の表示 [3,7,8,9] → "3, 7–9話" */
export function formatEpisodes(eps: unknown): string | null {
  if (!Array.isArray(eps) || eps.length === 0) return null;
  const nums = eps.filter((e): e is number => typeof e === 'number').sort((a, b) => a - b);
  const others = eps.filter((e) => typeof e !== 'number').map(String);
  const parts: string[] = [];
  for (let i = 0; i < nums.length; ) {
    let j = i;
    while (j + 1 < nums.length && nums[j + 1] === nums[j] + 1) j++;
    parts.push(i === j ? `${nums[i]}` : `${nums[i]}–${nums[j]}`);
    i = j + 1;
  }
  const s = [...parts, ...others].join(', ');
  return parts.length ? `${s}話` : s;
}
