import { Icon, type IconName } from './components/Icon';
import { StudentIdBar } from './components/StudentIdBar';
import { useHashRoute } from './hooks/useHashRoute';
import { StudentIdProvider } from './hooks/StudentIdProvider';
import { ClassListPage } from './pages/ClassListPage';
import { CreateClassPage } from './pages/CreateClassPage';
import { HoldPage } from './pages/HoldPage';
import { MyHoldsPage } from './pages/MyHoldsPage';

type NavItem = { path: string; label: string; icon: IconName };

const studentNav: NavItem[] = [
  { path: '/classes', label: 'Explore classes', icon: 'grid' },
  { path: '/me', label: 'My applications', icon: 'file' },
];

const adminNav: NavItem[] = [
  { path: '/admin', label: 'Admin dashboard', icon: 'building' },
];

function Page({ route }: { route: string }) {
  const hold = route.match(/^\/holds\/([^/]+)$/);
  if (hold) return <HoldPage holdId={decodeURIComponent(hold[1])} />;
  if (route === '/me') return <MyHoldsPage />;
  if (route === '/admin') return <CreateClassPage />;
  return <ClassListPage />;
}

function NavGroup({ label, items, route }: { label: string; items: NavItem[]; route: string }) {
  return (
    <div className="nav-group">
      <span className="nav-label">{label}</span>
      {items.map((item) => {
        const active = route === item.path ||
          (item.path === '/classes' && route === '/') ||
          (item.path === '/me' && route.startsWith('/holds/'));
        return (
          <a
            key={item.path}
            href={`#${item.path}`}
            className={`nav-link ${active ? 'active' : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            <Icon name={item.icon} />
            <span>{item.label}</span>
            {active && <span className="nav-active-dot" />}
          </a>
        );
      })}
    </div>
  );
}

export default function App() {
  const route = useHashRoute();
  const isAdmin = route === '/admin';
  const pageLabel = isAdmin
    ? 'Admin dashboard'
    : route === '/me'
      ? 'My applications'
      : route.startsWith('/holds/')
        ? 'Application details'
        : 'Explore classes';

  return (
    <StudentIdProvider>
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById('main-content')?.focus();
        }}
      >
        Skip to content
      </a>
      <aside className="sidebar">
        <a className="brand" href="#/classes" aria-label="School Admission home">
          <span className="brand-mark"><Icon name="graduate" /></span>
          <span>School Admission<small>Admissions made simple</small></span>
        </a>
        <nav aria-label="Main navigation">
          <NavGroup label="FOR FAMILIES" items={studentNav} route={route} />
          <NavGroup label="SCHOOL OFFICE" items={adminNav} route={route} />
        </nav>
        <div className="sidebar-note">
          <span className="sidebar-note-icon"><Icon name="sparkle" /></span>
          <h3>New to admissions?</h3>
          <p>Choose a class, reserve a seat, then confirm before your timer ends.</p>
          <a href="#/classes">See available classes <Icon name="arrow" /></a>
        </div>
        <div className="sidebar-footer"><span className="status-dot" /> Seat counts update live</div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumbs"><span>School Admission</span><span className="breadcrumb-slash">/</span><strong>{pageLabel}</strong></div>
          <span className="topbar-pill"><span className="status-dot" /> Admissions portal</span>
        </header>
        <main id="main-content" tabIndex={-1} className={isAdmin ? 'admin-main' : undefined}>
          {!isAdmin && <StudentIdBar />}
          <Page key={route} route={route} />
          <footer className="main-footer">
            <span><Icon name="graduate" /> School Admission</span>
            <span>Questions about your reservation? Check My applications.</span>
          </footer>
        </main>
      </div>
    </StudentIdProvider>
  );
}
