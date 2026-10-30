import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import {
  Body1, Button, Caption1, FluentProvider, makeStyles, NavDrawer, NavDrawerBody, NavDrawerHeader, NavItem,
  NavSectionHeader, ProgressBar, SearchBox, Title2, Title3, tokens, Tooltip, webDarkTheme, webLightTheme,
} from '@fluentui/react-components';
import {
  Building20Filled, Building20Regular, bundleIcon, Home20Filled, Home20Regular, Info20Filled, Info20Regular,
  Library20Filled, Library20Regular, People20Filled, People20Regular, WeatherMoon20Regular, WeatherSunny20Regular,
} from '@fluentui/react-icons';
import { openDb } from './db/client';
import type { LoadPhase, VersionInfo } from './db/protocol';
import { ErrorBox } from './components/common';
import HomePage from './pages/HomePage';
import WorksPage from './pages/WorksPage';
import WorkDetailPage from './pages/WorkDetailPage';
import StaffPage from './pages/StaffPage';
import StaffDetailPage from './pages/StaffDetailPage';
import StudiosPage from './pages/StudiosPage';
import StudioDetailPage from './pages/StudioDetailPage';
import AboutPage from './pages/AboutPage';
import { VersionContext } from './lib/version';

const HomeIcon = bundleIcon(Home20Filled, Home20Regular);
const WorksIcon = bundleIcon(Library20Filled, Library20Regular);
const StaffIcon = bundleIcon(People20Filled, People20Regular);
const StudioIcon = bundleIcon(Building20Filled, Building20Regular);
const InfoIcon = bundleIcon(Info20Filled, Info20Regular);

const useStyles = makeStyles({
  root: { display: 'flex', height: '100vh', backgroundColor: tokens.colorNeutralBackground2 },
  nav: { flexShrink: 0 },
  brand: { display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 4px 12px' },
  logo: { width: '28px', height: '28px' },
  main: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 32px',
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  search: { width: '420px', maxWidth: '50vw' },
  spacer: { flex: 1 },
  content: { flex: 1, overflowY: 'auto', padding: '24px 32px 48px' },
  inner: { maxWidth: '1400px', margin: '0 auto' },
  loading: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    backgroundColor: tokens.colorNeutralBackground2,
    padding: '24px',
  },
  loadingCard: {
    width: '480px',
    maxWidth: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    padding: '28px 32px',
    borderRadius: tokens.borderRadiusXLarge,
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow16,
  },
  muted: { color: tokens.colorNeutralForeground3 },
  navFoot: { padding: '12px 16px', color: tokens.colorNeutralForeground3 },
});

type ThemeMode = 'light' | 'dark';

function initialTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    /* 保存領域が使えない環境 */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

const PHASE_LABEL: Record<LoadPhase, string> = {
  version: 'データの情報を確認しています…',
  cache: '保存済みのデータを読み込んでいます…',
  download: 'データをダウンロードしています…',
  unpack: 'データを展開しています…',
  save: 'ブラウザに保存しています…',
  open: 'データベースを開いています…',
};

export default function App() {
  const [theme, setTheme] = useState<ThemeMode>(initialTheme);
  const [version, setVersion] = useState<VersionInfo | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [progress, setProgress] = useState<{ phase: LoadPhase; loaded?: number; total?: number }>({ phase: 'version' });

  useEffect(() => {
    openDb((phase, loaded, total) => setProgress({ phase, loaded, total })).then(setVersion, setError);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try {
      localStorage.setItem('theme', next);
    } catch {
      /* 保存できなくても切り替えはできる */
    }
  };

  return (
    <FluentProvider theme={theme === 'dark' ? webDarkTheme : webLightTheme} style={{ height: '100%' }}>
      {version ? (
        <VersionContext.Provider value={version}>
          <Shell theme={theme} onToggleTheme={toggleTheme} />
        </VersionContext.Provider>
      ) : (
        <LoadingScreen progress={progress} error={error} />
      )}
    </FluentProvider>
  );
}

function LoadingScreen({ progress, error }: { progress: { phase: LoadPhase; loaded?: number; total?: number }; error: unknown }) {
  const s = useStyles();
  const pct = progress.phase === 'download' && progress.total ? Math.min(1, (progress.loaded ?? 0) / progress.total) : undefined;
  return (
    <div className={s.loading}>
      <div className={s.loadingCard}>
        <div className={s.brand}>
          <img src="./favicon.svg" className={s.logo} alt="" />
          <Title3>CreditDB</Title3>
        </div>
        {error ? (
          <ErrorBox error={error} />
        ) : (
          <>
            <Body1>{PHASE_LABEL[progress.phase]}</Body1>
            <ProgressBar value={pct} thickness="large" />
            {progress.phase === 'download' && progress.total ? (
              <Caption1 className={s.muted}>
                {((progress.loaded ?? 0) / 1e6).toFixed(1)} / {(progress.total / 1e6).toFixed(1)} MB
              </Caption1>
            ) : null}
            <Caption1 className={s.muted}>
              初回とデータ更新時（週1回）だけ約 {progress.total ? Math.round(progress.total / 1e6) : 40} MB をダウンロードします。
              以降はブラウザに保存したデータを使うので、すぐに開きます。
            </Caption1>
          </>
        )}
      </div>
    </div>
  );
}

const NAV = [
  { value: '/', label: 'ホーム', icon: <HomeIcon /> },
  { value: '/works', label: '作品', icon: <WorksIcon /> },
  { value: '/staff', label: 'スタッフ', icon: <StaffIcon /> },
  { value: '/studios', label: 'スタジオ', icon: <StudioIcon /> },
];

function Shell({ theme, onToggleTheme }: { theme: ThemeMode; onToggleTheme: () => void }) {
  const s = useStyles();
  const navigate = useNavigate();
  const location = useLocation();
  const [q, setQ] = useState('');
  const section = '/' + (location.pathname.split('/')[1] ?? '');

  // ページを移ったら先頭から表示する
  useEffect(() => {
    document.getElementById('content')?.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className={s.root}>
      <NavDrawer
        open
        type="inline"
        className={s.nav}
        selectedValue={section === '/about' ? '/about' : section}
        onNavItemSelect={(_, d) => navigate(String(d.value))}
      >
        <NavDrawerHeader>
          <div className={s.brand}>
            <img src="./favicon.svg" className={s.logo} alt="" />
            <Title2 as="h1" style={{ fontSize: 20 }}>CreditDB</Title2>
          </div>
        </NavDrawerHeader>
        <NavDrawerBody>
          {NAV.map((n) => (
            <NavItem key={n.value} value={n.value} icon={n.icon}>
              {n.label}
            </NavItem>
          ))}
          <NavSectionHeader>情報</NavSectionHeader>
          <NavItem value="/about" icon={<InfoIcon />}>
            指標の解説
          </NavItem>
        </NavDrawerBody>
      </NavDrawer>
      <div className={s.main}>
        <header className={s.header}>
          <SearchBox
            className={s.search}
            placeholder="作品名で検索（Enter）"
            value={q}
            onChange={(_, d) => setQ(d.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && q.trim()) navigate(`/works?q=${encodeURIComponent(q.trim())}`);
            }}
          />
          <div className={s.spacer} />
          <Tooltip content={theme === 'dark' ? 'ライトテーマにする' : 'ダークテーマにする'} relationship="label">
            <Button
              appearance="subtle"
              icon={theme === 'dark' ? <WeatherSunny20Regular /> : <WeatherMoon20Regular />}
              onClick={onToggleTheme}
            />
          </Tooltip>
        </header>
        <main id="content" className={s.content}>
          <div className={s.inner}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/works" element={<WorksPage />} />
              <Route path="/works/:id" element={<WorkDetailPage />} />
              <Route path="/staff" element={<StaffPage />} />
              <Route path="/staff/:name" element={<StaffDetailPage />} />
              <Route path="/studios" element={<StudiosPage />} />
              <Route path="/studios/:name" element={<StudioDetailPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
}
