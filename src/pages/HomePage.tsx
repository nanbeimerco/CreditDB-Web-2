import { useNavigate } from 'react-router-dom';
import {
  Body1, Button, Caption1, makeStyles, Text, Title2, tokens, mergeClasses,
} from '@fluentui/react-components';
import { ArrowRight16Regular } from '@fluentui/react-icons';
import { getTierCounts, getTopStaff, getTopWorks, type LeaderboardRow, type WorkRow } from '../db/repo';
import { Cover, ErrorBox, Loading, Section, Stat, BigNumber, TierBadge } from '../components/common';
import { TierBar } from '../components/charts';
import { fmt, fmtInt } from '../lib/text';
import { useAsync } from '../lib/useAsync';
import { useVersion } from '../lib/version';

const useStyles = makeStyles({
  page: { display: 'flex', flexDirection: 'column', gap: '20px' },
  intro: { display: 'flex', flexDirection: 'column', gap: '6px' },
  muted: { color: tokens.colorNeutralForeground3 },
  stats: { display: 'flex', gap: '12px', flexWrap: 'wrap' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '20px' },
  list: { display: 'flex', flexDirection: 'column' },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '6px 8px',
    borderRadius: tokens.borderRadiusMedium,
    cursor: 'pointer',
    ':hover': { backgroundColor: tokens.colorNeutralBackground1Hover },
  },
  rank: { width: '20px', textAlign: 'right', color: tokens.colorNeutralForeground3, fontVariantNumeric: 'tabular-nums' },
  itemBody: { display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 },
  ellipsis: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  score: { fontVariantNumeric: 'tabular-nums', fontWeight: tokens.fontWeightSemibold },
});

export default function HomePage() {
  const s = useStyles();
  const v = useVersion();
  const { data, error, loading } = useAsync(async () => {
    const [thisYear, allTime, directors, animators, tiers] = await Promise.all([
      getTopWorks({ year: v.yearMax, limit: 10 }),
      getTopWorks({ limit: 10 }),
      getTopStaff('director', 10),
      getTopStaff('sakkan', 10),
      getTierCounts(),
    ]);
    return { thisYear, allTime, directors, animators, tiers: Object.fromEntries(tiers.map((t) => [t.tier, t.n])) };
  }, [v.yearMax]);

  return (
    <div className={s.page}>
      <div className={s.intro}>
        <Title2>アニメ作品と制作スタッフの評価データベース</Title2>
        <Body1 className={s.muted}>
          作品の評価を年代ごとに補正した偏差値と、監督・脚本・作画などのスタッフが参加作品で残した実績をまとめています。
        </Body1>
      </div>

      <div className={s.stats}>
        <Stat label="作品"><BigNumber>{fmtInt(v.totalWorks)}</BigNumber></Stat>
        <Stat label="スタッフ"><BigNumber>{fmtInt(v.totalStaff)}</BigNumber></Stat>
        <Stat label="声優"><BigNumber>{fmtInt(v.totalCv)}</BigNumber></Stat>
        <Stat label="収録年"><BigNumber>{v.yearMin}–{v.yearMax}</BigNumber></Stat>
        <Stat label="データ更新" sub="毎週月曜に更新"><BigNumber>{v.dataUpdatedAt.slice(0, 10)}</BigNumber></Stat>
      </div>

      {error ? <ErrorBox error={error} /> : null}
      {loading && <Loading />}
      {data && (
        <>
          <Section title="評価のある作品の Tier 内訳" info="偏差値の上位から S+・S・A+… と区切ったもの">
            <TierBar counts={data.tiers} />
          </Section>
          <div className={s.grid}>
            <WorkList title={`${v.yearMax}年の上位作品`} rows={data.thisYear} more={`/works?yf=${v.yearMax}&yt=${v.yearMax}`} />
            <WorkList title="歴代の上位作品" rows={data.allTime} more="/works" />
            <StaffList title="総合実力の高い監督" rows={data.directors} more="/staff?role=director" />
            <StaffList title="総合実力の高い作画監督" rows={data.animators} more="/staff?role=sakkan" />
          </div>
        </>
      )}
    </div>
  );

}

function MoreButton({ to }: { to: string }) {
  const navigate = useNavigate();
  return (
    <Button appearance="transparent" size="small" icon={<ArrowRight16Regular />} iconPosition="after" onClick={() => navigate(to)}>
      もっと見る
    </Button>
  );
}

function WorkList({ title, rows, more }: { title: string; rows: WorkRow[]; more: string }) {
  const s = useStyles();
  const navigate = useNavigate();
  return (
    <Section title={title} actions={<MoreButton to={more} />}>
      <div className={s.list}>
        {rows.map((w, i) => (
          <div key={w.work_id} className={s.item} onClick={() => navigate(`/works/${encodeURIComponent(w.work_id)}`)}>
            <Text className={s.rank}>{i + 1}</Text>
            <Cover target={w.cover} width={30} />
            <div className={s.itemBody}>
              <Text weight="semibold" className={s.ellipsis}>{w.title}</Text>
              <Caption1 className={mergeClasses(s.muted, s.ellipsis)}>{w.year}{w.studio ? ` · ${w.studio}` : ''}</Caption1>
            </div>
            <TierBadge tier={w.tier} />
            <Text className={s.score}>{fmt(w.deviation_score)}</Text>
          </div>
        ))}
      </div>
    </Section>
  );
}

function StaffList({ title, rows, more }: { title: string; rows: LeaderboardRow[]; more: string }) {
  const s = useStyles();
  const navigate = useNavigate();
  return (
    <Section title={title} actions={<MoreButton to={more} />}>
      <div className={s.list}>
        {rows.map((r, i) => (
          <div key={r.name} className={s.item} onClick={() => navigate(`/staff/${encodeURIComponent(r.name)}`)}>
            <Text className={s.rank}>{i + 1}</Text>
            <div className={s.itemBody}>
              <Text weight="semibold" className={s.ellipsis}>{r.name}</Text>
              <Caption1 className={mergeClasses(s.muted, s.ellipsis)}>
                {r.works_count}作品{r.best_work_title ? ` · ${r.best_work_title}` : ''}
              </Caption1>
            </div>
            <TierBadge tier={r.rating_tier} />
            <Text className={s.score}>{fmt(r.bayesian_rating, 3)}</Text>
          </div>
        ))}
      </div>
    </Section>
  );
}
