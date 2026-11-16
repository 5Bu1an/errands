// US-18: "My rides / my tasks" dashboard: my listings and my requests in one place.
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatTime } from '../../api';
import ListingCard from './ListingCard';

const VIEWS = [
  ['ALL', 'All'],
  ['RIDE', 'My rides'],
  ['TASK', 'My tasks'],
];

function pendingText(listing) {
  const count = listing._count?.requests ?? 0;
  return count ? ` · ${count} pending request${count > 1 ? 's' : ''}` : '';
}

export default function DashboardPage() {
  const [listings, setListings] = useState([]);
  const [requests, setRequests] = useState([]);
  const [view, setView] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api('/listings/mine'), api('/requests/mine')])
      .then(([mine, sent]) => {
        setListings(mine.listings);
        setRequests(sent.requests);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <main className="page"><p className="empty">Loading...</p></main>;

  const shownListings = view === 'ALL' ? listings : listings.filter((l) => l.type === view);
  const shownRequests = view === 'ALL' ? requests : requests.filter((r) => r.listing.type === view);
  const kind = view === 'RIDE' ? 'rides' : view === 'TASK' ? 'tasks' : 'anything';

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <h1>My errands</h1>
          <p className="subtitle">Everything you posted and everything you asked to join</p>
        </div>
        <Link to="/listings/new" className="btn">+ Post a listing</Link>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="toggle" role="tablist">
        {VIEWS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={view === value}
            className={view === value ? 'on' : ''}
            onClick={() => setView(value)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <section>
          <h2>Posted by me ({shownListings.length})</h2>
          {shownListings.length === 0 && (
            <div className="card empty">You haven't posted {kind} yet.</div>
          )}
          {shownListings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} extra={pendingText(listing)} />
          ))}
        </section>

        <section>
          <h2>Requested by me ({shownRequests.length})</h2>
          {shownRequests.length === 0 && (
            <div className="card empty">You haven't requested {kind} yet.</div>
          )}
          {shownRequests.map((request) => (
            <div key={request.id} className="card">
              <div className="row">
                <span className={`badge ${request.listing.type === 'RIDE' ? '' : 'task'}`}>{request.listing.type}</span>
                <span className={`badge ${request.status}`} style={{ marginLeft: 'auto' }}>{request.status}</span>
              </div>
              <h3><Link to={`/listings/${request.listingId}`}>{request.listing.title}</Link></h3>
              <p className="meta">
                {formatTime(request.listing.time)} · Your pickup: {request.pickupLocation}
              </p>
              {request.listing.user?.name && (
                <p className="meta">Posted by {request.listing.user.name}</p>
              )}
              {['PENDING', 'ACCEPTED'].includes(request.status) && (
                <div className="row" style={{ marginTop: 8 }}>
                  <Link to={`/requests/${request.id}/chat`} className="btn secondary small">Chat</Link>
                </div>
              )}
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
