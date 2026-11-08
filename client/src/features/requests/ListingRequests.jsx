// US-07: The listing owner sees the requests on their listing and can accept or decline them.
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const statusColors = {
  PENDING: '#ca8a04',
  ACCEPTED: '#16a34a',
  DECLINED: '#6b7280',
  CANCELLED: '#6b7280'
};

export default function ListingRequests({ listingId, onAccepted }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  async function loadRequests() {
    try {
      setError('');
      const token = localStorage.getItem('accessToken');

      const response = await fetch(`${API_URL}/requests/listing/${listingId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load requests');
      }

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
      const token = localStorage.getItem('accessToken');

      const response = await fetch(`${API_URL}/requests/${requestId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update request');
      }

      if (status === 'ACCEPTED' && onAccepted) {
        onAccepted();
      }

      // Reload so requests that were auto-declined (listing full) show up too.
      await loadRequests();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p>Loading requests...</p>;

  return (
    <section style={{ marginTop: '30px' }}>
      <h2>Requests</h2>

      {error && <p style={{ color: '#dc2626' }}>{error}</p>}

      {requests.length === 0 && <p>No requests yet.</p>}

      {requests.map((request) => (
        <div
          key={request.id}
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '10px'
          }}
        >
          <p><strong>{request.requester?.name || 'Unnamed user'}</strong></p>
          <p><strong>Pickup point:</strong> {request.pickupLocation}</p>
          {request.note && <p><strong>Note:</strong> {request.note}</p>}
          <p>
            <strong>Status:</strong>{' '}
            <span style={{ color: statusColors[request.status] }}>{request.status}</span>
          </p>

          {request.status === 'PENDING' && (
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => answer(request.id, 'ACCEPTED')}
                disabled={busyId === request.id}
                style={buttonStyle('#16a34a')}
              >
                Accept
              </button>
              <button
                onClick={() => answer(request.id, 'DECLINED')}
                disabled={busyId === request.id}
                style={buttonStyle('#6b7280')}
              >
                Decline
              </button>
            </div>
          )}

          <Link to={`/requests/${request.id}/chat`} style={{ display: 'inline-block', marginTop: '8px' }}>
            Open chat
          </Link>
        </div>
      ))}
    </section>
  );
}

function buttonStyle(color) {
  return {
    backgroundColor: color,
    color: 'white',
    padding: '8px 16px',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer'
  };
}
