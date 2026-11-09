// US-06: Request a seat (or offer to help with a task) with a typed pickup point.
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';

const TAKING_REQUESTS = ['OPEN', 'REQUESTED', 'CONFIRMED'];

export default function RequestSeatForm({ listing, seatsLeft, myRequest, onRequested }) {
  const isRide = listing.type === 'RIDE';
  const [pickupLocation, setPickupLocation] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSending(true);

    try {
      await api('/requests', {
        method: 'POST',
        body: { listingId: listing.id, pickupLocation, note },
      });
      onRequested();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  if (myRequest) {
    return (
      <div className="card">
        <h2>Your request</h2>
        <p>
          Status: <span className={`badge ${myRequest.status}`}>{myRequest.status}</span>
        </p>
        <p className="meta">Pickup point: {myRequest.pickupLocation}</p>
        <Link to={`/requests/${myRequest.id}/chat`} className="btn secondary small">Message the {isRide ? 'driver' : 'requester'}</Link>
      </div>
    );
  }

  if (!TAKING_REQUESTS.includes(listing.status) || (isRide && seatsLeft === 0)) {
    return (
      <div className="card">
        <h2>{isRide ? 'Request a seat' : 'Offer to help'}</h2>
        <p className="meta">{isRide && seatsLeft === 0 ? 'This ride is full.' : 'This listing is no longer taking requests.'}</p>
      </div>
    );
  }

  return (
    <form className="card" onSubmit={handleSubmit}>
      <h2>{isRide ? 'Request a seat' : 'Offer to help'}</h2>
      <div className="field">
        <label htmlFor="pickup">{isRide ? 'Where should the driver pick you up?' : 'Where will you meet them?'}</label>
        <input id="pickup" value={pickupLocation} onChange={(e) => setPickupLocation(e.target.value)} required placeholder="e.g. Avila Centre main doors" />
      </div>
      <div className="field">
        <label htmlFor="note">Note (optional)</label>
        <input id="note" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="e.g. I have one small bag" />
      </div>
      {error && <p className="error">{error}</p>}
      <button type="submit" className="btn full" disabled={sending}>
        {sending ? 'Sending...' : isRide ? 'Request seat' : 'Offer to help'}
      </button>
    </form>
  );
}
