// 軽い SVG のグラフ。色は Fluent のトークン（CSS 変数）を使い、ライト・ダークの両方で読めるようにする
import { useNavigate } from 'react-router-dom';
import { tokens } from '@fluentui/react-components';
import type { CareerEntry, EpisodeScore } from '../db/repo';
import { roleLabel, TIER_COLOR, TIERS } from '../lib/labels';

const axisText = { fill: tokens.colorNeutralForeground3, fontSize: 11 } as const;
const gridLine = { stroke: tokens.colorNeutralStroke2, strokeWidth: 1 } as const;

export function EpisodeChart({ data }: { data: EpisodeScore[] }) {
  const W = 880, H = 220, L = 36, R = 12, T = 12, B = 28;
  const min = Math.max(0, Math.floor(Math.min(...data.map((d) => d.rating)) - 0.5));
  const max = 10;
  const avg = data.reduce((s, d) => s + d.rating, 0) / data.length;
  const iw = W - L - R, ih = H - T - B;
  const bw = iw / data.length;
  const y = (v: number) => T + ih - ((v - min) / (max - min)) * ih;
  const ticks = [];
  for (let v = Math.ceil(min); v <= max; v++) ticks.push(v);
  const labelEvery = Math.ceil(data.length / 26);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="各話の IMDb 評価">
      {ticks.map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} style={gridLine} />
          <text x={L - 6} y={y(v) + 4} textAnchor="end" style={axisText}>{v}</text>
        </g>
      ))}
      {data.map((d, i) => (
        <g key={d.episode}>
          <rect
            x={L + i * bw + bw * 0.15}
            y={y(d.rating)}
            width={Math.max(1, bw * 0.7)}
            height={T + ih - y(d.rating)}
            rx={2}
            style={{ fill: d.rating >= avg ? tokens.colorBrandBackground : tokens.colorBrandBackground2Hover }}
          >
            <title>{`第${d.episode}話  ${d.rating.toFixed(1)}（${d.votes.toLocaleString()}票）`}</title>
          </rect>
          {i % labelEvery === 0 && (
            <text x={L + i * bw + bw / 2} y={H - 10} textAnchor="middle" style={axisText}>{d.episode}</text>
          )}
        </g>
      ))}
      <line x1={L} x2={W - R} y1={y(avg)} y2={y(avg)} style={{ stroke: tokens.colorPaletteMarigoldBorderActive, strokeDasharray: '4 4' }} />
      <text x={L + 4} y={T + 10} textAnchor="start" style={{ ...axisText, fill: tokens.colorPaletteMarigoldForeground2 }}>
        - - 平均 {avg.toFixed(2)}
      </text>
    </svg>
  );
}

// 役職ごとの点の色（よく出る役職だけ色を分け、ほかはまとめる）
const ROLE_COLORS: Record<string, string> = {
  director: tokens.colorPaletteBerryForeground2,
  series_comp: tokens.colorPalettePurpleForeground2,
  unit_director: tokens.colorPaletteBlueForeground2,
  sakkan: tokens.colorPaletteDarkOrangeForeground2,
  genga: tokens.colorPaletteGreenForeground2,
  genga_2nd: tokens.colorPaletteLightGreenForeground2,
  char_design: tokens.colorPaletteMagentaForeground2,
  cv: tokens.colorPaletteTealForeground2,
  music: tokens.colorPaletteMarigoldForeground2,
  art_dir: tokens.colorPaletteSteelForeground2,
};

export function CareerChart({ data }: { data: CareerEntry[] }) {
  const navigate = useNavigate();
  const pts = data.filter((d) => d.tier !== '-');
  if (pts.length === 0) return null;
  const W = 880, H = 260, L = 36, R = 12, T = 12, B = 28;
  const years = pts.map((d) => d.year);
  const x0 = Math.min(...years) - 1, x1 = Math.max(...years) + 1;
  const y0 = 20, y1 = 85;
  const iw = W - L - R, ih = H - T - B;
  const x = (v: number) => L + ((v - x0) / (x1 - x0)) * iw;
  const y = (v: number) => T + ih - ((Math.min(y1, Math.max(y0, v)) - y0) / (y1 - y0)) * ih;
  const step = x1 - x0 > 40 ? 10 : 5;
  const xt: number[] = [];
  for (let v = Math.ceil(x0 / step) * step; v <= x1; v += step) xt.push(v);
  const roles = [...new Set(pts.map((d) => d.roles[0].role))];
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="参加作品の年と偏差値">
        {[30, 40, 50, 60, 70, 80].map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} style={v === 50 ? { ...gridLine, stroke: tokens.colorNeutralStroke1 } : gridLine} />
            <text x={L - 6} y={y(v) + 4} textAnchor="end" style={axisText}>{v}</text>
          </g>
        ))}
        {xt.map((v) => (
          <text key={v} x={x(v)} y={H - 8} textAnchor="middle" style={axisText}>{v}</text>
        ))}
        {pts.map((d) => (
          <circle
            key={d.work_id}
            cx={x(d.year)}
            cy={y(d.deviation_score)}
            r={5}
            style={{ fill: ROLE_COLORS[d.roles[0].role] ?? tokens.colorNeutralForeground3, fillOpacity: 0.75, cursor: 'pointer' }}
            onClick={() => navigate(`/works/${encodeURIComponent(d.work_id)}`)}
          >
            <title>{`${d.year}  ${d.title}\n偏差値 ${d.deviation_score.toFixed(1)}（${d.roles.map((r) => roleLabel(r.role)).join('・')}）`}</title>
          </circle>
        ))}
      </svg>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', paddingLeft: L, fontSize: 12, color: tokens.colorNeutralForeground3 }}>
        {roles.map((r) => (
          <span key={r} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 5, background: ROLE_COLORS[r] ?? tokens.colorNeutralForeground3 }} />
            {roleLabel(r)}
          </span>
        ))}
      </div>
    </div>
  );
}

export function TierBar({ counts }: { counts: Record<string, number> }) {
  const total = TIERS.reduce((s, t) => s + (counts[t] ?? 0), 0);
  if (total === 0) return null;
  return (
    <div>
      <div style={{ display: 'flex', height: 14, borderRadius: 7, overflow: 'hidden' }}>
        {TIERS.map((t) =>
          counts[t] ? (
            <div key={t} title={`${t}: ${counts[t]}作品`} style={{ width: `${(counts[t] / total) * 100}%`, background: TIER_COLOR[t] }} />
          ) : null,
        )}
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 6, fontSize: 12, color: tokens.colorNeutralForeground3 }}>
        {TIERS.map((t) => (
          <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: TIER_COLOR[t] }} />
            {t} {counts[t] ?? 0}
          </span>
        ))}
      </div>
    </div>
  );
}
