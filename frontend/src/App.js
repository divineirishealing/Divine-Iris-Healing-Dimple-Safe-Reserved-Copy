import React from 'react';
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
import ServicesPage from './pages/ServicesPage';
import MediaPage from './pages/MediaPage';
import TransformationsPage from './pages/TransformationsPage';
import EnrollmentPage from './pages/EnrollmentPage';
import CartPage from './pages/CartPage';
import CartCheckoutPage from './pages/CartCheckoutPage';
import TermsPage from './pages/TermsPage';
import PrivacyPage from './pages/PrivacyPage';
import { Toaster } from './components/ui/toaster';
import { SiteSettingsProvider } from './context/SiteSettingsContext';
import { CurrencyProvider } from './context/CurrencyContext';
import { CartProvider } from './context/CartContext';

function App() {
  return (
    <div className="App">
      <CurrencyProvider>
        <CartProvider>
          <SiteSettingsProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/admin" element={<AdminPage />} />
                <Route path="/programs" element={<AllProgramsPage />} />
                <Route path="/program/:id" element={<ProgramDetailPage />} />
                <Route path="/services" element={<ServicesPage />} />
                <Route path="/sessions" element={<AllSessionsPage />} />
                <Route path="/session/:id" element={<SessionDetailPage />} />
                <Route path="/media" element={<MediaPage />} />
                <Route path="/transformations" element={<TransformationsPage />} />
                <Route path="/checkout/:type/:id" element={<CheckoutPage />} />
                <Route path="/enroll/:type/:id" element={<EnrollmentPage />} />
                <Route path="/cart" element={<CartPage />} />
                <Route path="/cart/checkout" element={<CartCheckoutPage />} />
                <Route path="/payment/success" element={<PaymentSuccessPage />} />
                <Route path="/payment/cancel" element={<PaymentCancelPage />} />
                <Route path="/contact" element={<ContactPage />} />
                <Route path="/terms" element={<TermsPage />} />
                <Route path="/privacy" element={<PrivacyPage />} />
              </Routes>
            </BrowserRouter>
            <Toaster />
          </SiteSettingsProvider>
        </CartProvider>
      </CurrencyProvider>
    </div>
  );
}

export default App;
