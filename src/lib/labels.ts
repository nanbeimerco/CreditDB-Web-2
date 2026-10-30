// 役職・Tier・判定などの表示名（Android 版の表記に合わせる）

export const ROLE_LABEL: Record<string, string> = {
  all: '全スタッフ（声優を除く）',
  director: '監督',
  series_comp: 'シリーズ構成・脚本',
  char_design: 'キャラクターデザイン',
  sakkan: '作画監督',
  genga: '原画',
  genga_2nd: '2原',
  unit_director: '演出・絵コンテ',
  music: '音楽',
  art_dir: '美術監督',
  cv: '声優',
  studio: 'スタジオ',
};

export const roleLabel = (r: string) => ROLE_LABEL[r] ?? r;

/** 作品ページでの役職の並び */
export const WORK_ROLE_ORDER = [
  'director', 'series_comp', 'char_design', 'music', 'art_dir', 'sakkan', 'unit_director', 'genga', 'genga_2nd', 'studio',
];

/** スタッフ一覧で選べる役職 */
export const LEADERBOARD_ROLES = [
  'all', 'director', 'series_comp', 'char_design', 'sakkan', 'unit_director', 'genga', 'genga_2nd', 'music', 'art_dir', 'cv',
];

export const TIERS = ['S+', 'S', 'A+', 'A', 'B+', 'B', 'C', 'D'] as const;

// Android 版の Tier 色（明るめの色なので、文字は濃い色で載せる）
export const TIER_COLOR: Record<string, string> = {
  'S+': '#EAC765',
  S: '#8BD3A7',
  'A+': '#8BC5E3',
  A: '#A3B3E7',
  'B+': '#93CCCC',
  B: '#AEB2BA',
  C: '#C5A6C1',
  D: '#DEA1A9',
};

export type VerdictKind = 'above' | 'as_expected' | 'below' | 'archive' | 'new';

export function verdictInfo(v: string): { kind: VerdictKind; label: string; long: string } {
  if (v.startsWith('サプライズ')) return { kind: 'above', label: '期待以上', long: 'スタッフから予想される評価を上回った' };
  if (v.startsWith('期待外れ')) return { kind: 'below', label: '期待未達', long: 'スタッフから予想される評価に届かなかった' };
  if (v.startsWith('概ね')) return { kind: 'as_expected', label: '期待通り', long: 'スタッフから予想される評価のとおり' };
  if (v === 'NEW') return { kind: 'new', label: '新作', long: '予測の検証用（最近の作品）' };
  return { kind: 'archive', label: '—', long: '予測の対象外' };
}

export const METRIC_LABEL: Record<string, string> = {
  rating: '総合実力',
  cumulative: '累計実績',
  contribution: '個人寄与度',
  episode: '各話評価',
};

export const METRIC_HELP: Record<string, string> = {
  rating: 'その役職で参加した作品の平均的な評価水準（ベイズ平滑化 S(a)）。参加話数で重み付け済み。',
  cumulative: 'その役職でキャリアを通じて積み上げた作品評価の合計（ΣZ）。量と質の両方を表す。',
  contribution:
    'スタジオとシリーズの影響を除いて推定した、その人自身が作品評価に与えた影響（リッジ回帰）。評価のある参加作品が3作品以上の人だけ。',
  episode: '担当した話が、同じ作品のほかの話より IMDb でどれだけ高く評価されたか。参考値。',
};

/** スタッフから予測した偏差値。予測の対象外（古い作品・最近の作品）は null */
export function predictedDev(w: { performance_verdict: string; predicted_z_score: number }): number | null {
  const k = verdictInfo(w.performance_verdict).kind;
  return k === 'archive' || k === 'new' ? null : 50 + 10 * w.predicted_z_score;
}
