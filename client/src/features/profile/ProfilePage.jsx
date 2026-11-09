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

  useEffect(() => {
    api('/users/me')
      .then(({ profile }) => {
        setEmail(profile.email);
        setForm({ name: profile.name || '', program: profile.program || '', bio: profile.bio || '' });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
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
        <p className="meta">No ratings yet. Ratings from completed rides and tasks (US-15) arrive in Sprint 3.</p>
      </div>
    </main>
  );
}
