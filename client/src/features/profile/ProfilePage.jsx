// US-12: View and edit my profile.
import React, { useEffect, useState } from 'react';
import { api } from '../../api';

export default function ProfilePage() {
  const [form, setForm] = useState({ name: '', program: '', bio: '' });
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [ratingSummary, setRatingSummary] = useState(null);
  const [ratingError, setRatingError] = useState('');
  const [ratingLoading, setRatingLoading] = useState(true);

  useEffect(() => {
  let active = true;

  async function loadProfile() {
    try {
      const { profile } = await api('/users/me');
      if (!active) return;

      setEmail(profile.email || '');
      setForm({
        name: profile.name || '',
        program: profile.program || '',
        bio: profile.bio || ''
      });
      setLoading(false);

      try {
        const summary = await api(
          `/ratings/users/${profile.id}/summary`
        );

        if (active) setRatingSummary(summary);
      } catch (err) {
        if (active) setRatingError(err.message);
      }
    } catch (err) {
      if (active) {
        setError(err.message);
        setRatingError('Unable to load ratings because the profile could not be loaded.');
      }
    } finally {
      if (active) {
        setLoading(false);
        setRatingLoading(false);
      }
    }
  }

  loadProfile();

  return () => {
    active = false;
  };
}, []);

  function handleChange(event) {
    const { name, value } = event.target;
    setSaved(false);
    setForm((previous) => ({ ...previous, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSaving(true);

    try {
      await api('/users/me', { method: 'PATCH', body: form });
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <main className="page"><p className="empty">Loading profile...</p></main>;

  return (
    <main className="page page-narrow">
      <h1>My profile</h1>
      <p className="subtitle" style={{ marginBottom: 18 }}>This is what other students see on your listings and requests.</p>

      <form className="card" onSubmit={handleSubmit}>
        <div className="field">
          <label>Email</label>
          <input value={email} disabled />
        </div>
        <div className="field">
          <label htmlFor="name">Name</label>
          <input id="name" name="name" value={form.name} onChange={handleChange} maxLength={60} required />
        </div>
        <div className="field">
          <label htmlFor="program">Program</label>
          <input id="program" name="program" value={form.program} onChange={handleChange} maxLength={80} placeholder="e.g. Computer Science, 3rd year" />
        </div>
        <div className="field">
          <label htmlFor="bio">Bio</label>
          <textarea id="bio" name="bio" value={form.bio} onChange={handleChange} maxLength={300} placeholder="A little about you" />
        </div>

        {error && <p className="error">{error}</p>}
        {saved && <p className="success">Profile saved.</p>}

        <button type="submit" className="btn" disabled={saving}>{saving ? 'Saving...' : 'Save profile'}</button>
      </form>

      <div className="card">
  <h2>Rating</h2>

  {ratingLoading ? (
    <p className="meta">Loading ratings...</p>
  ) : ratingError ? (
    <p className="error" role="alert">{ratingError}</p>
  ) : ratingSummary?.ratingCount > 0 ? (
    <>
      <p>
        <strong>
          {Number(ratingSummary.averageRating).toFixed(1)} / 5
        </strong>
        {' — '}
        {ratingSummary.ratingCount}{' '}
        {ratingSummary.ratingCount === 1 ? 'rating' : 'ratings'}
      </p>
      <p className="meta">
        From participants in completed rides and tasks.
      </p>
    </>
  ) : (
    <p className="meta">No ratings yet.</p>
  )}
</div>
    </main>
  );
}
