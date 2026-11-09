// US-07: The listing owner sees the requests on their listing and can accept or decline them.
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';

export default function ListingRequests({ listingId, onChange }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  async function loadRequests() {
    try {
      setError('');
      const data = await api(`/requests/listing/${listingId}`);
      setRequests(data.requests);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRequests();
  }, [listingId]);

  async function answer(requestId, status) {
    try {
      setBusyId(requestId);
      setError('');
      await api(`/requests/${requestId}/status`, { method: 'PATCH', body: { status } });
      // Reload so requests that were auto-declined (listing full) show up too.
      await loadRequests();
      if (onChange) onChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="card">
      <h2>Requests</h2>

      {loading && <p className="meta">Loading requests...</p>}
      {error && <p className="error">{error}</p>}
      {!loading && requests.length === 0 && <p className="meta">No requests yet.</p>}

      {requests.map((request) => (
        <div key={request.id} style={{ borderTop: '1px solid var(--border)', padding: '12px 0' }}>
          <div className="row">
            <strong>{request.requester?.name || 'A student'}</strong>
            <span className={`badge ${request.status}`} style={{ marginLeft: 'auto' }}>{request.status}</span>
          </div>
          <p className="meta">Pickup point: {request.pickupLocation}</p>
          {request.note && <p className="meta">Note: {request.note}</p>}

          <div className="row" style={{ marginTop: 6 }}>
            {request.status === 'PENDING' && (
              <>
                <button onClick={() => answer(request.id, 'ACCEPTED')} disabled={busyId === request.id} className="btn green small">Accept</button>
                <button onClick={() => answer(request.id, 'DECLINED')} disabled={busyId === request.id} className="btn secondary small">Decline</button>
              </>
            )}
            <Link to={`/requests/${request.id}/chat`} className="btn secondary small">Chat</Link>
          </div>
        </div>
      ))}
    </div>
  );
}
