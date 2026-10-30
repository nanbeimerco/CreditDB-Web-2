import {
  Body1, Caption1, Link, makeStyles, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Text, Title2,
  tokens, mergeClasses,
} from '@fluentui/react-components';
import { getMetricValidation } from '../db/repo';
import { Section } from '../components/common';
import { METRIC_HELP, roleLabel } from '../lib/labels';
import { fmt } from '../lib/text';
import { useAsync } from '../lib/useAsync';
import { useVersion } from '../lib/version';

const useStyles = makeStyles({
  page: { display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '960px' },
  dl: { display: 'grid', gridTemplateColumns: '160px 1fr', gap: '10px 20px', margin: 0 },
  dt: { fontWeight: tokens.fontWeightSemibold },
  dd: { margin: 0, color: tokens.colorNeutralForeground2 },
  muted: { color: tokens.colorNeutralForeground3 },
  num: { textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
  best: { fontWeight: tokens.fontWeightBold },
});

const METHODS: { key: string; label: string }[] = [
  { key: 'current', label: '旧方式（参加度なし）' },
  { key: 'participation', label: '総合実力' },
  { key: 'contribution', label: '個人寄与度' },
  { key: 'contribution_people', label: '寄与度の人の部分だけ' },
];

export default function AboutPage() {
  const s = useStyles();
  const v = useVersion();
  const { data } = useAsync(getMetricValidation, []);

  const roles = [...new Set((data ?? []).filter((r) => r.method === 'current').map((r) => r.role))];
  const value = (role: string, method: string) => data?.find((r) => r.role === role && r.method === method)?.pearson ?? null;
  const episodeRows = (data ?? []).filter((r) => r.method === 'episode');

  return (
    <div className={s.page}>
      <Title2>指標の解説</Title2>

      <Section title="作品の指標">
        <dl className={s.dl}>
          <dt className={s.dt}>偏差値</dt>
          <dd className={s.dd}>
            AniList のスコアを、票の少なさ（ベイズ縮小）と年代ごとの点の上がり方を補正してから、同じ年代の作品の中での位置に直したもの。
            平均 50・標準偏差 10。1980年代の作品と2020年代の作品を同じ物差しで比べられます。
          </dd>
          <dt className={s.dt}>Tier</dt>
          <dd className={s.dd}>偏差値の上位から S+・S・A+・A・B+・B・C・D に区切ったもの。評価データのない作品は「—」です。</dd>
          <dt className={s.dt}>AniList 素点</dt>
          <dd className={s.dd}>AniList の平均スコアそのまま（100点満点）。新しい作品ほど高く出やすい点に注意してください。</dd>
          <dt className={s.dt}>予測偏差値・判定</dt>
          <dd className={s.dd}>
            参加スタッフ（監督・構成・キャラデザ・作監・原画・演出・音楽・美術・声優・スタジオ）の過去の実績から予測した偏差値。
            実際の偏差値が予測を上回れば「期待以上」、下回れば「期待未達」です。古い作品と、検証用に取ってある最近の作品には予測がありません。
          </dd>
          <dt className={s.dt}>各話の評価</dt>
          <dd className={s.dd}>IMDb の各話の評価（10点満点）。IMDb と照合できた作品だけにあります。</dd>
        </dl>
      </Section>

      <Section title="スタッフの指標">
        <dl className={s.dl}>
          <dt className={s.dt}>総合実力</dt>
          <dd className={s.dd}>{METRIC_HELP.rating}</dd>
          <dt className={s.dt}>累計実績</dt>
          <dd className={s.dd}>{METRIC_HELP.cumulative}</dd>
          <dt className={s.dt}>個人寄与度</dt>
          <dd className={s.dd}>{METRIC_HELP.contribution}</dd>
          <dt className={s.dt}>各話評価</dt>
          <dd className={s.dd}>
            {METRIC_HELP.episode} 票の少ない話は軽く扱い、原画はその話の原画の人数で薄めています。担当者で各話の出来はほとんど予測できないため、参考値です。
          </dd>
        </dl>
      </Section>

      {roles.length > 0 && (
        <Section title="指標はどれだけ当たるか" info="ある年までの作品で各指標を計算し、それ以降の作品の偏差値をどれだけ言い当てられたか（相関係数 r）。1 に近いほどよく当たる。">
          <Table size="small" aria-label="指標の検証結果">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>役職</TableHeaderCell>
                <TableHeaderCell className={s.num} style={{ width: 70 }}>作品数</TableHeaderCell>
                {METHODS.map((m) => (
                  <TableHeaderCell key={m.key} className={s.num}>{m.label}</TableHeaderCell>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((role) => {
                const vals = METHODS.map((m) => value(role, m.key));
                const max = Math.max(...vals.map((x) => x ?? -1));
                return (
                  <TableRow key={role}>
                    <TableCell>{roleLabel(role)}</TableCell>
                    <TableCell className={s.num}>{data?.find((r) => r.role === role && r.method === 'current')?.n}</TableCell>
                    {vals.map((x, i) => (
                      <TableCell key={i} className={mergeClasses(s.num, x === max && s.best)}>{fmt(x, 3)}</TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {episodeRows.length > 0 && (
            <Caption1 className={s.muted}>
              各話の評価の予測: {episodeRows.map((r) => `${r.role} r = ${fmt(r.pearson, 3)}`).join(' / ')}（{episodeRows[0].n}話）
            </Caption1>
          )}
        </Section>
      )}

      <Section title="データについて">
        <dl className={s.dl}>
          <dt className={s.dt}>出典</dt>
          <dd className={s.dd}>
            <Link href="https://anilist.co" target="_blank" rel="noreferrer">AniList</Link>（作品情報・スコア・話数付きクレジット）、
            <Link href="https://bgm.tv" target="_blank" rel="noreferrer">Bangumi</Link>（制作クレジット・表紙画像）、
            <Link href="https://www.imdb.com" target="_blank" rel="noreferrer">IMDb</Link>（各話評価）
          </dd>
          <dt className={s.dt}>IMDb</dt>
          <dd className={s.dd}>Information courtesy of IMDb (https://www.imdb.com). Used with permission. 非商用での利用です。</dd>
          <dt className={s.dt}>更新</dt>
          <dd className={s.dd}>毎週月曜に自動で更新します。いまのデータ: {v.dataUpdatedAt}（{v.sourceTag}）</dd>
          <dt className={s.dt}>保存</dt>
          <dd className={s.dd}>
            データ（約 {Math.round(v.sizeCompressed / 1e6)} MB）はブラウザに保存し、次回からはダウンロードせずに開きます。
          </dd>
        </dl>
        <Body1 className={s.muted}>
          <Text>Android 版もあります: </Text>
          <Link href="https://github.com/nanbeimerco/CreditDB-Pro-Mobile/releases" target="_blank" rel="noreferrer">CreditDB PRO</Link>
        </Body1>
      </Section>
    </div>
  );
}
