import { Link } from 'react-router-dom';

export default function MyDashboardPage() {
  return (
    <div
      style={{
        maxWidth: 980,
        margin: '0 auto',
        padding: '20px 14px 28px',
      }}
    >
      <header style={{ textAlign: 'center' }}>
        <h1>My Dashboard</h1>
      </header>

      <nav
        aria-label="Personal dashboard"
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        {[
          { label: 'Overview', to: '/dashboard' },
          { label: 'My Predictions', to: '/predictions' },
        ].map(({ label, to }) => {
          const active = to === '/dashboard';

          return (
            <Link
              key={to}
              to={to}
              aria-current={active ? 'page' : undefined}
              style={{
                border: active ? '1px solid #111827' : '1px solid #d1d5db',
                background: active ? '#111827' : '#fff',
                color: active ? '#fff' : '#374151',
                borderRadius: 6,
                padding: '0.55rem 1rem',
                fontSize: '0.9rem',
                fontWeight: 600,
                textDecoration: 'none',
                boxShadow: active
                  ? '0 4px 10px rgba(15, 23, 42, 0.18)'
                  : 'none',
              }}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
