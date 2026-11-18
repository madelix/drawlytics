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

      <nav aria-label="Personal dashboard" style={{ textAlign: 'center' }}>
        <span className="dl-nav-link dl-nav-link--active" aria-current="page">
          Overview
        </span>
        <Link to="/predictions" className="dl-nav-link">
          My Predictions
        </Link>
      </nav>
    </div>
  );
}
