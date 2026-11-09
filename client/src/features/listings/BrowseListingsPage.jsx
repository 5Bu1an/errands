// US-05: Browse open listings as cards. US-13: filter by type, date, location and price.
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import ListingCard from './ListingCard';

const EMPTY_FILTERS = { type: '', date: '', location: '', maxPrice: '' };

// Build the query string the API expects from the filter form.
function toQuery(filters) {
  const params = new URLSearchParams();

  if (filters.type) params.set('type', filters.type);
  if (filters.location.trim()) params.set('location', filters.location.trim());
  if (filters.maxPrice !== '') params.set('maxPrice', filters.maxPrice);

  // A picked date means the whole day in the user's own time zone.
  if (filters.date) {
    params.set('from', new Date(`${filters.date}T00:00:00`).toISOString());
    params.set('to', new Date(`${filters.date}T23:59:59.999`).toISOString());
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
      const data = await api(`/listings${toQuery(activeFilters)}`);
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
    <main className="page">
      <div className="page-header">
        <div>
          <h1>Browse listings</h1>
          <p className="subtitle">Rides and tasks posted by students</p>
        </div>
        <Link to="/listings/new" className="btn">+ Post a listing</Link>
      </div>

      <form onSubmit={handleApply} className="card filters">
        <div className="field">
          <label htmlFor="type">Type</label>
          <select id="type" name="type" value={filters.type} onChange={handleChange}>
            <option value="">All</option>
            <option value="RIDE">Rides</option>
            <option value="TASK">Tasks</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="date">Date</label>
          <input id="date" type="date" name="date" value={filters.date} onChange={handleChange} />
        </div>
        <div className="field" style={{ flex: 2 }}>
          <label htmlFor="location">Location</label>
          <input id="location" type="text" name="location" placeholder="e.g. Walmart" value={filters.location} onChange={handleChange} />
        </div>
        <div className="field">
          <label htmlFor="maxPrice">Max price ($)</label>
          <input id="maxPrice" type="number" name="maxPrice" min="0" step="1" value={filters.maxPrice} onChange={handleChange} />
        </div>
        <button type="submit" className="btn">Apply</button>
        {hasFilters && (
          <button type="button" onClick={handleClear} className="btn secondary">Clear</button>
        )}
      </form>

      {error && <p className="error">{error}</p>}
      {loading && <p className="empty">Loading listings...</p>}

      {!loading && !error && listings.length === 0 && (
        <div className="card empty">{hasFilters ? 'No listings found.' : 'No listings yet. Be the first to post one!'}</div>
      )}

      {!loading && (
        <div className="grid-2">
          {listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}
    </main>
  );
}
