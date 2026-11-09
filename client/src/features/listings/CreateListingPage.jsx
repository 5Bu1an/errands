// US-03: Post a ride offer. US-04: Post a task request.
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';

const EMPTY = {
  title: '',
  destination: '',
  pickupLocation: '',
  location: '',
  time: '',
  seats: '1',
  price: '0',
  description: '',
};

export default function CreateListingPage() {
  const navigate = useNavigate();
  const [type, setType] = useState('RIDE');
  const [form, setForm] = useState(EMPTY);
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

    const time = form.time ? new Date(form.time).toISOString() : '';
    const body =
      type === 'RIDE'
        ? {
            type,
            title: form.title,
            destination: form.destination,
            pickupLocation: form.pickupLocation,
            time,
            seats: Number(form.seats),
            price: Number(form.price),
            description: form.description,
          }
        : {
            type,
            title: form.title,
            description: form.description,
            location: form.location,
            time,
            compensation: Number(form.price),
          };

    try {
      const data = await api('/listings', { method: 'POST', body });
      navigate(`/listings/${data.listing.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const isRide = type === 'RIDE';

  return (
    <main className="page page-narrow">
      <h1>Post a listing</h1>
      <p className="subtitle" style={{ marginBottom: 18 }}>
        Offer a ride with free seats, or ask for help with a task.
      </p>

      <div className="card">
        <div className="toggle">
          <button type="button" className={isRide ? 'on' : ''} onClick={() => setType('RIDE')}>Offer a ride</button>
          <button type="button" className={!isRide ? 'on' : ''} onClick={() => setType('TASK')}>Request help</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="title">{isRide ? 'Title (optional)' : 'What do you need help with?'}</label>
            <input
              id="title"
              name="title"
              value={form.title}
              onChange={handleChange}
              required={!isRide}
              placeholder={isRide ? 'e.g. Grocery run to Walmart' : 'e.g. Help moving a couch'}
            />
          </div>

          {isRide ? (
            <div className="grid-2">
              <div className="field">
                <label htmlFor="pickupLocation">Leaving from</label>
                <input id="pickupLocation" name="pickupLocation" value={form.pickupLocation} onChange={handleChange} placeholder="e.g. Avila Centre" />
              </div>
              <div className="field">
                <label htmlFor="destination">Destination</label>
                <input id="destination" name="destination" value={form.destination} onChange={handleChange} required placeholder="e.g. Walmart" />
              </div>
            </div>
          ) : (
            <div className="field">
              <label htmlFor="location">Location</label>
              <input id="location" name="location" value={form.location} onChange={handleChange} required placeholder="e.g. Residence Hall B" />
            </div>
          )}

          <div className="grid-2">
            <div className="field">
              <label htmlFor="time">Date and time</label>
              <input id="time" name="time" type="datetime-local" value={form.time} onChange={handleChange} required />
            </div>
            {isRide && (
              <div className="field">
                <label htmlFor="seats">Free seats</label>
                <input id="seats" name="seats" type="number" min="1" max="6" value={form.seats} onChange={handleChange} required />
              </div>
            )}
            <div className="field">
              <label htmlFor="price">{isRide ? 'Price per seat ($)' : 'You will pay ($)'}</label>
              <input id="price" name="price" type="number" min="0" step="1" value={form.price} onChange={handleChange} />
            </div>
          </div>

          <div className="field">
            <label htmlFor="description">Details {isRide && '(optional)'}</label>
            <textarea
              id="description"
              name="description"
              value={form.description}
              onChange={handleChange}
              required={!isRide}
              placeholder={isRide ? 'Anything riders should know' : 'Describe the task, how long it takes, etc.'}
            />
          </div>

          {error && <p role="alert" className="error">{error}</p>}

          <button type="submit" className="btn full" disabled={loading}>
            {loading ? 'Posting...' : isRide ? 'Post ride' : 'Post task'}
          </button>
        </form>
      </div>
    </main>
  );
}
