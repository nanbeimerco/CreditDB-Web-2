import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button, Caption1, makeStyles, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Text, Title1, tokens,
} from '@fluentui/react-components';
import { ArrowLeft20Regular } from '@fluentui/react-icons';
import { getStudio, getStudioPeople, getStudioWorks } from '../db/repo';
import { BigNumber, Cover, ErrorBox, Loading, NotFound, PersonLink, Section, Stat, TierBadge } from '../components/common';
import { TierBar } from '../components/charts';
import { roleLabel } from '../lib/labels';
import { fmt } from '../lib/text';
import { useAsync } from '../lib/useAsync';
import { usePageStyles } from './WorksPage';

const useStyles = makeStyles({
  hero: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '24px',
    borderRadius: tokens.borderRadiusXLarge,
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow4,
  },
  stats: { display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '8px' },
  muted: { color: tokens.colorNeutralForeground3 },
  people: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '8px 24px' },
  person: { display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 },
  personRoles: { color: tokens.colorNeutralForeground3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  workCell: { display: 'flex', alignItems: 'center', gap: '10px', padding: '3px 0' },
});

export default function StudioDetailPage() {
  const { name = '' } = useParams();
  const navigate = useNavigate();
  const ps = usePageStyles();
  const s = useStyles();

  const { data, error, loading } = useAsync(async () => {
    const [studio, works, people] = await Promise.all([getStudio(name), getStudioWorks(name), getStudioPeople(name)]);
    return { studio, works, people };
  }, [name]);

  const stats = useMemo(() => {
    const rated = (data?.works ?? []).filter((w) => w.tier !== '-');
    const counts: Record<string, number> = {};
    rated.forEach((w) => (counts[w.tier] = (counts[w.tier] ?? 0) + 1));
    const avg = rated.length ? rated.reduce((a, w) => a + w.deviation_score, 0) / rated.length : null;
    return { rated: rated.length, counts, avg };
  }, [data]);

  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  if (!data?.studio && !data?.works.length) return <NotFound what="スタジオ" />;
  const { studio, works, people } = data;

  return (
    <div className={ps.page}>
      <div>
        <Button appearance="subtle" icon={<ArrowLeft20Regular />} onClick={() => navigate(-1)}>戻る</Button>
      </div>
      <div className={s.hero}>
        <Title1>{name}</Title1>
        {studio?.first_year && <Text className={s.muted}>活動期間 {studio.first_year}–{studio.latest_year}</Text>}
        <div className={s.stats}>
          <Stat label="作品数" sub={`評価のある作品 ${stats.rated}`}>
            <BigNumber>{works.length}</BigNumber>
          </Stat>
          <Stat label="平均偏差値" help="評価のある作品の偏差値の平均">
            <BigNumber>{fmt(stats.avg)}</BigNumber>
          </Stat>
          {studio?.best_work_title && (
            <Stat label="最高評価の作品" sub={`${studio.best_work_year ?? ''} · 偏差値 ${fmt(studio.best_work_dev)}`}>
              <TierBadge tier={studio.best_work_tier} />
              <Text weight="semibold">{studio.best_work_title}</Text>
            </Stat>
          )}
        </div>
      </div>

      {stats.rated > 0 && (
        <Section title="Tier の内訳">
          <TierBar counts={stats.counts} />
        </Section>
      )}

      {people.length > 0 && (
        <Section title="よく参加しているスタッフ" info="このスタジオの作品への参加数が多い人（声優を除く）。数字は参加作品数。">
          <div className={s.people}>
            {people.map((p) => (
              <div key={p.name} className={s.person}>
                <TierBadge tier={p.tier} />
                <PersonLink name={p.name} />
                <Caption1>{p.count}作品</Caption1>
                <Caption1 className={s.personRoles}>
                  {Object.entries(p.roles).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([r]) => roleLabel(r)).join('・')}
                </Caption1>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title={`作品（${works.length}）`}>
        <Table size="small" aria-label="スタジオの作品">
          <TableHeader>
            <TableRow>
              <TableHeaderCell style={{ width: 64 }}>年</TableHeaderCell>
              <TableHeaderCell>作品</TableHeaderCell>
              <TableHeaderCell style={{ width: 64 }}>Tier</TableHeaderCell>
              <TableHeaderCell style={{ width: 80 }} className={ps.num}>偏差値</TableHeaderCell>
              <TableHeaderCell style={{ width: 80 }} className={ps.num}>AniList</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {works.map((w) => (
              <TableRow key={w.work_id} className={ps.row} onClick={() => navigate(`/works/${encodeURIComponent(w.work_id)}`)}>
                <TableCell>{w.year}</TableCell>
                <TableCell>
                  <div className={s.workCell}>
                    <Cover target={w.cover} width={28} />
                    <Text weight="semibold">{w.title}</Text>
                  </div>
                </TableCell>
                <TableCell><TierBadge tier={w.tier} /></TableCell>
                <TableCell className={ps.num}>{w.tier !== '-' ? fmt(w.deviation_score) : '—'}</TableCell>
                <TableCell className={ps.num}>{w.anilist_raw_score > 0 ? fmt(w.anilist_raw_score, 0) : '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>
    </div>
  );
}
