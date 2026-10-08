import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Register each feature's pages here, one line each.
// e.g. import LoginPage from './features/auth/LoginPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* <Route path="/login" element={<LoginPage />} /> */}
      </Routes>
    </BrowserRouter>
  );
}
