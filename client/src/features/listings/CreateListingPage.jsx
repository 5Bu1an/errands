
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function CreateListingPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    title: '',
    destination: '',
    pickupLocation: '',
    time: '',
    seats: '1',
    price: '0',
    description: '',
  });

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const token = localStorage.getItem('accessToken');

      if (!token) {
        navigate('/login');
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/listings`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            ...form,
            type: 'RIDE',
            time: new Date(form.time).toISOString(),
            seats: Number(form.seats),
            price: Number(form.price),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        const validationErrors = data.errors
          ? Object.values(data.errors).join(', ')
          : null;

        throw new Error(validationErrors || data.error || 'Failed to create listing');
      }

      navigate(`/listings/${data.listing.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 500, margin: '40px auto', padding: 20 }}>
      <h1>Create Ride Listing</h1>

      <form onSubmit={handleSubmit}>
        {[
          ['title', 'Title', 'text'],
          ['destination', 'Destination', 'text'],
          ['pickupLocation', 'Pickup Location', 'text'],
          ['time', 'Date and Time', 'datetime-local'],
          ['seats', 'Available Seats', 'number'],
          ['price', 'Price ($)', 'number'],
        ].map(([name, label, type]) => (
          <div key={name} style={{ marginBottom: 15 }}>
            <label htmlFor={name}>{label}</label>
            <input
              id={name}
              name={name}
              type={type}
              value={form[name]}
              onChange={handleChange}
              required={['destination', 'time', 'seats'].includes(name)}
              min={name === 'seats' ? 1 : name === 'price' ? 0 : undefined}
              max={name === 'seats' ? 6 : undefined}
              step={name === 'price' ? '0.01' : undefined}
              style={{ display: 'block', width: '100%', padding: 8 }}
            />
          </div>
        ))}

        <label htmlFor="description">Description</label>
        <textarea
          id="description"
          name="description"
          value={form.description}
          onChange={handleChange}
          style={{ display: 'block', width: '100%', padding: 8, marginBottom: 20 }}
        />

        <button type="submit" disabled={loading}>
          {loading ? 'Creating...' : 'Create Listing'}
        </button>

        {error && <p role="alert" style={{ color: 'red' }}>{error}</p>}
      </form>
    </main>
  );
}
