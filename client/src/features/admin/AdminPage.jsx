// US-19: Admins view users and listings, review reports, and remove content.
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatTime } from '../../api';

const TABS = ['Reports', 'Listings', 'Users'];

export default function AdminPage() {
  const [tab, setTab] = useState('Reports');
  const [data, setData] = useState({ reports: [], listings: [], users: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [showResolved, setShowResolved] = useState(false);
  const myId = localStorage.getItem('userId');

  async function load() {
    try {
      setError('');
      const [{ reports }, { listings }, { users }] = await Promise.all([
        api('/admin/reports'),
        api('/admin/listings'),
        api('/admin/users'),
      ]);
      setData({ reports, listings, users });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function act(id, work) {
    try {
      setBusyId(id);
      setError('');
      await work();
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  const setReportStatus = (id, status) =>
    act(id, () => api(`/admin/reports/${id}`, { method: 'PATCH', body: { status } }));

  const removeListing = (listing) => {
    if (!window.confirm(`Remove "${listing.title}"? Its requests, chat and reports are deleted too. This can't be undone.`)) return;
    act(listing.id, () => api(`/admin/listings/${listing.id}`, { method: 'DELETE' }));
  };

  const removeUser = (user) => {
    if (!window.confirm(`Remove ${user.name || user.email || 'this user'}? Their account and everything they posted are deleted. This can't be undone.`)) return;
    act(user.id, () => api(`/admin/users/${user.id}`, { method: 'DELETE' }));
  };

  const openReports = data.reports.filter((r) => r.status !== 'RESOLVED');
  const reports = showResolved ? data.reports : openReports;
  const counts = { Reports: openReports.length, Listings: data.listings.length, Users: data.users.length };

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <h1>Admin</h1>
          <p className="subtitle">Review reports and remove content that breaks the rules</p>
        </div>
      </div>

      <div className="toggle">
        {TABS.map((name) => (
          <button key={name} type="button" className={tab === name ? 'on' : ''} onClick={() => setTab(name)}>
            {name} ({counts[name]})
          </button>
        ))}
      </div>

      {loading && <p className="empty">Loading...</p>}
      {error && <p className="error">{error}</p>}

      {!loading && tab === 'Reports' && (
        <>
          <label className="row" style={{ fontWeight: 500, marginBottom: 12 }}>
            <input
              type="checkbox"
              checked={showResolved}
              onChange={(event) => setShowResolved(event.target.checked)}
              style={{ width: 'auto' }}
            />
            Show resolved reports
          </label>

          {reports.length === 0 && <div className="card empty">No open reports.</div>}

          {reports.map((report) => (
            <div key={report.id} className="card">
              <div className="row">
                <span className={`badge ${report.status}`}>{report.status}</span>
                <span className="meta" style={{ marginLeft: 'auto', fontSize: 13 }}>{formatTime(report.createdAt)}</span>
              </div>
              <p style={{ margin: '10px 0 6px' }}>{report.reason}</p>
              {report.listing && (
                <p className="meta">
                  Listing: <Link to={`/listings/${report.listing.id}`}>{report.listing.title}</Link> ({report.listing.status})
                </p>
              )}
              {report.reported && <p className="meta">User: {report.reported.name || 'Unnamed student'}</p>}
              <p className="meta">Reported by {report.reporter?.name || 'a student'}</p>

              <div className="row" style={{ marginTop: 8 }}>
                {report.status === 'PENDING' && (
                  <button className="btn secondary small" disabled={busyId === report.id} onClick={() => setReportStatus(report.id, 'REVIEWED')}>
                    Mark reviewed
                  </button>
                )}
                {report.status !== 'RESOLVED' && (
                  <button className="btn green small" disabled={busyId === report.id} onClick={() => setReportStatus(report.id, 'RESOLVED')}>
                    Resolve
                  </button>
                )}
                {report.listing && (
                  <button className="btn red small" disabled={busyId === report.listing.id} onClick={() => removeListing(report.listing)}>
                    Remove listing
                  </button>
                )}
              </div>
            </div>
          ))}
        </>
      )}

      {!loading && tab === 'Listings' && (
        <>
          {data.listings.length === 0 && <div className="card empty">No listings yet.</div>}
          {data.listings.map((listing) => (
            <div key={listing.id} className="card">
              <div className="row">
                <span className={`badge ${listing.type === 'RIDE' ? '' : 'task'}`}>{listing.type}</span>
                <span className={`badge ${listing.status}`}>{listing.status.replace('_', ' ')}</span>
                {listing._count?.reports > 0 && (
                  <span className="badge CANCELLED">{listing._count.reports} open report{listing._count.reports > 1 ? 's' : ''}</span>
                )}
              </div>
              <h3><Link to={`/listings/${listing.id}`}>{listing.title}</Link></h3>
              <p className="meta">By {listing.user?.name || 'a student'} · {formatTime(listing.time)}</p>
              <button className="btn red small" style={{ marginTop: 8 }} disabled={busyId === listing.id} onClick={() => removeListing(listing)}>
                {busyId === listing.id ? 'Removing...' : 'Remove listing'}
              </button>
            </div>
          ))}
        </>
      )}

      {!loading && tab === 'Users' && (
        <>
          {data.users.map((user) => (
            <div key={user.id} className="card">
              <div className="row">
                <strong>{user.name || 'Unnamed student'}</strong>
                {user.isAdmin && <span className="badge">ADMIN</span>}
                {user._count?.reportsAgainst > 0 && (
                  <span className="badge CANCELLED">{user._count.reportsAgainst} open report{user._count.reportsAgainst > 1 ? 's' : ''}</span>
                )}
              </div>
              <p className="meta">{user.email || 'Email unavailable'}{user.program ? ` · ${user.program}` : ''}</p>
              <p className="meta" style={{ fontSize: 13 }}>
                {user._count?.listings ?? 0} listing{user._count?.listings === 1 ? '' : 's'} · joined {formatTime(user.createdAt)}
              </p>
              {!user.isAdmin && user.id !== myId && (
                <button className="btn red small" style={{ marginTop: 8 }} disabled={busyId === user.id} onClick={() => removeUser(user)}>
                  {busyId === user.id ? 'Removing...' : 'Remove user'}
                </button>
              )}
            </div>
          ))}
        </>
      )}
    </main>
  );
}
