// 画面が使う検索をまとめたもの。SQL はすべてここに置く。
import { query } from './client';
import { likeEscape, normalizeText } from '../lib/text';
import { WORK_ROLE_ORDER } from '../lib/labels';

// ---------------------------------------------------------------- 型

export interface WorkRow {
  work_id: string;
  title: string;
  title_en: string | null;
  year: number;
  episodes: number | null;
  anilist_raw_score: number;
  deviation_score: number;
  z_score_rank: number;
  predicted_z_score: number;
  residual: number;
  performance_verdict: string;
  tier: string;
  percentile: number;
  studio: string | null;
  cover: string | null;
}

export interface Credit {
  name: string;
  rt?: string; // 総合実力 Tier
  ct?: string; // 累計実績 Tier
  aid?: number;
  eps?: (number | string)[];
  w?: number;
}

export interface CastRow {
  character_name: string;
  relation: string;
  actor_name: string;
  rt?: string;
  ct?: string;
}

export interface WorkDetail extends WorkRow {
  staff: Record<string, Credit[]>;
  cast: CastRow[];
}

export interface EpisodeScore {
  episode: number;
  rating: number;
  votes: number;
}

export interface LeaderboardRow {
  role: string;
  name: string;
  works_count: number;
  bayesian_rating: number;
  career_cumulative_z: number;
  rating_rank: number;
  cumulative_rank: number;
  rating_tier: string;
  cumulative_tier: string;
  best_work_title: string | null;
  best_work_year: number | null;
  top_character: string | null;
  first_year: number | null;
  latest_year: number | null;
  m_value: number | null;
  m_rank: number | null;
  m_total: number | null;
  m_tier: string | null;
}

export interface RoleStat {
  role: string;
  works_count: number;
  bayesian_rating: number;
  career_cumulative_z: number;
  rating_rank: number;
  cumulative_rank: number;
  role_total: number;
  rating_tier: string;
  cum_tier: string;
}

export interface Profile {
  name: string;
  primary_role: string;
  total_works: number;
  bayesian_rating: number;
  overall_rating_tier: string;
  overall_rank: number;
  career_cumulative_z: number;
  overall_cum_tier: string;
  cumulative_rank: number;
  first_year: number | null;
  latest_year: number | null;
  roles: RoleStat[];
}

export interface StaffMetric {
  role: string;
  metric: 'contribution' | 'episode';
  value: number;
  n: number;
  rank: number;
  total: number;
  tier: string;
}

export interface CareerEntry {
  work_id: string;
  title: string;
  year: number;
  deviation_score: number;
  tier: string;
  cover: string | null;
  roles: { role: string; eps?: (number | string)[]; character?: string; relation?: string; tier?: string }[];
}

export interface StudioRow {
  name: string;
  works_count: number;
  best_work_title: string | null;
  best_work_year: number | null;
  best_work_dev: number | null;
  best_work_tier: string | null;
  first_year: number | null;
  latest_year: number | null;
}

export interface StudioWork {
  work_id: string;
  title: string;
  year: number;
  deviation_score: number;
  tier: string;
  anilist_raw_score: number;
  cover: string | null;
}

export interface StudioPerson {
  name: string;
  count: number;
  roles: Record<string, number>;
  tier?: string;
}

export interface MetricValidation {
  role: string;
  method: string;
  pearson: number | null;
  spearman: number | null;
  n: number;
}

export interface Paged<T> {
  rows: T[];
  total: number;
}

// ---------------------------------------------------------------- 作品

export type WorkSort =
  | 'dev_desc' | 'dev_asc' | 'raw_desc' | 'pred_desc' | 'res_desc' | 'res_asc' | 'year_desc' | 'year_asc' | 'title';

// 予測のない作品（古い作品・最近の作品）は予測・差で並べるとき後ろに回す
const PREDICTED_LAST = "CASE WHEN performance_verdict IN ('ARCHIVE', 'NEW') THEN 1 ELSE 0 END";

const WORK_SORT_SQL: Record<WorkSort, string> = {
  dev_desc: 'deviation_score DESC, year DESC',
  dev_asc: 'deviation_score ASC, year DESC',
  raw_desc: 'anilist_raw_score DESC, deviation_score DESC',
  pred_desc: `${PREDICTED_LAST}, predicted_z_score DESC`,
  res_desc: `${PREDICTED_LAST}, residual DESC`,
  res_asc: `${PREDICTED_LAST}, residual ASC`,
  year_desc: 'year DESC, deviation_score DESC',
  year_asc: 'year ASC, deviation_score DESC',
  title: 'title COLLATE NOCASE ASC',
};

export interface WorkFilter {
  q?: string;
  yearFrom?: number;
  yearTo?: number;
  tiers?: string[];
  verdict?: string; // above | as_expected | below
  includeUnrated?: boolean;
  sort: WorkSort;
  page: number;
  pageSize: number;
}

const WORK_COLS = `
  w.work_id, w.title, w.title_en, w.year, w.episodes, w.anilist_raw_score, w.deviation_score, w.z_score_rank,
  w.predicted_z_score, w.residual, w.performance_verdict, w.tier, w.percentile,
  json_extract(w.staff_json, '$.studio[0].name') AS studio, c.target AS cover`;

const VERDICT_SQL: Record<string, string> = {
  above: "performance_verdict LIKE 'サプライズ%'",
  as_expected: "performance_verdict LIKE '概ね%'",
  below: "performance_verdict LIKE '期待外れ%'",
};

function workWhere(f: WorkFilter): { sql: string; params: (string | number)[] } {
  const cond: string[] = [];
  const params: (string | number)[] = [];
  const q = normalizeText(f.q);
  if (q) {
    cond.push("w.search_text_norm LIKE ? ESCAPE '\\'");
    params.push(`%${likeEscape(q)}%`);
  }
  if (f.yearFrom) {
    cond.push('w.year >= ?');
    params.push(f.yearFrom);
  }
  if (f.yearTo) {
    cond.push('w.year <= ?');
    params.push(f.yearTo);
  }
  if (f.tiers?.length) {
    cond.push(`w.tier IN (${f.tiers.map(() => '?').join(',')})`);
    params.push(...f.tiers);
  } else if (!f.includeUnrated) {
    cond.push("w.tier != '-'");
  }
  if (f.verdict && VERDICT_SQL[f.verdict]) cond.push(VERDICT_SQL[f.verdict]);
  return { sql: cond.length ? `WHERE ${cond.join(' AND ')}` : '', params };
}

export async function getWorks(f: WorkFilter): Promise<Paged<WorkRow>> {
  const { sql, params } = workWhere(f);
  // 検索語があるときは、タイトルの前方一致を先に出す
  const q = normalizeText(f.q);
  const order = q
    ? `CASE WHEN w.search_text_norm LIKE ? ESCAPE '\\' THEN 0 ELSE 1 END, ${WORK_SORT_SQL[f.sort]}`
    : WORK_SORT_SQL[f.sort];
  const orderParams = q ? [`${likeEscape(q)}%`] : [];
  const [rows, cnt] = await Promise.all([
    query<WorkRow>(
      `SELECT ${WORK_COLS} FROM works w LEFT JOIN work_covers c ON c.work_id = w.work_id ${sql}
       ORDER BY ${order} LIMIT ? OFFSET ?`,
      [...params, ...orderParams, f.pageSize, f.page * f.pageSize],
    ),
    query<{ n: number }>(`SELECT COUNT(*) AS n FROM works w ${sql}`, params),
  ]);
  return { rows, total: cnt[0]?.n ?? 0 };
}

export async function getWorkDetail(id: string): Promise<WorkDetail | null> {
  const rows = await query<WorkRow & { staff_json: string; characters_json: string }>(
    `SELECT ${WORK_COLS}, w.staff_json, w.characters_json
     FROM works w LEFT JOIN work_covers c ON c.work_id = w.work_id WHERE w.work_id = ?`,
    [id],
  );
  const r = rows[0];
  if (!r) return null;
  const { staff_json, characters_json, ...rest } = r;
  return { ...rest, staff: safeJson(staff_json, {}), cast: safeJson(characters_json, []) };
}

export function getEpisodeScores(id: string): Promise<EpisodeScore[]> {
  return query<EpisodeScore>(
    "SELECT episode, rating, votes FROM episode_scores WHERE work_id = ? AND source = 'imdb' AND episode >= 1 ORDER BY episode",
    [id],
  );
}

/** 作品に出てくる名前のうち、人物ページがあるもの（会社名などはリンクしない） */
export async function getKnownPeople(names: string[]): Promise<Set<string>> {
  const uniq = [...new Set(names)];
  const known = new Set<string>();
  for (let i = 0; i < uniq.length; i += 500) {
    const chunk = uniq.slice(i, i + 500);
    const rows = await query<{ name: string }>(
      `SELECT name FROM profiles WHERE name IN (${chunk.map(() => '?').join(',')})`,
      chunk,
    );
    rows.forEach((r) => known.add(r.name));
  }
  return known;
}

// ---------------------------------------------------------------- スタッフ

export type StaffSort = 'rating' | 'cumulative' | 'contribution' | 'episode' | 'works' | 'debut_new' | 'debut_old';

export interface StaffFilter {
  role: string;
  sort: StaffSort;
  q?: string;
  debutFrom?: number;
  debutTo?: number;
  page: number;
  pageSize: number;
}

export async function getLeaderboard(f: StaffFilter): Promise<Paged<LeaderboardRow>> {
  const cond = ['l.role = ?'];
  const params: (string | number)[] = [f.role];
  const q = normalizeText(f.q);
  if (q) {
    cond.push("l.name_norm LIKE ? ESCAPE '\\'");
    params.push(`%${likeEscape(q)}%`);
  }
  if (f.debutFrom) {
    cond.push('l.first_year >= ?');
    params.push(f.debutFrom);
  }
  if (f.debutTo) {
    cond.push('l.first_year <= ?');
    params.push(f.debutTo);
  }
  const metric = f.sort === 'contribution' || f.sort === 'episode' ? f.sort : null;
  const join = metric
    ? 'JOIN staff_metrics m ON m.name = l.name AND m.role = l.role AND m.metric = ?'
    : 'LEFT JOIN staff_metrics m ON m.name = l.name AND m.role = l.role AND m.metric = ?';
  const order: Record<StaffSort, string> = {
    rating: 'l.rating_rank',
    cumulative: 'l.cumulative_rank',
    contribution: 'm.rank',
    episode: 'm.rank',
    works: 'l.works_count DESC, l.rating_rank',
    debut_new: 'l.first_year DESC, l.rating_rank',
    debut_old: 'l.first_year ASC, l.rating_rank',
  };
  const where = cond.join(' AND ');
  const metricKey = metric ?? 'contribution';
  const [rows, cnt] = await Promise.all([
    query<LeaderboardRow>(
      `SELECT l.role, l.name, l.works_count, l.bayesian_rating, l.career_cumulative_z, l.rating_rank, l.cumulative_rank,
              l.rating_tier, l.cumulative_tier, l.best_work_title, l.best_work_year, l.top_character,
              l.first_year, l.latest_year, m.value AS m_value, m.rank AS m_rank, m.total AS m_total, m.tier AS m_tier
       FROM leaderboards l ${join} WHERE ${where} ORDER BY ${order[f.sort]} LIMIT ? OFFSET ?`,
      [metricKey, ...params, f.pageSize, f.page * f.pageSize],
    ),
    query<{ n: number }>(
      `SELECT COUNT(*) AS n FROM leaderboards l ${metric ? join : ''} WHERE ${where}`,
      metric ? [metricKey, ...params] : params,
    ),
  ]);
  return { rows, total: cnt[0]?.n ?? 0 };
}

export async function getProfile(name: string): Promise<Profile | null> {
  const rows = await query<Omit<Profile, 'roles'> & { all_role_stats_json: string }>(
    `SELECT name, primary_role, total_works, bayesian_rating, overall_rating_tier, overall_rank, career_cumulative_z,
            overall_cum_tier, cumulative_rank, first_year, latest_year, all_role_stats_json
     FROM profiles WHERE name = ?`,
    [name],
  );
  const r = rows[0];
  if (!r) return null;
  const { all_role_stats_json, ...rest } = r;
  return { ...rest, roles: safeJson<RoleStat[]>(all_role_stats_json, []) };
}

export function getStaffMetrics(name: string): Promise<StaffMetric[]> {
  return query<StaffMetric>('SELECT role, metric, value, n, rank, total, tier FROM staff_metrics WHERE name = ?', [name]);
}

export async function isNonPerson(name: string): Promise<boolean> {
  const r = await query<{ n: number }>('SELECT COUNT(*) AS n FROM non_person_names WHERE name = ?', [name]);
  return (r[0]?.n ?? 0) > 0;
}

/** 参加作品の一覧。保存された経歴は持たず、作品のクレジットから組み立てる */
export async function getCareer(name: string): Promise<CareerEntry[]> {
  const staffKey = `"name": ${JSON.stringify(name)}`;
  const castKey = `"actor_name": ${JSON.stringify(name)}`;
  const rows = await query<{
    work_id: string; title: string; year: number; deviation_score: number; tier: string; cover: string | null;
    staff_json: string; characters_json: string;
  }>(
    `SELECT w.work_id, w.title, w.year, w.deviation_score, w.tier, c.target AS cover, w.staff_json, w.characters_json
     FROM works w LEFT JOIN work_covers c ON c.work_id = w.work_id
     WHERE instr(w.staff_json, ?) > 0 OR instr(w.characters_json, ?) > 0
     ORDER BY w.year DESC, w.deviation_score DESC`,
    [staffKey, castKey],
  );
  return rows
    .map((r) => {
      const roles: CareerEntry['roles'] = [];
      const staff = safeJson<Record<string, Credit[]>>(r.staff_json, {});
      for (const [role, list] of Object.entries(staff)) {
        if (role === 'cv') continue;
        const c = list.find((x) => x.name === name);
        if (c) roles.push({ role, eps: c.eps, tier: c.rt });
      }
      for (const c of safeJson<CastRow[]>(r.characters_json, [])) {
        if (c.actor_name === name) roles.push({ role: 'cv', character: c.character_name, relation: c.relation, tier: c.rt });
      }
      // 主要な役職を先に（グラフの色は先頭の役職で決まる）
      roles.sort((a, b) => roleRank(a.role) - roleRank(b.role));
      return {
        work_id: r.work_id, title: r.title, year: r.year, deviation_score: r.deviation_score, tier: r.tier,
        cover: r.cover, roles,
      };
    })
    .filter((e) => e.roles.length > 0);
}

// ---------------------------------------------------------------- スタジオ

export async function getStudios(q: string, page: number, pageSize: number): Promise<Paged<StudioRow>> {
  const nq = normalizeText(q);
  const where = nq ? "WHERE name_norm LIKE ? ESCAPE '\\'" : '';
  const params = nq ? [`%${likeEscape(nq)}%`] : [];
  const [rows, cnt] = await Promise.all([
    query<StudioRow>(
      `SELECT name, works_count, best_work_title, best_work_year, best_work_dev, best_work_tier, first_year, latest_year
       FROM studios ${where} ORDER BY works_count DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, page * pageSize],
    ),
    query<{ n: number }>(`SELECT COUNT(*) AS n FROM studios ${where}`, params),
  ]);
  return { rows, total: cnt[0]?.n ?? 0 };
}

export async function getStudio(name: string): Promise<StudioRow | null> {
  const rows = await query<StudioRow>(
    `SELECT name, works_count, best_work_title, best_work_year, best_work_dev, best_work_tier, first_year, latest_year
     FROM studios WHERE name = ?`,
    [name],
  );
  return rows[0] ?? null;
}

export function getStudioWorks(name: string): Promise<StudioWork[]> {
  return query<StudioWork>(
    `SELECT s.work_id, s.title, s.year, s.deviation_score, s.tier, COALESCE(w.anilist_raw_score, 0) AS anilist_raw_score,
            c.target AS cover
     FROM studio_works s LEFT JOIN works w ON w.work_id = s.work_id LEFT JOIN work_covers c ON c.work_id = s.work_id
     WHERE s.studio_name = ? ORDER BY s.year DESC, s.deviation_score DESC`,
    [name],
  );
}

/** スタジオの作品に多く参加している人（声優・スタジオを除く） */
export async function getStudioPeople(name: string, limit = 40): Promise<StudioPerson[]> {
  const rows = await query<{ staff_json: string }>(
    'SELECT w.staff_json FROM studio_works s JOIN works w ON w.work_id = s.work_id WHERE s.studio_name = ?',
    [name],
  );
  const people = new Map<string, StudioPerson>();
  for (const r of rows) {
    const staff = safeJson<Record<string, Credit[]>>(r.staff_json, {});
    const seen = new Set<string>();
    for (const [role, list] of Object.entries(staff)) {
      if (role === 'studio' || role === 'cv') continue;
      for (const c of list) {
        let p = people.get(c.name);
        if (!p) people.set(c.name, (p = { name: c.name, count: 0, roles: {}, tier: c.rt }));
        p.roles[role] = (p.roles[role] ?? 0) + 1;
        if (!seen.has(c.name)) {
          p.count++;
          seen.add(c.name);
        }
      }
    }
  }
  const list = [...people.values()].sort((a, b) => b.count - a.count).slice(0, limit * 2);
  const known = await getKnownPeople(list.map((p) => p.name));
  return list.filter((p) => known.has(p.name)).slice(0, limit);
}

// ---------------------------------------------------------------- ホーム・解説

export function getTopWorks(opts: { year?: number; limit: number }): Promise<WorkRow[]> {
  return query<WorkRow>(
    `SELECT ${WORK_COLS} FROM works w LEFT JOIN work_covers c ON c.work_id = w.work_id
     WHERE w.tier != '-' ${opts.year ? 'AND w.year = ?' : ''} ORDER BY w.deviation_score DESC LIMIT ?`,
    opts.year ? [opts.year, opts.limit] : [opts.limit],
  );
}

export function getTopStaff(role: string, limit: number): Promise<LeaderboardRow[]> {
  return getLeaderboard({ role, sort: 'rating', page: 0, pageSize: limit }).then((r) => r.rows);
}

export function getTierCounts(): Promise<{ tier: string; n: number }[]> {
  return query("SELECT tier, COUNT(*) AS n FROM works WHERE tier != '-' GROUP BY tier");
}

export function getMetricValidation(): Promise<MetricValidation[]> {
  return query<MetricValidation>('SELECT role, method, pearson, spearman, n FROM metric_validation');
}

// ---------------------------------------------------------------- 共通

const roleRank = (r: string) => {
  const i = [...WORK_ROLE_ORDER, 'cv'].indexOf(r);
  return i < 0 ? 99 : i;
};

function safeJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}
