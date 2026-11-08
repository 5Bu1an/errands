// US-16: See my in-app notifications (created by US-17 events).
import React, { useEffect, useState } from 'react';
import { api, formatTime } from '../../api';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/notifications')
      .then((data) => setNotifications(data.notifications))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="page page-narrow">
      <h1>Notifications</h1>
      <p className="subtitle" style={{ marginBottom: 18 }}>Requests, answers and completed trips</p>

      {loading && <p className="empty">Loading...</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !error && notifications.length === 0 && (
        <div className="card empty">No notifications yet.</div>
      )}

      {notifications.map((notification) => (
        <div key={notification.id} className="card">
          <p style={{ margin: 0 }}>{notification.message}</p>
          <p className="meta" style={{ fontSize: 13 }}>{formatTime(notification.createdAt)}</p>
        </div>
      ))}

      <button className="btn soon" disabled>Mark all as read</button>
      <p className="soon-note">Read/unread tracking and email notifications (US-22) are planned for a later sprint.</p>
    </main>
  );
}
