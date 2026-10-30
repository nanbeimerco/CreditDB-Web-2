import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Badge, Body1, Button, Caption1, makeStyles, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow,
  Text, Title1, tokens, mergeClasses,
} from '@fluentui/react-components';
import { ArrowLeft20Regular } from '@fluentui/react-icons';
import { type Credit, getEpisodeScores, getKnownPeople, getWorkDetail } from '../db/repo';
import {
  BigNumber, Cover, ErrorBox, Loading, NotFound, PersonLink, Section, Stat, StudioLink, TierBadge, VerdictBadge,
} from '../components/common';
import { EpisodeChart } from '../components/charts';
import { predictedDev, roleLabel, verdictInfo, WORK_ROLE_ORDER } from '../lib/labels';
import { fmt, fmtInt, fmtSigned, formatEpisodes } from '../lib/text';
import { useAsync } from '../lib/useAsync';
import { usePageStyles } from './WorksPage';

const useStyles = makeStyles({
  hero: {
    display: 'flex',
    gap: '28px',
    padding: '24px',
    borderRadius: tokens.borderRadiusXLarge,
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow4,
  },
  heroBody: { display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0, flex: 1 },
  meta: { display: 'flex', gap: '8px 16px', flexWrap: 'wrap', alignItems: 'center', color: tokens.colorNeutralForeground2 },
  stats: { display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '12px' },
  roles: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' },
  roleCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    padding: '12px 14px',
    borderRadius: tokens.borderRadiusLarge,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  roleWide: { gridColumn: '1 / -1' },
  roleHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' },
  people: { display: 'flex', flexDirection: 'column', gap: '4px' },
  peopleWide: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '4px 16px' },
  person: { display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 },
  personName: { flexShrink: 0, maxWidth: '65%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  eps: { color: tokens.colorNeutralForeground3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  muted: { color: tokens.colorNeutralForeground3 },
});

const COLLAPSED = 24;

export default function WorkDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const ps = usePageStyles();
  const s = useStyles();

  const { data, error, loading } = useAsync(async () => {
    const work = await getWorkDetail(id);
    if (!work) return null;
    const names = [
      ...Object.entries(work.staff).filter(([r]) => r !== 'studio').flatMap(([, l]) => l.map((c) => c.name)),
      ...work.cast.map((c) => c.actor_name),
    ];
    const [episodes, known] = await Promise.all([getEpisodeScores(id), getKnownPeople(names)]);
    return { work, episodes, known };
  }, [id]);

  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  if (!data) return <NotFound what="作品" />;
  const { work, episodes, known } = data;
  const rated = work.tier !== '-';
  const pred = predictedDev(work);
  const v = verdictInfo(work.performance_verdict);
  const roles = WORK_ROLE_ORDER.filter((r) => r !== 'studio' && work.staff[r]?.length);
  const studios = work.staff.studio ?? [];

  return (
    <div className={ps.page}>
      <div>
        <Button appearance="subtle" icon={<ArrowLeft20Regular />} onClick={() => navigate(-1)}>
          戻る
        </Button>
      </div>

      <div className={s.hero}>
        <Cover target={work.cover} width={170} size="large" />
        <div className={s.heroBody}>
          <Title1>{work.title}</Title1>
          {work.title_en && <Body1 className={s.muted}>{work.title_en}</Body1>}
          <div className={s.meta}>
            <Text>{work.year}年</Text>
            {work.episodes ? <Text>全{work.episodes}話</Text> : null}
            {studios.map((st) => (
              <StudioLink key={st.name} name={st.name} />
            ))}
          </div>
          <div className={s.stats}>
            <Stat label="偏差値" help="年代ごとの評価の上がり方を補正した偏差値（平均50・標準偏差10）。古い作品と新しい作品を同じ物差しで比べられる。"
              sub={rated ? `全作品中 ${fmtInt(work.z_score_rank)} 位 · 上位 ${fmt(100 - work.percentile)}%` : '評価データがありません'}>
              <BigNumber>{rated ? fmt(work.deviation_score) : '—'}</BigNumber>
              <TierBadge tier={work.tier} large />
            </Stat>
            <Stat label="AniList 素点" help="AniList の平均スコア（100点満点）。新しい作品ほど高く出やすい。">
              <BigNumber>{work.anilist_raw_score > 0 ? fmt(work.anilist_raw_score, 0) : '—'}</BigNumber>
            </Stat>
            <Stat label="予測偏差値" help="参加スタッフの過去の実績から予測した偏差値（事前期待値）。"
              sub={pred !== null ? `実際との差 ${fmtSigned(work.deviation_score - pred)}` : v.long}>
              <BigNumber>{pred !== null ? fmt(pred) : '—'}</BigNumber>
            </Stat>
            <Stat label="判定" help="実際の評価が、スタッフから予測した評価をどれだけ上回ったか・下回ったか。">
              <VerdictBadge verdict={work.performance_verdict} />
            </Stat>
          </div>
        </div>
      </div>

      {episodes.length > 0 && (
        <Section title="各話の評価（IMDb）" info="IMDb で評価のある各話の平均点（10点満点）。棒にカーソルを合わせると票数が出ます。">
          <EpisodeChart data={episodes} />
        </Section>
      )}

      <Section title="スタッフ" info="名前の横の Tier は、その人のその役職での総合実力。担当話数がわかるものは話数も出しています。">
        {roles.length === 0 ? (
          <Text className={s.muted}>スタッフの情報がありません</Text>
        ) : (
          <div className={s.roles}>
            {roles.map((r) => (
              <RoleCard key={r} role={r} credits={work.staff[r]} known={known} />
            ))}
          </div>
        )}
      </Section>

      {work.cast.length > 0 && (
        <Section title={`キャラクターと声優（${work.cast.length}）`}>
          <Table size="small" aria-label="キャスト">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>キャラクター</TableHeaderCell>
                <TableHeaderCell style={{ width: 120 }}>区分</TableHeaderCell>
                <TableHeaderCell>声優</TableHeaderCell>
                <TableHeaderCell style={{ width: 80 }}>Tier</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {work.cast.map((c, i) => (
                <TableRow key={i}>
                  <TableCell>{c.character_name}</TableCell>
                  <TableCell>
                    <Badge appearance="tint" color={c.relation === '主角' ? 'brand' : 'informative'}>{relationLabel(c.relation)}</Badge>
                  </TableCell>
                  <TableCell>{known.has(c.actor_name) ? <PersonLink name={c.actor_name} /> : c.actor_name}</TableCell>
                  <TableCell><TierBadge tier={c.rt} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Section>
      )}
    </div>
  );
}

// Bangumi の区分（中国語）を日本語にする
function relationLabel(r: string): string {
  return ({ 主角: '主役', 配角: '脇役', 客串: 'ゲスト' } as Record<string, string>)[r] ?? r;
}

function RoleCard({ role, credits, known }: { role: string; credits: Credit[]; known: Set<string> }) {
  const s = useStyles();
  const [open, setOpen] = useState(false);
  const wide = credits.length > 12;
  const shown = open ? credits : credits.slice(0, COLLAPSED);
  return (
    <div className={mergeClasses(s.roleCard, wide && s.roleWide)}>
      <div className={s.roleHead}>
        <Text weight="semibold">{roleLabel(role)}</Text>
        <Caption1 className={s.muted}>{credits.length}人</Caption1>
      </div>
      <div className={wide ? s.peopleWide : s.people}>
        {shown.map((c) => {
          const eps = formatEpisodes(c.eps);
          return (
            <div key={c.name} className={s.person}>
              <TierBadge tier={c.rt} title={`総合実力 ${c.rt ?? '—'} / 累計実績 ${c.ct ?? '—'}`} />
              <span className={s.personName}>{known.has(c.name) ? <PersonLink name={c.name} /> : c.name}</span>
              {eps && <Caption1 className={s.eps} title={eps}>{eps}</Caption1>}
            </div>
          );
        })}
      </div>
      {credits.length > COLLAPSED && (
        <div>
          <Button appearance="transparent" size="small" onClick={() => setOpen(!open)}>
            {open ? '閉じる' : `すべて表示（あと${credits.length - COLLAPSED}人）`}
          </Button>
        </div>
      )}
    </div>
  );
}
