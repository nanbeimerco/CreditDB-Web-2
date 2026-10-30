import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Body1, Button, Caption1, Dropdown, makeStyles, MessageBar, MessageBarBody, Option, Table, TableBody, TableCell,
  TableHeader, TableHeaderCell, TableRow, Text, Title1, tokens,
} from '@fluentui/react-components';
import { ArrowLeft20Regular } from '@fluentui/react-icons';
import { getCareer, getProfile, getStaffMetrics, isNonPerson, type StaffMetric } from '../db/repo';
import { BigNumber, Cover, ErrorBox, Loading, Section, Stat, TierBadge } from '../components/common';
import { CareerChart } from '../components/charts';
import { METRIC_HELP, roleLabel } from '../lib/labels';
import { fmt, fmtInt, formatEpisodes } from '../lib/text';
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
  meta: { display: 'flex', gap: '8px 16px', flexWrap: 'wrap', color: tokens.colorNeutralForeground2 },
  stats: { display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '12px' },
  best: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '16px' },
  bestItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    cursor: 'pointer',
    padding: '8px',
    borderRadius: tokens.borderRadiusLarge,
    ':hover': { backgroundColor: tokens.colorNeutralBackground1Hover },
  },
  bestTitle: {
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    lineHeight: '1.3',
  },
  muted: { color: tokens.colorNeutralForeground3 },
  roleChips: { display: 'flex', flexWrap: 'wrap', gap: '4px 12px' },
  cell: { display: 'inline-flex', alignItems: 'center', gap: '8px', fontVariantNumeric: 'tabular-nums' },
});

export default function StaffDetailPage() {
  const { name = '' } = useParams();
  const navigate = useNavigate();
  const ps = usePageStyles();
  const s = useStyles();
  const [roleFilter, setRoleFilter] = useState('');

  const { data, error, loading } = useAsync(async () => {
    const [profile, metrics, career, company] = await Promise.all([
      getProfile(name), getStaffMetrics(name), getCareer(name), isNonPerson(name),
    ]);
    return { profile, metrics, career, company };
  }, [name]);

  const best = useMemo(
    () => (data?.career ?? []).filter((c) => c.tier !== '-').sort((a, b) => b.deviation_score - a.deviation_score).slice(0, 8),
    [data],
  );

  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  if (!data) return null;
  const { profile, metrics, career, company } = data;

  const metricOf = (role: string, m: StaffMetric['metric']) => metrics.find((x) => x.role === role && x.metric === m);
  const careerRoles = [...new Set(career.flatMap((c) => c.roles.map((r) => r.role)))];
  const shown = roleFilter ? career.filter((c) => c.roles.some((r) => r.role === roleFilter)) : career;
  const allContribution = metricOf('all', 'contribution');
  const allEpisode = metricOf('all', 'episode');

  return (
    <div className={ps.page}>
      <div>
        <Button appearance="subtle" icon={<ArrowLeft20Regular />} onClick={() => navigate(-1)}>戻る</Button>
      </div>

      <div className={s.hero}>
        <Title1>{name}</Title1>
        <div className={s.meta}>
          {profile && <Text>主な役職: {roleLabel(profile.primary_role)}</Text>}
          <Text>参加作品 {career.length}</Text>
          {profile?.first_year && <Text>活動期間 {profile.first_year}–{profile.latest_year}</Text>}
        </div>
        {company && (
          <MessageBar intent="info">
            <MessageBarBody>会社・団体の名前のため、個人のランキングには入れていません。</MessageBarBody>
          </MessageBar>
        )}
        {profile && (
          <div className={s.stats}>
            <Stat label="総合実力（全役職）" help={METRIC_HELP.rating} sub={`${fmtInt(profile.overall_rank)} 位`}>
              <BigNumber>{fmt(profile.bayesian_rating, 3)}</BigNumber>
              <TierBadge tier={profile.overall_rating_tier} large />
            </Stat>
            <Stat label="累計実績（全役職）" help={METRIC_HELP.cumulative} sub={`${fmtInt(profile.cumulative_rank)} 位`}>
              <BigNumber>{fmt(profile.career_cumulative_z, 1)}</BigNumber>
              <TierBadge tier={profile.overall_cum_tier} large />
            </Stat>
            {allContribution && (
              <Stat label="個人寄与度（全スタッフ）" help={METRIC_HELP.contribution} sub={`${fmtInt(allContribution.rank)} / ${fmtInt(allContribution.total)} 位`}>
                <BigNumber>{fmt(allContribution.value, 3)}</BigNumber>
                <TierBadge tier={allContribution.tier} large />
              </Stat>
            )}
            {allEpisode && (
              <Stat label="各話評価（全スタッフ）" help={METRIC_HELP.episode} sub={`${fmtInt(allEpisode.rank)} / ${fmtInt(allEpisode.total)} 位 · ${allEpisode.n}話`}>
                <BigNumber>{fmt(allEpisode.value, 3)}</BigNumber>
                <TierBadge tier={allEpisode.tier} large />
              </Stat>
            )}
          </div>
        )}
      </div>

      {profile && profile.roles.length > 0 && (
        <Section title="役職別の成績">
          <Table size="small" aria-label="役職別の成績">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>役職</TableHeaderCell>
                <TableHeaderCell style={{ width: 72 }} className={ps.num}>作品数</TableHeaderCell>
                <TableHeaderCell>総合実力</TableHeaderCell>
                <TableHeaderCell>累計実績</TableHeaderCell>
                <TableHeaderCell>個人寄与度</TableHeaderCell>
                <TableHeaderCell>各話評価</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...profile.roles].sort((a, b) => b.works_count - a.works_count).map((r) => {
                const c = metricOf(r.role, 'contribution');
                const e = metricOf(r.role, 'episode');
                return (
                  <TableRow key={r.role}>
                    <TableCell><Text weight="semibold">{roleLabel(r.role)}</Text></TableCell>
                    <TableCell className={ps.num}>{r.works_count}</TableCell>
                    <TableCell>
                      <span className={s.cell}>
                        <TierBadge tier={r.rating_tier} /> {fmt(r.bayesian_rating, 3)}
                        <Caption1 className={s.muted}>{fmtInt(r.rating_rank)} / {fmtInt(r.role_total)}位</Caption1>
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={s.cell}>
                        <TierBadge tier={r.cum_tier} /> {fmt(r.career_cumulative_z, 1)}
                        <Caption1 className={s.muted}>{fmtInt(r.cumulative_rank)}位</Caption1>
                      </span>
                    </TableCell>
                    <TableCell>{c ? <MetricInline m={c} /> : <Caption1 className={s.muted}>—</Caption1>}</TableCell>
                    <TableCell>{e ? <MetricInline m={e} /> : <Caption1 className={s.muted}>—</Caption1>}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Section>
      )}

      {best.length > 0 && (
        <Section title="代表作">
          <div className={s.best}>
            {best.map((w) => (
              <div key={w.work_id} className={s.bestItem} onClick={() => navigate(`/works/${encodeURIComponent(w.work_id)}`)}>
                <Cover target={w.cover} width={134} size="medium" />
                <Text weight="semibold" className={s.bestTitle}>{w.title}</Text>
                <span className={s.cell}>
                  <TierBadge tier={w.tier} />
                  <Caption1 className={s.muted}>{w.year} · {fmt(w.deviation_score)}</Caption1>
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {career.some((c) => c.tier !== '-') && (
        <Section title="経歴" info="参加作品を年と偏差値で並べたもの。点をクリックすると作品を開きます。">
          <CareerChart data={career} />
        </Section>
      )}

      <Section
        title={`参加作品（${shown.length}）`}
        actions={
          careerRoles.length > 1 ? (
            <Dropdown style={{ minWidth: 180 }} value={roleFilter ? roleLabel(roleFilter) : 'すべての役職'} selectedOptions={[roleFilter]}
              onOptionSelect={(_, d) => setRoleFilter(d.optionValue ?? '')}>
              <Option value="">すべての役職</Option>
              {careerRoles.map((r) => (
                <Option key={r} value={r}>{roleLabel(r)}</Option>
              ))}
            </Dropdown>
          ) : undefined
        }
      >
        {shown.length === 0 ? (
          <Body1 className={s.muted}>参加作品がありません</Body1>
        ) : (
          <Table size="small" aria-label="参加作品">
            <TableHeader>
              <TableRow>
                <TableHeaderCell style={{ width: 64 }}>年</TableHeaderCell>
                <TableHeaderCell>作品</TableHeaderCell>
                <TableHeaderCell>担当</TableHeaderCell>
                <TableHeaderCell style={{ width: 64 }}>Tier</TableHeaderCell>
                <TableHeaderCell style={{ width: 80 }} className={ps.num}>偏差値</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((c) => (
                <TableRow key={c.work_id} className={ps.row} onClick={() => navigate(`/works/${encodeURIComponent(c.work_id)}`)}>
                  <TableCell>{c.year}</TableCell>
                  <TableCell><Text weight="semibold">{c.title}</Text></TableCell>
                  <TableCell>
                    <div className={s.roleChips}>
                      {c.roles.map((r, i) => {
                        const eps = formatEpisodes(r.eps);
                        return (
                          <Caption1 key={i}>
                            {roleLabel(r.role)}
                            {r.character ? `：${r.character}` : ''}
                            {eps ? <span className={s.muted}>（{eps}）</span> : null}
                          </Caption1>
                        );
                      })}
                    </div>
                  </TableCell>
                  <TableCell><TierBadge tier={c.tier} /></TableCell>
                  <TableCell className={ps.num}>{c.tier !== '-' ? fmt(c.deviation_score) : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>
    </div>
  );
}

function MetricInline({ m }: { m: StaffMetric }) {
  const s = useStyles();
  return (
    <span className={s.cell}>
      <TierBadge tier={m.tier} /> {fmt(m.value, 3)}
      <Caption1 className={s.muted}>{fmtInt(m.rank)} / {fmtInt(m.total)}位</Caption1>
    </span>
  );
}
