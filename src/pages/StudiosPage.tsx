import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Field, SearchBox, Table, TableBody, TableCell, TableCellLayout, TableHeader, TableHeaderCell, TableRow, Text, Title2,
} from '@fluentui/react-components';
import { getStudios } from '../db/repo';
import { ErrorBox, Loading, Pager, TierBadge } from '../components/common';
import { fmt } from '../lib/text';
import { useAsync } from '../lib/useAsync';
import { usePageStyles } from './WorksPage';

const PAGE_SIZE = 50;

export default function StudiosPage() {
  const s = usePageStyles();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const page = Number(params.get('p')) || 0;
  const [qInput, setQInput] = useState(q);

  useEffect(() => {
    const t = setTimeout(() => {
      if (qInput === q) return;
      const next = new URLSearchParams();
      if (qInput) next.set('q', qInput);
      setParams(next, { replace: true });
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qInput]);

  const { data, error, loading } = useAsync(() => getStudios(q, page, PAGE_SIZE), [q, page]);
  const setPage = (p: number) => {
    const next = new URLSearchParams(params);
    next.set('p', String(p));
    setParams(next, { replace: true });
  };

  return (
    <div className={s.page}>
      <div className={s.head}>
        <Title2>スタジオ</Title2>
        <Text className={s.muted}>制作作品数の多い順</Text>
      </div>
      <div className={s.filters}>
        <Field label="スタジオ名" style={{ width: 300 }}>
          <SearchBox value={qInput} onChange={(_, d) => setQInput(d.value)} placeholder="例: 京都アニメーション" />
        </Field>
      </div>
      {error ? <ErrorBox error={error} /> : null}
      <div className={s.tableWrap}>
        {data && <Pager page={page} pageSize={PAGE_SIZE} total={data.total} onChange={setPage} />}
        <Table size="small" aria-label="スタジオ一覧" style={{ minWidth: 800 }}>
          <TableHeader>
            <TableRow>
              <TableHeaderCell>スタジオ</TableHeaderCell>
              <TableHeaderCell style={{ width: 80 }} className={s.num}>作品数</TableHeaderCell>
              <TableHeaderCell style={{ width: 120 }}>活動期間</TableHeaderCell>
              <TableHeaderCell>代表作</TableHeaderCell>
              <TableHeaderCell style={{ width: 64 }}>Tier</TableHeaderCell>
              <TableHeaderCell style={{ width: 80 }} className={s.num}>偏差値</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.rows.map((r) => (
              <TableRow key={r.name} className={s.row} onClick={() => navigate(`/studios/${encodeURIComponent(r.name)}`)}>
                <TableCell><Text weight="semibold">{r.name}</Text></TableCell>
                <TableCell className={s.num}>{r.works_count}</TableCell>
                <TableCell>{r.first_year ? `${r.first_year}–${r.latest_year ?? ''}` : '—'}</TableCell>
                <TableCell>
                  <TableCellLayout truncate>
                    {r.best_work_title ? `${r.best_work_title}${r.best_work_year ? `（${r.best_work_year}）` : ''}` : '—'}
                  </TableCellLayout>
                </TableCell>
                <TableCell><TierBadge tier={r.best_work_tier} /></TableCell>
                <TableCell className={s.num}>{fmt(r.best_work_dev)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {loading && !data && <Loading />}
        {data && <Pager page={page} pageSize={PAGE_SIZE} total={data.total} onChange={setPage} />}
      </div>
    </div>
  );
}
