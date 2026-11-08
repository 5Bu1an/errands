import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { api } from '../api';

const links = [
  ['/listings', 'Browse'],
  ['/listings/new', 'Post'],
  ['/dashboard', 'My Errands'],
  ['/notifications', 'Notifications'],
  ['/profile', 'Profile'],
];

export default function NavBar() {
  const navigate = useNavigate();

  async function handleLogout() {
    try {
      await api('/auth/logout', { method: 'POST' });
    } catch {
      // Log out locally even if the server call fails.
    }
    localStorage.removeItem('accessToken');
    localStorage.removeItem('userId');
    navigate('/login');
  }

  return (
    <nav className="nav">
      <div className="nav-inner">
        <NavLink to="/listings" className="brand">Errand<span>s</span></NavLink>
        {links.map(([to, label]) => (
          <NavLink
            key={to}
            to={to}
            end
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            {label}
          </NavLink>
        ))}
        <button className="btn secondary small" onClick={handleLogout}>Log out</button>
      </div>
    </nav>
  );
}
