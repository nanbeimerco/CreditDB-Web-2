import { type ReactNode, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Body1Strong, Button, Caption1, InfoLabel, Link, makeStyles, mergeClasses, Spinner, Subtitle2, Text, Title3, tokens,
  MessageBar, MessageBarBody,
} from '@fluentui/react-components';
import { ChevronLeft20Regular, ChevronRight20Regular, ImageOff20Regular } from '@fluentui/react-icons';
import { TIER_COLOR, verdictInfo } from '../lib/labels';
import { coverUrl, fmtInt } from '../lib/text';

const useStyles = makeStyles({
  tier: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '28px',
    height: '20px',
    padding: '0 6px',
    borderRadius: tokens.borderRadiusMedium,
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase200,
    color: '#1b1b1b',
    boxSizing: 'border-box',
    flexShrink: 0,
  },
  tierLarge: { minWidth: '44px', height: '32px', fontSize: tokens.fontSizeBase500, borderRadius: tokens.borderRadiusLarge },
  tierNone: {
    color: tokens.colorNeutralForeground3,
    backgroundColor: tokens.colorNeutralBackground3,
  },
  cover: {
    display: 'block',
    objectFit: 'cover',
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground3,
    flexShrink: 0,
  },
  coverEmpty: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: tokens.colorNeutralForeground4,
  },
  stat: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    padding: '12px 16px',
    borderRadius: tokens.borderRadiusLarge,
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow2,
    minWidth: '140px',
  },
  statValue: { display: 'flex', alignItems: 'center', gap: '8px', minHeight: '32px' },
  statLabel: { color: tokens.colorNeutralForeground3, display: 'flex', alignItems: 'center' },
  pager: { display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end', padding: '8px 0' },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    padding: '20px 24px',
    borderRadius: tokens.borderRadiusXLarge,
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow4,
  },
  sectionHead: { display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'space-between', flexWrap: 'wrap' },
  center: { display: 'flex', justifyContent: 'center', padding: '48px' },
  verdict: {
    display: 'inline-flex',
    alignItems: 'center',
    height: '20px',
    padding: '0 8px',
    borderRadius: tokens.borderRadiusCircular,
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    whiteSpace: 'nowrap',
  },
  above: { backgroundColor: tokens.colorPaletteGreenBackground2, color: tokens.colorPaletteGreenForeground2 },
  below: { backgroundColor: tokens.colorPaletteRedBackground2, color: tokens.colorPaletteRedForeground2 },
  as_expected: { backgroundColor: tokens.colorNeutralBackground3, color: tokens.colorNeutralForeground2 },
  new: { backgroundColor: tokens.colorPaletteBlueBackground2, color: tokens.colorPaletteBlueForeground2 },
  archive: { color: tokens.colorNeutralForeground4 },
});

export function TierBadge({ tier, large, title }: { tier?: string | null; large?: boolean; title?: string }) {
  const s = useStyles();
  const color = tier ? TIER_COLOR[tier] : undefined;
  return (
    <span
      className={mergeClasses(s.tier, large && s.tierLarge, !color && s.tierNone)}
      style={color ? { backgroundColor: color } : undefined}
      title={title}
    >
      {color ? tier : '—'}
    </span>
  );
}

export function VerdictBadge({ verdict }: { verdict: string }) {
  const s = useStyles();
  const v = verdictInfo(verdict);
  return (
    <span className={mergeClasses(s.verdict, s[v.kind])} title={v.long}>
      {v.label}
    </span>
  );
}

export function Cover({ target, width, size = 'small' }: { target: string | null; width: number; size?: 'small' | 'medium' | 'large' }) {
  const s = useStyles();
  const [failed, setFailed] = useState(false);
  const url = coverUrl(target, size);
  const style = { width, height: Math.round(width * 1.41) };
  if (!url || failed) {
    return (
      <div className={mergeClasses(s.cover, s.coverEmpty)} style={style}>
        <ImageOff20Regular />
      </div>
    );
  }
  return (
    <img
      className={s.cover}
      style={style}
      src={url}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

export function Stat({ label, help, children, sub }: { label: string; help?: string; children: ReactNode; sub?: ReactNode }) {
  const s = useStyles();
  return (
    <div className={s.stat}>
      <Caption1 className={s.statLabel}>
        {help ? <InfoLabel info={help} size="small">{label}</InfoLabel> : label}
      </Caption1>
      <div className={s.statValue}>{children}</div>
      {sub && <Caption1 className={s.statLabel}>{sub}</Caption1>}
    </div>
  );
}

export function BigNumber({ children }: { children: ReactNode }) {
  return <Title3>{children}</Title3>;
}

export function Pager({ page, pageSize, total, onChange }: { page: number; pageSize: number; total: number; onChange: (p: number) => void }) {
  const s = useStyles();
  const last = Math.max(0, Math.ceil(total / pageSize) - 1);
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);
  return (
    <div className={s.pager}>
      <Text size={200}>
        {fmtInt(from)}–{fmtInt(to)} / {fmtInt(total)} 件
      </Text>
      <Button appearance="subtle" icon={<ChevronLeft20Regular />} disabled={page <= 0} onClick={() => onChange(page - 1)} aria-label="前のページ" />
      <Text size={200}>
        {page + 1} / {last + 1}
      </Text>
      <Button appearance="subtle" icon={<ChevronRight20Regular />} disabled={page >= last} onClick={() => onChange(page + 1)} aria-label="次のページ" />
    </div>
  );
}

export function Section({ title, info, actions, children }: { title: ReactNode; info?: string; actions?: ReactNode; children: ReactNode }) {
  const s = useStyles();
  return (
    <section className={s.section}>
      <div className={s.sectionHead}>
        <Subtitle2>{info ? <InfoLabel info={info}>{title}</InfoLabel> : title}</Subtitle2>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function Loading({ label }: { label?: string }) {
  const s = useStyles();
  return (
    <div className={s.center}>
      <Spinner label={label ?? '読み込み中…'} />
    </div>
  );
}

export function ErrorBox({ error }: { error: unknown }) {
  return (
    <MessageBar intent="error">
      <MessageBarBody>{error instanceof Error ? error.message : String(error)}</MessageBarBody>
    </MessageBar>
  );
}

export function NotFound({ what }: { what: string }) {
  const s = useStyles();
  return (
    <div className={s.center}>
      <Body1Strong>{what}が見つかりませんでした</Body1Strong>
    </div>
  );
}

export function WorkLink({ id, children }: { id: string; children: ReactNode }) {
  return (
    <Link as="a" href={`#/works/${encodeURIComponent(id)}`} onClick={(e) => e.stopPropagation()}>
      {children}
    </Link>
  );
}

export function PersonLink({ name, children }: { name: string; children?: ReactNode }) {
  return (
    <Link as="a" href={`#/staff/${encodeURIComponent(name)}`} onClick={(e) => e.stopPropagation()}>
      {children ?? name}
    </Link>
  );
}

export function StudioLink({ name }: { name: string }) {
  return (
    <Link as="a" href={`#/studios/${encodeURIComponent(name)}`} onClick={(e) => e.stopPropagation()}>
      {name}
    </Link>
  );
}

export { RouterLink };
