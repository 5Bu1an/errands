import React from 'react';
import { Link } from 'react-router-dom';
import { formatTime } from '../../api';

// One listing shown as a card (browse page and dashboard).
export default function ListingCard({ listing, extra }) {
  const isRide = listing.type === 'RIDE';

  return (
    <Link to={`/listings/${listing.id}`} className="card card-link">
      <div className="row">
        <span className={`badge ${isRide ? '' : 'task'}`}>{isRide ? 'RIDE' : 'TASK'}</span>
        {listing.status && listing.status !== 'OPEN' && (
          <span className={`badge ${listing.status}`}>{listing.status.replace('_', ' ')}</span>
        )}
        <strong style={{ marginLeft: 'auto', fontSize: 17 }}>${listing.price ?? 0}</strong>
      </div>
      <h3>{listing.title}</h3>
      <p className="meta">
        {formatTime(listing.time)} · {listing.pickupLocation || 'No pickup given'}
        {isRide && listing.dropoffText ? ` → ${listing.dropoffText}` : ''}
      </p>
      <p className="meta">
        {isRide && `${listing.availableSeats ?? 0} seats`}
        {isRide && listing.user?.name && ' · '}
        {listing.user?.name && `Posted by ${listing.user.name}`}
        {extra}
      </p>
    </Link>
  );
}
