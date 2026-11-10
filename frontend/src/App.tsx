import { StudentIdBar } from './components/StudentIdBar';
import { useHashRoute } from './hooks/useHashRoute';
import { StudentIdProvider } from './hooks/useStudentId';
import { ClassListPage } from './pages/ClassListPage';
import { CreateClassPage } from './pages/CreateClassPage';
import { HoldPage } from './pages/HoldPage';
import { MyHoldsPage } from './pages/MyHoldsPage';
import { Icon, type IconName } from './components/Icon';

const TABS = [
  { path: '/classes', label: 'Browse classes', icon: 'grid' as IconName },
  { path: '/me', label: 'My applications', icon: 'file' as IconName },
  { path: '/admin', label: 'Create a class', icon: 'plus' as IconName },
];

function Page({ route }: { route: string }) {
  const hold = route.match(/^\/holds\/([^/]+)$/);
  if (hold) return <HoldPage holdId={decodeURIComponent(hold[1])} />;
  if (route === '/me') return <MyHoldsPage />;
  if (route === '/admin') return <CreateClassPage />;
  return <ClassListPage />;
}

export default function App() {
  const route = useHashRoute();
  return (
    <StudentIdProvider>
      <a className="skip-link" href="#main-content" onClick={(e) => { e.preventDefault(); document.getElementById('main-content')?.focus(); }}>Skip to content</a>
      <aside className="sidebar">
        <a className="brand" href="#/classes" aria-label="School Admission home">
          <span className="brand-mark"><Icon name="school" /></span>
          <span>School Admission<small>A place to begin.</small></span>
        </a>
        <div className="nav-label">ADMISSION PORTAL</div>
        <nav aria-label="Main navigation">
          {TABS.map((t) => {
            const active = route === t.path || (t.path === '/classes' && route === '/') || (t.path === '/me' && route.startsWith('/holds/'));
            return <a key={t.path} href={`#${t.path}`} className={active ? 'active' : ''} aria-current={active ? 'page' : undefined}>
              <Icon name={t.icon} />{t.label}{t.path === '/admin' && <span className="admin-tag">Admin</span>}
            </a>;
          })}
        </nav>
        <div className="sidebar-note">
          <span className="note-icon"><Icon name="book" /></span>
          <h3>A little preparation.<br />A big step forward.</h3>
          <p>Keep the student's birth registration number ready to begin their application.</p>
          <a href="#/classes">Explore classes <Icon name="arrow" /></a>
        </div>
        <div className="sidebar-footer"><span className="status-dot" />Simple steps. Bright futures.</div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div><span className="muted">Admission portal</span><span className="breadcrumb-slash">/</span><strong>{route === '/admin' ? 'Create a class' : route === '/me' ? 'My applications' : route.startsWith('/holds/') ? 'Application details' : 'Browse classes'}</strong></div>
          <span className="topbar-note"><Icon name="school" /> Your next chapter starts here</span>
        </header>
        <main id="main-content" tabIndex={-1}>
          <StudentIdBar />
          <Page key={route} route={route} />
          <footer className="main-footer"><span>School Admission</span><span>Every great journey begins with a first step.</span></footer>
        </main>
      </div>
    </StudentIdProvider>
  );
}
