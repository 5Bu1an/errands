import React from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate
} from 'react-router-dom';

import LoginPage from './features/auth/LoginPage';
import BrowseListingsPage from './features/listings/BrowseListingsPage';
import CreateListingPage from './features/listings/CreateListingPage';
import ListingDetailsPage from './features/listings/ListingDetailsPage';
import ChatPage from './features/chat/ChatPage';

function ProtectedRoute({ children }) {
  const token = localStorage.getItem('accessToken');

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/listings"
          element={
            <ProtectedRoute>
              <BrowseListingsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/listings/new"
          element={
            <ProtectedRoute>
              <CreateListingPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/listings/:id"
          element={
            <ProtectedRoute>
              <ListingDetailsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/requests/:requestId/chat"
          element={
            <ProtectedRoute>
              <ChatPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}