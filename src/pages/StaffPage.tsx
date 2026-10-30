import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Caption1, Dropdown, Field, InfoLabel, Option, SearchBox, Table, TableBody, TableCell, TableCellLayout, TableHeader,
  TableHeaderCell, TableRow, Text, Title2,
} from '@fluentui/react-components';
import { getLeaderboard, type StaffSort } from '../db/repo';
import { ErrorBox, Loading, Pager, TierBadge } from '../components/common';
import { LEADERBOARD_ROLES, METRIC_HELP, roleLabel } from '../lib/labels';
import { fmt, fmtInt } from '../lib/text';
import { useAsync } from '../lib/useAsync';
import { usePageStyles } from './WorksPage';

const PAGE_SIZE = 50;

const SORTS: { value: StaffSort; label: string }[] = [
  { value: 'rating', label: '総合実力 順' },
  { value: 'cumulative', label: '累計実績 順' },
  { value: 'contribution', label: '個人寄与度 順' },
  { value: 'episode', label: '各話評価 順' },
  { value: 'works', label: '作品数 順' },
  { value: 'debut_new', label: 'デビューが新しい順' },
  { value: 'debut_old', label: 'デビューが古い順' },
];

const ERAS: { value: string; label: string; from?: number; to?: number }[] = [
  { value: '', label: 'すべて' },
  { value: '2020', label: '2020年以降', from: 2020 },
  { value: '2010', label: '2010〜2019年', from: 2010, to: 2019 },
  { value: '2000', label: '2000〜2009年', from: 2000, to: 2009 },
  { value: '1990', label: '1990〜1999年', from: 1990, to: 1999 },
  { value: 'old', label: '1989年以前', to: 1989 },
];

// 個人寄与度・各話評価がある役職
const METRIC_ROLES: Partial<Record<StaffSort, string[]>> = {
  contribution: ['all', 'director', 'series_comp', 'char_design', 'sakkan', 'unit_director', 'genga', 'genga_2nd', 'music', 'art_dir'],
  episode: ['all', 'sakkan', 'unit_director', 'genga', 'genga_2nd'],
};

export default function StaffPage() {
  const s = usePageStyles();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const role = params.get('role') ?? 'director';
  let sort = (params.get('sort') as StaffSort) || 'rating';
  const metricRoles = METRIC_ROLES[sort];
  if (metricRoles && !metricRoles.includes(role)) sort = 'rating';
  const era = params.get('era') ?? '';
  const q = params.get('q') ?? '';
  const page = Number(params.get('p')) || 0;
  const eraDef = ERAS.find((e) => e.value === era) ?? ERAS[0];

  const update = (patch: Record<string, string | undefined>, keepPage = false) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!keepPage) next.delete('p');
    setParams(next, { replace: true });
  };

  const [qInput, setQInput] = useState(q);
  useEffect(() => setQInput(q), [q]);
  useEffect(() => {
    const t = setTimeout(() => qInput !== q && update({ q: qInput || undefined }), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qInput]);

  const { data, error, loading } = useAsync(
    () => getLeaderboard({ role, sort, q, debutFrom: eraDef.from, debutTo: eraDef.to, page, pageSize: PAGE_SIZE }),
    [role, sort, q, era, page],
  );

  const isCv = role === 'cv';
  const metric = sort === 'contribution' || sort === 'episode' ? sort : null;
  const availableSorts = SORTS.filter((o) => {
    const r = METRIC_ROLES[o.value];
    return !r || r.includes(role);
  });

  const rankOf = (i: number, r: { rating_rank: number; cumulative_rank: number; m_rank: number | null }) =>
    sort === 'rating' ? r.rating_rank : sort === 'cumulative' ? r.cumulative_rank : metric ? r.m_rank : page * PAGE_SIZE + i + 1;

  return (
    <div className={s.page}>
      <div className={s.head}>
        <Title2>スタッフ</Title2>
        <Text className={s.muted}>役職ごとのランキング</Text>
      </div>

      <div className={s.filters}>
        <Field label="役職">
          <Dropdown style={{ minWidth: 220 }} value={roleLabel(role)} selectedOptions={[role]} onOptionSelect={(_, d) => update({ role: d.optionValue })}>
            {LEADERBOARD_ROLES.map((r) => (
              <Option key={r} value={r}>{roleLabel(r)}</Option>
            ))}
          </Dropdown>
        </Field>
        <Field label="並び順">
          <Dropdown style={{ minWidth: 180 }} value={SORTS.find((o) => o.value === sort)?.label} selectedOptions={[sort]}
            onOptionSelect={(_, d) => update({ sort: d.optionValue })}>
            {availableSorts.map((o) => (
              <Option key={o.value} value={o.value}>{o.label}</Option>
            ))}
          </Dropdown>
        </Field>
        <Field label="デビュー年">
          <Dropdown style={{ minWidth: 150 }} value={eraDef.label} selectedOptions={[era]} onOptionSelect={(_, d) => update({ era: d.optionValue || undefined })}>
            {ERAS.map((e) => (
              <Option key={e.value} value={e.value}>{e.label}</Option>
            ))}
          </Dropdown>
        </Field>
        <Field label="名前" style={{ width: 260 }}>
          <SearchBox value={qInput} onChange={(_, d) => setQInput(d.value)} placeholder="名前で絞り込み" />
        </Field>
      </div>

      {error ? <ErrorBox error={error} /> : null}

      <div className={s.tableWrap}>
        {data && <Pager page={page} pageSize={PAGE_SIZE} total={data.total} onChange={(p) => update({ p: String(p) }, true)} />}
        <Table size="small" aria-label="スタッフ一覧" style={{ minWidth: 1000 }}>
          <TableHeader>
            <TableRow>
              <TableHeaderCell style={{ width: 64 }} className={s.num}>順位</TableHeaderCell>
              <TableHeaderCell>名前</TableHeaderCell>
              <TableHeaderCell style={{ width: 150 }}>
                <InfoLabel info={METRIC_HELP.rating}>総合実力</InfoLabel>
              </TableHeaderCell>
              <TableHeaderCell style={{ width: 150 }}>
                <InfoLabel info={METRIC_HELP.cumulative}>累計実績</InfoLabel>
              </TableHeaderCell>
              {!isCv && (
                <TableHeaderCell style={{ width: 150 }}>
                  <InfoLabel info={METRIC_HELP[metric ?? 'contribution']}>{metric === 'episode' ? '各話評価' : '個人寄与度'}</InfoLabel>
                </TableHeaderCell>
              )}
              <TableHeaderCell style={{ width: 72 }} className={s.num}>作品数</TableHeaderCell>
              <TableHeaderCell>{isCv ? '代表キャラクター' : '代表作'}</TableHeaderCell>
              <TableHeaderCell style={{ width: 110 }}>活動期間</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.rows.map((r, i) => (
              <TableRow key={r.name} className={s.row} onClick={() => navigate(`/staff/${encodeURIComponent(r.name)}`)}>
                <TableCell className={s.num}>{fmtInt(rankOf(i, r))}</TableCell>
                <TableCell><Text weight="semibold">{r.name}</Text></TableCell>
                <TableCell>
                  <MetricCell tier={r.rating_tier} value={fmt(r.bayesian_rating, 3)} />
                </TableCell>
                <TableCell>
                  <MetricCell tier={r.cumulative_tier} value={fmt(r.career_cumulative_z, 1)} />
                </TableCell>
                {!isCv && (
                  <TableCell>
                    {r.m_value !== null ? <MetricCell tier={r.m_tier} value={fmt(r.m_value, 3)} /> : <Caption1 className={s.muted}>—</Caption1>}
                  </TableCell>
                )}
                <TableCell className={s.num}>{r.works_count}</TableCell>
                <TableCell>
                  <TableCellLayout truncate>
                    {isCv
                      ? r.top_character ?? '—'
                      : r.best_work_title
                        ? `${r.best_work_title}${r.best_work_year ? `（${r.best_work_year}）` : ''}`
                        : '—'}
                  </TableCellLayout>
                </TableCell>
                <TableCell>{r.first_year ? `${r.first_year}–${r.latest_year ?? ''}` : '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {loading && !data && <Loading />}
        {data && data.rows.length === 0 && <div style={{ padding: 32, textAlign: 'center' }}><Text className={s.muted}>該当するスタッフがいません</Text></div>}
        {data && <Pager page={page} pageSize={PAGE_SIZE} total={data.total} onChange={(p) => update({ p: String(p) }, true)} />}
      </div>
    </div>
  );
}

function MetricCell({ tier, value }: { tier: string | null; value: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontVariantNumeric: 'tabular-nums' }}>
      <TierBadge tier={tier} />
      {value}
    </span>
  );
}
