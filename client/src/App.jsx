import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';

import NavBar from './components/NavBar';
import LoginPage from './features/auth/LoginPage';
import SignupPage from './features/auth/SignupPage';
import BrowseListingsPage from './features/listings/BrowseListingsPage';
import CreateListingPage from './features/listings/CreateListingPage';
import ListingDetailsPage from './features/listings/ListingDetailsPage';
import DashboardPage from './features/listings/DashboardPage';
import ChatPage from './features/chat/ChatPage';
import NotificationsPage from './features/notifications/NotificationsPage';
import ProfilePage from './features/profile/ProfilePage';

// Logged-in pages share the nav bar. Without a token, go to login.
function ProtectedLayout() {
  if (!localStorage.getItem('accessToken')) {
    return <Navigate to="/login" replace />;
  }

  return (
    <>
      <NavBar />
      <Outlet />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />

        <Route element={<ProtectedLayout />}>
          <Route path="/listings" element={<BrowseListingsPage />} />
          <Route path="/listings/new" element={<CreateListingPage />} />
          <Route path="/listings/:id" element={<ListingDetailsPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/requests/:requestId/chat" element={<ChatPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>

        <Route path="*" element={<Navigate to="/listings" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
