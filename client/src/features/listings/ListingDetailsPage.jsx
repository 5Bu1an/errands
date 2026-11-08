// US-09: View listing details. Owners can cancel (US-14) and answer requests (US-07);
// everyone else can request a seat (US-06).
import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, formatTime } from '../../api';
import ListingRequests from '../requests/ListingRequests';
import RequestSeatForm from '../requests/RequestSeatForm';

const FINISHED = ['CANCELLED', 'COMPLETED'];

export default function ListingDetailsPage() {
  const { id } = useParams();
  const [listing, setListing] = useState(null);
  const [myRequest, setMyRequest] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const currentUserId = localStorage.getItem('userId');

  async function load() {
    try {
      setError('');
      const [{ listing: found }, { requests }] = await Promise.all([
        api(`/listings/${id}`),
        api('/requests/mine'),
      ]);
      setListing(found);
      setMyRequest(
        requests.find((r) => r.listingId === id && ['PENDING', 'ACCEPTED'].includes(r.status)) || null
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function handleCancel() {
    if (!window.confirm('Are you sure you want to cancel this listing?')) return;

    try {
      setCancelling(true);
      await api(`/listings/${id}/cancel`, { method: 'PATCH' });
      setListing((previous) => ({ ...previous, status: 'CANCELLED' }));
    } catch (err) {
      setError(err.message);
    } finally {
      setCancelling(false);
    }
  }

  if (loading) return <main className="page"><p className="empty">Loading listing...</p></main>;
  if (!listing) return <main className="page"><p className="error">{error || 'Listing not found.'}</p></main>;

  const isOwner = currentUserId === listing.userId;
  const isRide = listing.type === 'RIDE';
  const seatsTaken = listing._count?.requests ?? 0;
  const seatsLeft = isRide ? Math.max((listing.availableSeats ?? 0) - seatsTaken, 0) : null;
  const finished = FINISHED.includes(listing.status);

  return (
    <main className="page">
      <Link to="/listings">← Back to listings</Link>

      <div className="grid-2" style={{ marginTop: 14, alignItems: 'start' }}>
        <section className="card">
          <div className="row">
            <span className={`badge ${isRide ? '' : 'task'}`}>{isRide ? 'RIDE' : 'TASK'}</span>
            <span className={`badge ${listing.status}`}>{listing.status.replace('_', ' ')}</span>
          </div>
          <h1 style={{ marginTop: 10 }}>{listing.title}</h1>
          <p className="meta">Posted by {listing.user?.name || 'a student'}</p>

          <div style={{ marginTop: 14 }}>
            <p><strong>When:</strong> {formatTime(listing.time)}</p>
            <p><strong>{isRide ? 'Leaving from' : 'Location'}:</strong> {listing.pickupLocation || 'Not specified'}</p>
            {isRide && <p><strong>Destination:</strong> {listing.dropoffText || 'Not specified'}</p>}
            {isRide && <p><strong>Seats left:</strong> {seatsLeft} of {listing.availableSeats ?? 0}</p>}
            <p><strong>{isRide ? 'Price per seat' : 'Pays'}:</strong> ${listing.price ?? 0}</p>
            {listing.description && <p><strong>Details:</strong> {listing.description}</p>}
          </div>

          {error && <p className="error">{error}</p>}

          {isOwner && !finished && (
            <button onClick={handleCancel} disabled={cancelling} className="btn red" style={{ marginTop: 10 }}>
              {cancelling ? 'Cancelling...' : 'Cancel listing'}
            </button>
          )}
        </section>

        <section>
          {isOwner ? (
            <ListingRequests
              listingId={listing.id}
              onChange={load}
            />
          ) : (
            <RequestSeatForm
              listing={listing}
              seatsLeft={seatsLeft}
              myRequest={myRequest}
              onRequested={load}
            />
          )}

          {/* Planned for later sprints, shown so the demo covers the whole flow. */}
          <div className="card">
            <h2>Trip</h2>
            <div className="row">
              <button className="btn soon" disabled>Track trip progress</button>
              <button className="btn soon" disabled>Rate the other person</button>
              <button className="btn soon" disabled>Report</button>
            </div>
            <p className="soon-note">Trip tracker (US-11), ratings (US-15) and reports (US-20) arrive in Sprint 3.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
