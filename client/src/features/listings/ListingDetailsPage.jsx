
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const TRACKING_STEPS = [
  { value: 'LEAVING_NOW', label: 'Leaving Now' },
  { value: 'FIVE_MIN_AWAY', label: '5 Minutes Away' },
  { value: 'IM_HERE', label: "I'm Here" },
  { value: 'COMPLETED', label: 'Completed' },
];

const TRACKABLE_STATUSES = ['CONFIRMED', 'IN_PROGRESS'];

function getToken() {
  return localStorage.getItem('accessToken');
}

function authHeaders(json = false) {
  return {
    Authorization: `Bearer ${getToken()}`,
    ...(json ? { 'Content-Type': 'application/json' } : {}),
  };
}

async function readResponse(response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

export default function ListingDetailsPage() {
  const { id } = useParams();

  const [listing, setListing] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState(null);

  // US-14: Cancel listing.
  const [cancelling, setCancelling] = useState(false);

  // US-06: Request a seat.
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [pickupLocation, setPickupLocation] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [requestError, setRequestError] = useState('');
  const [requestSuccess, setRequestSuccess] = useState('');

  // US-11: Trip progress tracking.
  const [tracking, setTracking] = useState(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingError, setTrackingError] = useState('');
  const [trackingMessage, setTrackingMessage] = useState('');
  const [trackingForbidden, setTrackingForbidden] = useState(false);
  const [postingStep, setPostingStep] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadListing() {
      try {
        setLoading(true);
        setError('');
        setListing(null);
        setCurrentUserId(null);
        setShowRequestForm(false);
        setPickupLocation('');
        setNote('');
        setRequestError('');
        setRequestSuccess('');
        setTracking(null);
        setTrackingError('');
        setTrackingMessage('');
        setTrackingForbidden(false);

        const meResponse = await fetch(`${API_URL}/auth/me`, {
          headers: authHeaders(),
        });
        const meData = await readResponse(meResponse);

        const listingResponse = await fetch(`${API_URL}/listings/${id}`, {
          headers: authHeaders(),
        });
        const listingData = await readResponse(listingResponse);

        if (active) {
          setCurrentUserId(meData.user.id);
          setListing(listingData.listing);
        }
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadListing();

    return () => {
      active = false;
    };
  }, [id]);

  const isOwner = Boolean(
    listing && currentUserId === listing.userId
  );

  const canRequestSeat = Boolean(
    listing &&
    !isOwner &&
    listing.type === 'RIDE' &&
    listing.status === 'OPEN' &&
    Number.isInteger(listing.availableSeats) &&
    listing.availableSeats > 0
  );

  const isRide = listing?.type === 'RIDE';

  const canPostTracking = Boolean(
    isRide &&
    isOwner &&
    TRACKABLE_STATUSES.includes(listing.status)
  );

  // US-11: Load progress. Only owners and accepted riders
  // are authorized by the backend.
  useEffect(() => {
    if (!isRide || !currentUserId) return;

    let active = true;

    async function loadTracking() {
      setTrackingLoading(true);
      setTrackingError('');
      setTrackingForbidden(false);

      try {
        const response = await fetch(
          `${API_URL}/listings/${id}/tracking`,
          { headers: authHeaders() }
        );

        if (response.status === 403) {
          if (active) {
            setTrackingForbidden(true);
            setTracking(null);
          }
          return;
        }

        const data = await readResponse(response);

        if (active) setTracking(data);
      } catch (err) {
        if (active) setTrackingError(err.message);
      } finally {
        if (active) setTrackingLoading(false);
      }
    }

    loadTracking();

    return () => {
      active = false;
    };
  }, [id, currentUserId, isRide]);

  async function refreshTracking() {
    try {
      setTrackingLoading(true);
      setTrackingError('');

      const response = await fetch(
        `${API_URL}/listings/${id}/tracking`,
        { headers: authHeaders() }
      );

      if (response.status === 403) {
        setTrackingForbidden(true);
        setTracking(null);
        return;
      }

      const data = await readResponse(response);
      setTracking(data);
      setTrackingForbidden(false);
    } catch (err) {
      setTrackingError(err.message);
    } finally {
      setTrackingLoading(false);
    }
  }

  // US-11: Owner posts the next tracking step.
  async function handlePostTracking(step) {
    try {
      setPostingStep(true);
      setTrackingError('');
      setTrackingMessage('');

      const response = await fetch(
        `${API_URL}/listings/${id}/tracking`,
        {
          method: 'POST',
          headers: authHeaders(true),
          body: JSON.stringify({ step }),
        }
      );

      await readResponse(response);

      setTrackingMessage('Trip progress updated successfully.');
      await refreshTracking();
    } catch (err) {
      setTrackingError(err.message);
    } finally {
      setPostingStep(false);
    }
  }

  // US-14: Cancel listing.
  async function handleCancel() {
    if (!window.confirm('Are you sure you want to cancel this listing?')) {
      return;
    }

    try {
      setCancelling(true);
      setError('');

      const response = await fetch(
        `${API_URL}/listings/${id}/cancel`,
        {
          method: 'PATCH',
          headers: authHeaders(),
        }
      );

      await readResponse(response);

      setListing((previous) => ({
        ...previous,
        status: 'CANCELLED',
      }));

      alert('Listing cancelled successfully!');
    } catch (err) {
      alert(err.message);
    } finally {
      setCancelling(false);
    }
  }

  // US-06: Submit a seat request.
  async function handleRequestSeat(event) {
    event.preventDefault();

    if (!pickupLocation.trim()) {
      setRequestError('Please enter your pickup location.');
      return;
    }

    try {
      setSubmitting(true);
      setRequestError('');
      setRequestSuccess('');

      const response = await fetch(`${API_URL}/requests`, {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify({
          listingId: id,
          pickupLocation: pickupLocation.trim(),
          note: note.trim() || null,
        }),
      });

      await readResponse(response);

      setRequestSuccess(
        'Seat request submitted successfully! Waiting for the driver to respond.'
      );
      setShowRequestForm(false);
      setPickupLocation('');
      setNote('');
    } catch (err) {
      setRequestError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p>Loading listing...</p>;
  if (error) return <p role="alert">{error}</p>;
  if (!listing) return <p>Listing not found.</p>;

  const currentStepIndex = TRACKING_STEPS.findIndex(
    (item) => item.value === tracking?.latestStep
  );

  const nextStep = TRACKING_STEPS[currentStepIndex + 1] || null;

  const buttonStyle = {
    padding: '12px 20px',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    color: 'white',
  };

  return (
    <main style={{
      maxWidth: '700px',
      margin: '40px auto',
      padding: '20px',
    }}>
      <h1>{listing.title}</h1>

      <p><strong>Type:</strong> {listing.type}</p>
      <p><strong>Description:</strong> {listing.description || 'Not provided'}</p>
      <p><strong>Posted by:</strong> {listing.user?.name || 'Unknown'}</p>
      <p><strong>Pickup:</strong> {listing.pickupLocation || 'Not specified'}</p>

      {isRide && (
        <>
          <p>
            <strong>Destination:</strong>{' '}
            {listing.dropoffText || 'Not specified'}
          </p>
          <p>
            <strong>Available seats:</strong>{' '}
            {listing.availableSeats ?? 'N/A'}
          </p>
        </>
      )}

      <p>
        <strong>Date:</strong>{' '}
        {new Date(listing.time).toLocaleString()}
      </p>
      <p><strong>Price:</strong> ${listing.price ?? 0}</p>
      <p><strong>Status:</strong> {listing.status}</p>

      {/* US-14: Cancel Listing */}
      {isOwner &&
        listing.status !== 'CANCELLED' &&
        listing.status !== 'COMPLETED' && (
          <button
            type="button"
            onClick={handleCancel}
            disabled={cancelling}
            style={{
              ...buttonStyle,
              backgroundColor: '#dc2626',
              marginTop: '15px',
            }}
          >
            {cancelling ? 'Cancelling...' : 'Cancel Listing'}
          </button>
        )}

      {/* US-06: Request Seat */}
      {canRequestSeat && !requestSuccess && (
        <section style={{ marginTop: '30px' }}>
          {!showRequestForm ? (
            <button
              type="button"
              onClick={() => {
                setRequestError('');
                setShowRequestForm(true);
              }}
              style={{
                ...buttonStyle,
                backgroundColor: '#2563eb',
              }}
            >
              Request Seat
            </button>
          ) : (
            <form onSubmit={handleRequestSeat}>
              <h2>Request a Seat</h2>

              <label htmlFor="pickupLocation">
                <strong>Pickup Location *</strong>
              </label>
              <input
                id="pickupLocation"
                type="text"
                value={pickupLocation}
                onChange={(event) =>
                  setPickupLocation(event.target.value)
                }
                placeholder="e.g. Lakehead University main entrance"
                required
                maxLength={200}
                disabled={submitting}
                style={{
                  display: 'block',
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '10px',
                  margin: '8px 0 18px',
                  border: '1px solid #ccc',
                  borderRadius: '6px',
                }}
              />

              <label htmlFor="requestNote">
                <strong>Note to Driver (Optional)</strong>
              </label>
              <textarea
                id="requestNote"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Any additional pickup instructions"
                rows={3}
                maxLength={500}
                disabled={submitting}
                style={{
                  display: 'block',
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '10px',
                  margin: '8px 0 18px',
                  border: '1px solid #ccc',
                  borderRadius: '6px',
                }}
              />

              <button
                type="submit"
                disabled={submitting}
                style={{
                  ...buttonStyle,
                  backgroundColor: '#16a34a',
                  marginRight: '10px',
                }}
              >
                {submitting ? 'Submitting...' : 'Submit Request'}
              </button>

              <button
                type="button"
                disabled={submitting}
                onClick={() => {
                  setShowRequestForm(false);
                  setRequestError('');
                }}
                style={{
                  padding: '12px 20px',
                  border: '1px solid #ccc',
                  borderRadius: '6px',
                }}
              >
                Cancel
              </button>
            </form>
          )}
        </section>
      )}

      {requestError && (
        <p role="alert" style={{ color: '#dc2626' }}>
          {requestError}
        </p>
      )}

      {requestSuccess && (
        <p role="status" style={{ color: '#16a34a' }}>
          {requestSuccess}
        </p>
      )}

      {/* US-11: Trip Progress Tracking */}
      {isRide &&
        listing.status !== 'CANCELLED' &&
        !trackingForbidden && (
          <section style={{
            marginTop: '35px',
            padding: '20px',
            border: '1px solid #ddd',
            borderRadius: '8px',
          }}>
            <h2>Trip Progress</h2>

            {trackingLoading && <p>Loading trip progress...</p>}

            {trackingError && (
              <p role="alert" style={{ color: '#dc2626' }}>
                {trackingError}
              </p>
            )}

            {trackingMessage && (
              <p role="status" style={{ color: '#16a34a' }}>
                {trackingMessage}
              </p>
            )}

            {tracking && (
              <>
                <p>
                  <strong>Current progress:</strong>{' '}
                  {TRACKING_STEPS.find(
                    (item) => item.value === tracking.latestStep
                  )?.label || 'Not started'}
                </p>

                <ol style={{ paddingLeft: '24px' }}>
                  {TRACKING_STEPS.map((item, index) => (
                    <li
                      key={item.value}
                      style={{
                        padding: '8px 0',
                        fontWeight:
                          index === currentStepIndex
                            ? 'bold'
                            : 'normal',
                        color:
                          index <= currentStepIndex
                            ? '#16a34a'
                            : 'inherit',
                      }}
                    >
                      {index <= currentStepIndex ? '✓ ' : '○ '}
                      {item.label}
                    </li>
                  ))}
                </ol>

                {tracking.updates?.length > 0 && (
                  <>
                    <h3>Update History</h3>
                    <ul>
                      {tracking.updates.map((update) => (
                        <li key={update.id}>
                          {TRACKING_STEPS.find(
                            (item) => item.value === update.step
                          )?.label || update.step}
                          {' — '}
                          {new Date(
                            update.createdAt
                          ).toLocaleString()}
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                {canPostTracking && nextStep && (
                  <button
                    type="button"
                    disabled={postingStep || trackingLoading}
                    onClick={() =>
                      handlePostTracking(nextStep.value)
                    }
                    style={{
                      ...buttonStyle,
                      backgroundColor: '#2563eb',
                      marginTop: '12px',
                    }}
                  >
                    {postingStep
                      ? 'Updating...'
                      : `Update: ${nextStep.label}`}
                  </button>
                )}

                {currentStepIndex === TRACKING_STEPS.length - 1 && (
                  <p style={{ color: '#16a34a' }}>
                    All trip progress updates are complete.
                  </p>
                )}
              </>
            )}

            <div style={{ marginTop: '15px' }}>
              <button
                type="button"
                onClick={refreshTracking}
                disabled={trackingLoading || postingStep}
                style={{
                  padding: '10px 16px',
                  border: '1px solid #ccc',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                Refresh Progress
              </button>
            </div>
          </section>
        )}
    </main>
  );
}
