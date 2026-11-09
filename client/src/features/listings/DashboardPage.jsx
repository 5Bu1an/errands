// US-18: "My rides / my tasks" dashboard: my listings and my requests in one place.
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatTime } from '../../api';
import ListingCard from './ListingCard';

export default function DashboardPage() {
  const [listings, setListings] = useState([]);
  const [requests, setRequests] = useState([]);
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

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <section>
          <h2>My listings ({listings.length})</h2>
          {listings.length === 0 && <div className="card empty">You haven't posted anything yet.</div>}
          {listings.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              extra={
                listing._count?.requests
                  ? ` · ${listing._count.requests} pending request${listing._count.requests > 1 ? 's' : ''}`
                  : ''
              }
            />
          ))}
        </section>

        <section>
          <h2>My requests ({requests.length})</h2>
          {requests.length === 0 && <div className="card empty">You haven't requested anything yet.</div>}
          {requests.map((request) => (
            <Link key={request.id} to={`/listings/${request.listingId}`} className="card card-link">
              <div className="row">
                <span className={`badge ${request.listing.type === 'RIDE' ? '' : 'task'}`}>{request.listing.type}</span>
                <span className={`badge ${request.status}`} style={{ marginLeft: 'auto' }}>{request.status}</span>
              </div>
              <h3>{request.listing.title}</h3>
              <p className="meta">{formatTime(request.listing.time)} · Pickup: {request.pickupLocation}</p>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
