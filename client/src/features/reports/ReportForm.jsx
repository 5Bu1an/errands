// US-20: Report a listing or a user. Starts as a button and opens into a short form.
import React, { useState } from 'react';
import { api } from '../../api';

export default function ReportForm({ listingId, reportedId, label = 'Report', small = false }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSending(true);

    try {
      await api('/reports', { method: 'POST', body: { listingId, reportedId, reason } });
      setSent(true);
      setOpen(false);
      setReason('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  if (sent) return <p className="success">Thanks. An admin will review your report.</p>;

  if (!open) {
    return (
      <button type="button" className={`btn secondary${small ? ' small' : ''}`} onClick={() => setOpen(true)}>
        {label}
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ width: '100%' }}>
      <div className="field">
        <label htmlFor={`reason-${listingId || ''}-${reportedId || ''}`}>What's wrong?</label>
        <textarea
          id={`reason-${listingId || ''}-${reportedId || ''}`}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={500}
          placeholder="e.g. Asked for payment outside the app, didn't show up, rude in chat"
          required
        />
      </div>
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button type="submit" className="btn red small" disabled={sending || !reason.trim()}>
          {sending ? 'Sending...' : 'Send report'}
        </button>
        <button type="button" className="btn secondary small" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}
