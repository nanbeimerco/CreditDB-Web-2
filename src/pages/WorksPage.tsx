import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Caption1, Dropdown, Field, Input, makeStyles, Option, SearchBox, Switch, Table, TableBody, TableCell,
  TableCellLayout, TableHeader, TableHeaderCell, TableRow, Text, Title2, tokens, mergeClasses,
} from '@fluentui/react-components';
import { getWorks, type WorkSort } from '../db/repo';
import { Cover, ErrorBox, Loading, Pager, StudioLink, TierBadge, VerdictBadge } from '../components/common';
import { predictedDev, TIERS } from '../lib/labels';
import { fmt, fmtSigned } from '../lib/text';
import { useAsync } from '../lib/useAsync';
import { useVersion } from '../lib/version';

const PAGE_SIZE = 50;

export const usePageStyles = makeStyles({
  page: { display: 'flex', flexDirection: 'column', gap: '20px' },
  head: { display: 'flex', alignItems: 'baseline', gap: '12px' },
  muted: { color: tokens.colorNeutralForeground3 },
  filters: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    gap: '12px 16px',
    padding: '16px 20px',
    borderRadius: tokens.borderRadiusXLarge,
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow4,
  },
  tableWrap: {
    borderRadius: tokens.borderRadiusXLarge,
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow4,
    padding: '4px 12px',
    overflowX: 'auto',
  },
  row: { cursor: 'pointer' },
  num: { textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
  titleCell: { display: 'flex', flexDirection: 'column', minWidth: 0 },
  ellipsis: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  pos: { color: tokens.colorPaletteGreenForeground1 },
  neg: { color: tokens.colorPaletteRedForeground1 },
});

type Col = 'title' | 'year' | 'dev' | 'raw' | 'pred' | 'res';
const COL_SORT: Record<Col, [WorkSort, WorkSort?]> = {
  title: ['title'],
  year: ['year_desc', 'year_asc'],
  dev: ['dev_desc', 'dev_asc'],
  raw: ['raw_desc'],
  pred: ['pred_desc'],
  res: ['res_desc', 'res_asc'],
};

function sortState(sort: WorkSort, col: Col): 'ascending' | 'descending' | undefined {
  const [d, a] = COL_SORT[col];
  if (sort === d) return col === 'title' ? 'ascending' : 'descending';
  if (sort === a) return 'ascending';
  return undefined;
}

export default function WorksPage() {
  const s = usePageStyles();
  const navigate = useNavigate();
  const version = useVersion();
  const [params, setParams] = useSearchParams();

  const q = params.get('q') ?? '';
  const yearFrom = Number(params.get('yf')) || undefined;
  const yearTo = Number(params.get('yt')) || undefined;
  const tiers = params.get('tiers')?.split(',').filter(Boolean) ?? [];
  const verdict = params.get('v') ?? '';
  const includeUnrated = params.get('all') === '1';
  const sort = (params.get('sort') as WorkSort) || 'dev_desc';
  const page = Number(params.get('p')) || 0;

  const update = (patch: Record<string, string | undefined>, keepPage = false) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!keepPage) next.delete('p');
    setParams(next, { replace: true });
  };

  // 検索語は入力のたびに URL を変えず、少し待ってから反映する
  const [qInput, setQInput] = useState(q);
  useEffect(() => setQInput(q), [q]);
  useEffect(() => {
    const t = setTimeout(() => qInput !== q && update({ q: qInput || undefined }), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qInput]);

  const { data, error, loading } = useAsync(
    () => getWorks({ q, yearFrom, yearTo, tiers, verdict, includeUnrated, sort, page, pageSize: PAGE_SIZE }),
    [q, yearFrom, yearTo, tiers.join(','), verdict, includeUnrated, sort, page],
  );

  const onSort = (col: Col) => {
    const [d, a] = COL_SORT[col];
    update({ sort: sort === d && a ? a : d });
  };

  const header = (col: Col, label: string, numeric = false) => (
    <TableHeaderCell sortable sortDirection={sortState(sort, col)} onClick={() => onSort(col)} className={numeric ? s.num : undefined}>
      {label}
    </TableHeaderCell>
  );

  return (
    <div className={s.page}>
      <div className={s.head}>
        <Title2>作品</Title2>
        <Text className={s.muted}>{version.yearMin}〜{version.yearMax}年 · 全 {version.totalWorks.toLocaleString()} 作品</Text>
      </div>

      <div className={s.filters}>
        <Field label="作品名・スタッフ名" style={{ width: 300 }}>
          <SearchBox value={qInput} onChange={(_, d) => setQInput(d.value)} placeholder="例: 進撃の巨人 / 新海誠" />
        </Field>
        <Field label="放送年">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Input type="number" style={{ width: 96 }} placeholder={String(version.yearMin)} defaultValue={yearFrom ? String(yearFrom) : ''}
              onBlur={(e) => update({ yf: e.target.value || undefined })}
              onKeyDown={(e) => e.key === 'Enter' && update({ yf: (e.target as HTMLInputElement).value || undefined })} />
            <Text>〜</Text>
            <Input type="number" style={{ width: 96 }} placeholder={String(version.yearMax)} defaultValue={yearTo ? String(yearTo) : ''}
              onBlur={(e) => update({ yt: e.target.value || undefined })}
              onKeyDown={(e) => e.key === 'Enter' && update({ yt: (e.target as HTMLInputElement).value || undefined })} />
          </div>
        </Field>
        <Field label="Tier">
          <Dropdown
            multiselect
            placeholder="すべて"
            style={{ minWidth: 160 }}
            selectedOptions={tiers}
            value={tiers.join(', ')}
            onOptionSelect={(_, d) => update({ tiers: d.selectedOptions.join(',') || undefined })}
          >
            {TIERS.map((t) => (
              <Option key={t} value={t} text={t}>
                <TierBadge tier={t} />
              </Option>
            ))}
          </Dropdown>
        </Field>
        <Field label="スタッフからの予想との比較">
          <Dropdown
            style={{ minWidth: 160 }}
            selectedOptions={[verdict]}
            value={{ '': 'すべて', above: '期待以上', as_expected: '期待通り', below: '期待未達' }[verdict] ?? 'すべて'}
            onOptionSelect={(_, d) => update({ v: d.optionValue || undefined })}
          >
            <Option value="">すべて</Option>
            <Option value="above">期待以上</Option>
            <Option value="as_expected">期待通り</Option>
            <Option value="below">期待未達</Option>
          </Dropdown>
        </Field>
        <Switch
          label="評価のない作品も表示"
          checked={includeUnrated}
          onChange={(_, d) => update({ all: d.checked ? '1' : undefined })}
        />
      </div>

      {error ? <ErrorBox error={error} /> : null}

      <div className={s.tableWrap}>
        {data && <Pager page={page} pageSize={PAGE_SIZE} total={data.total} onChange={(p) => update({ p: String(p) }, true)} />}
        <Table size="small" aria-label="作品一覧" style={{ minWidth: 1000 }}>
          <TableHeader>
            <TableRow>
              <TableHeaderCell style={{ width: 52 }} />
              {header('title', 'タイトル')}
              <TableHeaderCell style={{ width: 170 }}>スタジオ</TableHeaderCell>
              <TableHeaderCell style={{ width: 70 }} sortable sortDirection={sortState(sort, 'year')} onClick={() => onSort('year')}>年</TableHeaderCell>
              <TableHeaderCell style={{ width: 56 }}>Tier</TableHeaderCell>
              <TableHeaderCell style={{ width: 84 }} sortable sortDirection={sortState(sort, 'dev')} onClick={() => onSort('dev')}>偏差値</TableHeaderCell>
              <TableHeaderCell style={{ width: 84 }} sortable sortDirection={sortState(sort, 'raw')} onClick={() => onSort('raw')}>AniList</TableHeaderCell>
              <TableHeaderCell style={{ width: 96 }} sortable sortDirection={sortState(sort, 'pred')} onClick={() => onSort('pred')}>予測偏差値</TableHeaderCell>
              <TableHeaderCell style={{ width: 76 }} sortable sortDirection={sortState(sort, 'res')} onClick={() => onSort('res')}>差</TableHeaderCell>
              <TableHeaderCell style={{ width: 90 }}>判定</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.rows.map((w) => {
              const pred = predictedDev(w);
              return (
                <TableRow key={w.work_id} className={s.row} onClick={() => navigate(`/works/${encodeURIComponent(w.work_id)}`)}>
                  <TableCell>
                    <div style={{ padding: '4px 0' }}>
                      <Cover target={w.cover} width={36} />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className={s.titleCell}>
                      <Text weight="semibold" className={s.ellipsis}>{w.title}</Text>
                      {w.title_en && <Caption1 className={mergeClasses(s.muted, s.ellipsis)}>{w.title_en}</Caption1>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <TableCellLayout truncate>{w.studio ? <StudioLink name={w.studio} /> : '—'}</TableCellLayout>
                  </TableCell>
                  <TableCell>{w.year}</TableCell>
                  <TableCell><TierBadge tier={w.tier} /></TableCell>
                  <TableCell className={s.num}>{w.tier !== '-' ? fmt(w.deviation_score) : '—'}</TableCell>
                  <TableCell className={s.num}>{w.anilist_raw_score > 0 ? fmt(w.anilist_raw_score, 0) : '—'}</TableCell>
                  <TableCell className={s.num}>{pred !== null ? fmt(pred) : '—'}</TableCell>
                  <TableCell className={mergeClasses(s.num, pred !== null && w.residual > 0 && s.pos, pred !== null && w.residual < 0 && s.neg)}>
                    {pred !== null ? fmtSigned(w.deviation_score - pred) : '—'}
                  </TableCell>
                  <TableCell><VerdictBadge verdict={w.performance_verdict} /></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {loading && !data && <Loading />}
        {data && data.rows.length === 0 && <div style={{ padding: 32, textAlign: 'center' }}><Text className={s.muted}>条件に合う作品がありません</Text></div>}
        {data && <Pager page={page} pageSize={PAGE_SIZE} total={data.total} onChange={(p) => update({ p: String(p) }, true)} />}
      </div>
    </div>
  );
}
