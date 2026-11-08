// US-05: Browse open listings as cards. US-13: filter by type, date, location and price.
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const EMPTY_FILTERS = { type: '', date: '', location: '', maxPrice: '' };

// Build the query string the API expects from the filter form.
function toQuery(filters) {
  const params = new URLSearchParams();

  if (filters.type) params.set('type', filters.type);
  if (filters.location.trim()) params.set('location', filters.location.trim());
  if (filters.maxPrice !== '') params.set('maxPrice', filters.maxPrice);

  // A picked date means the whole day in the user's own time zone.
  if (filters.date) {
    const start = new Date(`${filters.date}T00:00:00`);
    const end = new Date(`${filters.date}T23:59:59.999`);
    params.set('from', start.toISOString());
    params.set('to', end.toISOString());
  }

  const query = params.toString();
  return query ? `?${query}` : '';
}

export default function BrowseListingsPage() {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadListings(activeFilters) {
    try {
      setLoading(true);
      setError('');
      const token = localStorage.getItem('accessToken');

      const response = await fetch(`${API_URL}/listings${toQuery(activeFilters)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();

      if (!response.ok) {
        const messages = data.errors ? Object.values(data.errors).join(' ') : data.error;
        throw new Error(messages || 'Failed to load listings');
      }

      setListings(data.listings);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadListings(EMPTY_FILTERS);
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;
    setFilters((previous) => ({ ...previous, [name]: value }));
  }

  function handleApply(event) {
    event.preventDefault();
    loadListings(filters);
  }

  function handleClear() {
    setFilters(EMPTY_FILTERS);
    loadListings(EMPTY_FILTERS);
  }

  const hasFilters = Object.values(filters).some((value) => value !== '');

  return (
    <main style={{ maxWidth: '900px', margin: '40px auto', padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Listings</h1>
        <Link to="/listings/new">+ Post a listing</Link>
      </div>

      <form
        onSubmit={handleApply}
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px',
          alignItems: 'flex-end',
          marginBottom: '20px'
        }}
      >
        <label style={labelStyle}>
          Type
          <select name="type" value={filters.type} onChange={handleChange} style={inputStyle}>
            <option value="">All</option>
            <option value="RIDE">Rides</option>
            <option value="TASK">Tasks</option>
          </select>
        </label>

        <label style={labelStyle}>
          Date
          <input type="date" name="date" value={filters.date} onChange={handleChange} style={inputStyle} />
        </label>

        <label style={labelStyle}>
          Location
          <input
            type="text"
            name="location"
            placeholder="e.g. Walmart"
            value={filters.location}
            onChange={handleChange}
            style={inputStyle}
          />
        </label>

        <label style={labelStyle}>
          Max price ($)
          <input
            type="number"
            name="maxPrice"
            min="0"
            step="1"
            value={filters.maxPrice}
            onChange={handleChange}
            style={{ ...inputStyle, width: '100px' }}
          />
        </label>

        <button type="submit" style={buttonStyle}>Apply filters</button>
        {hasFilters && (
          <button type="button" onClick={handleClear} style={{ ...buttonStyle, backgroundColor: '#6b7280' }}>
            Clear
          </button>
        )}
      </form>

      {error && <p style={{ color: '#dc2626' }}>{error}</p>}
      {loading && <p>Loading listings...</p>}

      {!loading && !error && listings.length === 0 && (
        <p>{hasFilters ? 'No listings found.' : 'No listings yet.'}</p>
      )}

      {!loading &&
        listings.map((listing) => (
          <Link
            key={listing.id}
            to={`/listings/${listing.id}`}
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <div
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '14px 18px',
                marginBottom: '12px'
              }}
            >
              <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>
                {listing.type === 'RIDE' ? 'RIDE' : 'TASK'}
              </p>
              <h3 style={{ margin: '4px 0' }}>{listing.title}</h3>
              <p style={{ margin: '4px 0' }}>
                {new Date(listing.time).toLocaleString()} · {listing.pickupLocation || 'No pickup given'}
                {listing.type === 'RIDE' && listing.dropoffText ? ` → ${listing.dropoffText}` : ''}
              </p>
              <p style={{ margin: '4px 0' }}>
                <strong>${listing.price ?? 0}</strong>
                {listing.type === 'RIDE' && ` · ${listing.availableSeats ?? 0} seats`}
                {listing.user?.name && ` · Posted by ${listing.user.name}`}
              </p>
            </div>
          </Link>
        ))}
    </main>
  );
}

const labelStyle = { display: 'flex', flexDirection: 'column', fontSize: '14px', gap: '4px' };
const inputStyle = { padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px' };
const buttonStyle = {
  backgroundColor: '#2563eb',
  color: 'white',
  padding: '9px 16px',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer'
};
