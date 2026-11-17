import React, { useEffect, useState } from 'react';
import { api } from '../../api';

export default function RatingForm({ listingId }) {
  const [people, setPeople] = useState([]);
  const [receiverId, setReceiverId] = useState('');
  const [score, setScore] = useState('5');
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError('');
    setMessage('');
    setPeople([]);
    setReceiverId('');

    api(`/ratings/listings/${listingId}/options`)
      .then(({ people: found }) => {
        if (!active) return;
        setPeople(found);
        setReceiverId(
          found.find((person) => !person.alreadyRated)?.id || ''
        );
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [listingId]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving || !receiverId) return;

    setSaving(true);
    setError('');
    setMessage('');

    try {
      await api('/ratings', {
        method: 'POST',
        body: {
          listingId,
          receiverId,
          score: Number(score),
          comment
        }
      });

      const updated = people.map((person) =>
        person.id === receiverId
          ? { ...person, alreadyRated: true }
          : person
      );

      setPeople(updated);
      setReceiverId(
        updated.find((person) => !person.alreadyRated)?.id || ''
      );
      setComment('');
      setScore('5');
      setMessage('Your rating was saved.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const available = people.filter((person) => !person.alreadyRated);

  return (
    <div className="card" style={{ marginTop: 20 }}>
      <h2>Rate your experience</h2>

      {loading && <p>Loading participants...</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}

      {!loading && available.length > 0 && (
        <form onSubmit={handleSubmit}>
          <fieldset disabled={saving} style={{ border: 0, padding: 0 }}>
            <label>
              Person
              <select
                value={receiverId}
                onChange={(event) => setReceiverId(event.target.value)}
                required
              >
                {available.map((person, index) => (
                  <option key={person.id} value={person.id}>
                    {person.name || `Participant ${index + 1}`}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Rating
              <select
                value={score}
                onChange={(event) => setScore(event.target.value)}
              >
                {[5, 4, 3, 2, 1].map((value) => (
                  <option key={value} value={value}>
                    {value} {value === 1 ? 'star' : 'stars'}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Comment (optional)
              <textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                maxLength={1000}
                rows={3}
              />
            </label>

            <button className="btn" type="submit">
              {saving ? 'Saving...' : 'Submit rating'}
            </button>
          </fieldset>
        </form>
      )}

      {!loading && !error && available.length === 0 && (
        <p>
          {people.length
            ? 'You have rated all participants.'
            : 'No eligible participants to rate.'}
        </p>
      )}
    </div>
  );
}