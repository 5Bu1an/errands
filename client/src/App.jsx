
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LoginPage from './features/auth/LoginPage';
import CreateListingPage from './features/listings/CreateListingPage';
import ListingDetailsPage from './features/listings/ListingDetailsPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/listings/new" element={<CreateListingPage />} />
        <Route path="/listings/:id" element={<ListingDetailsPage />} />
      </Routes>
    </BrowserRouter>
  );
}
