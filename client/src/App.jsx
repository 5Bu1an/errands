
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ListingDetailsPage from './features/listings/ListingDetailsPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/listings/:id"
          element={<ListingDetailsPage />}
        />
      </Routes>
    </BrowserRouter>
  );
}
