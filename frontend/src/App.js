import React, { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import AdminPage from './pages/AdminPage';
import ProgramDetailPage from './pages/ProgramDetailPage';
import SessionDetailPage from './pages/SessionDetailPage';
import AllProgramsPage from './pages/AllProgramsPage';
import AllSessionsPage from './pages/AllSessionsPage';
import CheckoutPage from './pages/CheckoutPage';
import PaymentSuccessPage from './pages/PaymentSuccessPage';
import PaymentCancelPage from './pages/PaymentCancelPage';
import ContactPage from './pages/ContactPage';
import { Toaster } from './components/ui/toaster';

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/programs" element={<AllProgramsPage />} />
          <Route path="/program/:id" element={<ProgramDetailPage />} />
          <Route path="/sessions" element={<AllSessionsPage />} />
          <Route path="/session/:id" element={<SessionDetailPage />} />
          <Route path="/checkout/:type/:id" element={<CheckoutPage />} />
          <Route path="/payment/success" element={<PaymentSuccessPage />} />
          <Route path="/payment/cancel" element={<PaymentCancelPage />} />
          <Route path="/contact" element={<ContactPage />} />
        </Routes>
      </BrowserRouter>
      <Toaster />
    </div>
  );
}

export default App;
