
import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, formatTime } from '../../api';
import ListingRequests from '../requests/ListingRequests';
import RequestSeatForm from '../requests/RequestSeatForm';

const FINISHED = ['CANCELLED', 'COMPLETED'];
const TRACKABLE_STATUSES = ['CONFIRMED', 'IN_PROGRESS'];

const TRACKING_STEPS = [
  { value: 'LEAVING_NOW', label: 'Leaving Now' },
  { value: 'FIVE_MIN_AWAY', label: '5 Minutes Away' },
  { value: 'IM_HERE', label: "I'm Here" },
  { value: 'COMPLETED', label: 'Completed' }
];

export default function ListingDetailsPage() {
  const { id } = useParams();

  const [listing, setListing] = useState(null);
  const [myRequest, setMyRequest] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  const currentUserId = localStorage.getItem('userId');

  // US-11: Trip tracking state.
  const [tracking, setTracking] = useState(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingError, setTrackingError] = useState('');
  const [trackingMessage, setTrackingMessage] = useState('');
  const [trackingForbidden, setTrackingForbidden] = useState(false);
  const [postingStep, setPostingStep] = useState(false);

  async function load() {
    try {
      setError('');

      const [{ listing: found }, { requests }] = await Promise.all([
        api(`/listings/${id}`),
        api('/requests/mine')
      ]);

      setListing(found);

      setMyRequest(
        requests.find(
          (request) =>
            request.listingId === id &&
            ['PENDING', 'ACCEPTED'].includes(request.status)
        ) || null
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    setListing(null);
    setMyRequest(null);
    setTracking(null);
    setTrackingError('');
    setTrackingMessage('');
    setTrackingForbidden(false);

    load();
  }, [id]);

  const isOwner = Boolean(
    listing && currentUserId === listing.userId
  );

  const isRide = listing?.type === 'RIDE';

  const seatsTaken = listing?._count?.requests ?? 0;

  const seatsLeft = isRide
    ? Math.max((listing.availableSeats ?? 0) - seatsTaken, 0)
    : null;

  const finished = listing
    ? FINISHED.includes(listing.status)
    : false;

  const canPostTracking = Boolean(
    isRide &&
    isOwner &&
    TRACKABLE_STATUSES.includes(listing?.status)
  );

  // US-11: Load tracking for owners and accepted riders.
  useEffect(() => {
    if (!listing || !isRide || !currentUserId) return;

    let active = true;

    async function loadTracking() {
      setTrackingLoading(true);
      setTrackingError('');
      setTrackingForbidden(false);

      try {
        const data = await api(`/listings/${id}/tracking`);

        if (active) {
          setTracking(data);
        }
      } catch (err) {
        if (active) {
          if (
            err.message.toLowerCase().includes('forbidden') ||
            err.message.toLowerCase().includes('not authorized') ||
            err.message.toLowerCase().includes('not allowed')
          ) {
            setTrackingForbidden(true);
            setTracking(null);
          } else {
            setTrackingError(err.message);
          }
        }
      } finally {
        if (active) setTrackingLoading(false);
      }
    }

    loadTracking();

    return () => {
      active = false;
    };
  }, [id, isRide, currentUserId, listing?.status]);

  async function refreshTracking() {
    try {
      setTrackingLoading(true);
      setTrackingError('');

      const data = await api(`/listings/${id}/tracking`);

      setTracking(data);
      setTrackingForbidden(false);
    } catch (err) {
      setTrackingError(err.message);
    } finally {
      setTrackingLoading(false);
    }
  }

  // US-11: Listing owner posts the next trip step.
  async function handlePostTracking(step) {
    try {
      setPostingStep(true);
      setTrackingError('');
      setTrackingMessage('');

      await api(`/listings/${id}/tracking`, {
        method: 'POST',
        body: { step }
      });

      setTrackingMessage('Trip progress updated successfully.');
      await refreshTracking();
    } catch (err) {
      setTrackingError(err.message);
    } finally {
      setPostingStep(false);
    }
  }

  // US-14: Cancel a listing.
  async function handleCancel() {
    if (!window.confirm('Are you sure you want to cancel this listing?')) {
      return;
    }

    try {
      setCancelling(true);
      setError('');

      await api(`/listings/${id}/cancel`, {
        method: 'PATCH'
      });

      setListing((previous) => ({
        ...previous,
        status: 'CANCELLED'
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setCancelling(false);
    }
  }

  if (loading) {
    return (
      <main className="page">
        <p className="empty">Loading listing...</p>
      </main>
    );
  }

  if (!listing) {
    return (
      <main className="page">
        <p className="error">{error || 'Listing not found.'}</p>
      </main>
    );
  }

  const currentStepIndex = TRACKING_STEPS.findIndex(
    (step) => step.value === tracking?.latestStep
  );

  const nextStep = TRACKING_STEPS[currentStepIndex + 1] || null;

  return (
    <main className="page">
      <Link to="/listings">← Back to listings</Link>

      <h1>{listing.title}</h1>

      <div className="grid-2">
        <section className="card">
          <div className="row">
            <span className="badge">{listing.type}</span>
            <span className="badge">{listing.status}</span>
          </div>

          <div style={{ marginTop: 14 }}>
            <p>
              <strong>When:</strong> {formatTime(listing.time)}
            </p>

            <p>
              <strong>{isRide ? 'Leaving from' : 'Location'}:</strong>{' '}
              {listing.pickupLocation || 'Not specified'}
            </p>

            {isRide && (
              <p>
                <strong>Destination:</strong>{' '}
                {listing.dropoffText || 'Not specified'}
              </p>
            )}

            {isRide && (
              <p>
                <strong>Seats left:</strong> {seatsLeft} of{' '}
                {listing.availableSeats ?? 0}
              </p>
            )}

            <p>
              <strong>{isRide ? 'Price per seat' : 'Pays'}:</strong>{' '}
              ${listing.price ?? 0}
            </p>

            {listing.description && (
              <p>
                <strong>Details:</strong> {listing.description}
              </p>
            )}
          </div>

          {error && <p className="error">{error}</p>}

          {isOwner && !finished && (
            <button
              type="button"
              onClick={handleCancel}
              disabled={cancelling}
              className="btn red"
              style={{ marginTop: 10 }}
            >
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

          {/* US-11: Functional trip progress tracking. */}
          {isRide &&
            listing.status !== 'CANCELLED' &&
            !trackingForbidden && (
              <div className="card" style={{ marginTop: 20 }}>
                <h2>Trip Progress</h2>

                {trackingLoading && <p>Loading trip progress...</p>}

                {trackingError && (
                  <p role="alert" className="error">
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
                        (step) => step.value === tracking.latestStep
                      )?.label || 'Not started'}
                    </p>

                    <ol style={{ paddingLeft: 24 }}>
                      {TRACKING_STEPS.map((step, index) => (
                        <li
                          key={step.value}
                          style={{
                            padding: '8px 0',
                            fontWeight:
                              index === currentStepIndex
                                ? 'bold'
                                : 'normal',
                            color:
                              index <= currentStepIndex
                                ? '#16a34a'
                                : 'inherit'
                          }}
                        >
                          {index <= currentStepIndex ? '✓ ' : '○ '}
                          {step.label}
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
                                (step) => step.value === update.step
                              )?.label || update.step}
                              {' — '}
                              {new Date(update.createdAt).toLocaleString()}
                            </li>
                          ))}
                        </ul>
                      </>
                    )}

                    {canPostTracking && nextStep && (
                      <button
                        type="button"
                        className="btn"
                        disabled={postingStep || trackingLoading}
                        onClick={() =>
                          handlePostTracking(nextStep.value)
                        }
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

                <div style={{ marginTop: 15 }}>
                  <button
                    type="button"
                    className="btn"
                    onClick={refreshTracking}
                    disabled={trackingLoading || postingStep}
                  >
                    Refresh Progress
                  </button>
                </div>
              </div>
            )}

          {/* Features planned for later sprints. */}
          <div className="card" style={{ marginTop: 20 }}>
            <h2>Other Actions</h2>
            <div className="row">
              <button className="btn soon" disabled>
                Rate the other person
              </button>
              <button className="btn soon" disabled>
                Report
              </button>
            </div>
            <p className="soon-note">
              Ratings (US-15) and reports (US-20) are planned for a future sprint.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
