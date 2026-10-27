
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

export default function ListingDetailsPage() {
  const { id } = useParams();
  const [listing, setListing] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState(null);

  const [cancelling, setCancelling] = useState(false);

async function handleCancel() {
  if (!window.confirm('Are you sure you want to cancel this listing?')) {
    return;
  }

  try {
    setCancelling(true);
    setError('');

    const token = localStorage.getItem('accessToken');

    const response = await fetch(
      `${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/listings/${id}/cancel`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to cancel listing');
    }

    setListing((previous) => ({
      ...previous,
      status: 'CANCELLED'
    }));

    alert('Listing cancelled successfully!');
  } catch (err) {
    alert(err.message);
  } finally {
    setCancelling(false);
  }
}

  useEffect(() => {
    async function loadListing() {
      try {
        setLoading(true);
        setError('');

        const token = localStorage.getItem('accessToken');

        const meResponse = await fetch(
  `${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/auth/me`,
  {
    headers: {
      Authorization: `Bearer ${token}`
    }
  }
);

if (!meResponse.ok) {
  throw new Error('Unable to verify logged-in user');
}

const meData = await meResponse.json();
setCurrentUserId(meData.user.id);

        const response = await fetch(
          `${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/listings/${id}`,
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to load listing');
        }

        setListing(data.listing);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadListing();
  }, [id]);

  if (loading) return <p>Loading listing...</p>;
  if (error) return <p>{error}</p>;
  if (!listing) return <p>Listing not found.</p>;

  return (
    <main style={{ maxWidth: '700px', margin: '40px auto', padding: '20px' }}>
      <h1>{listing.title}</h1>

      <p><strong>Type:</strong> {listing.type}</p>
      <p><strong>Description:</strong> {listing.description || 'Not provided'}</p>
      <p><strong>Posted by:</strong> {listing.user?.name || 'Unknown'}</p>
      <p><strong>Pickup:</strong> {listing.pickupLocation || 'Not specified'}</p>

      {listing.type === 'RIDE' && (
        <>
          <p><strong>Destination:</strong> {listing.dropoffText || 'Not specified'}</p>
          <p><strong>Available seats:</strong> {listing.availableSeats ?? 'N/A'}</p>
        </>
      )}

      <p><strong>Date:</strong> {new Date(listing.time).toLocaleString()}</p>
      <p><strong>Price:</strong> ${listing.price ?? 0}</p>
      <p><strong>Status:</strong> {listing.status}</p>

      {currentUserId === listing.userId &&
  listing.status !== 'CANCELLED' &&
  listing.status !== 'COMPLETED' && (
  <button
    onClick={handleCancel}
    disabled={cancelling}
    style={{
      backgroundColor: '#dc2626',
      color: 'white',
      padding: '12px 20px',
      border: 'none',
      borderRadius: '6px',
      cursor: cancelling ? 'not-allowed' : 'pointer',
      marginTop: '15px'
    }}
  >
    {cancelling ? 'Cancelling...' : 'Cancel Listing'}
  </button>
)}
    </main>
  );
}
