import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
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
import AboutPage from './pages/AboutPage';
import BlogPage from './pages/BlogPage';
import SponsorPage from './pages/SponsorPage';
import IndiaPaymentPage from './pages/IndiaPaymentPage';
import ManualPaymentPage from './pages/ManualPaymentPage';
import ClientIntakePage from './pages/ClientIntakePage';
import ContactUpdatePage from './pages/ContactUpdatePage';
import LoginPage from './pages/LoginPage';
import StudentDashboard from './pages/StudentDashboard';
import DashboardLayout from './layouts/DashboardLayout';
import AuthCallback from './components/auth/AuthCallback';
import ProfilePage from './components/dashboard/ProfilePage';
import OrderHistoryPage from './components/dashboard/OrderHistoryPage';
import FinancialsPage from './components/dashboard/FinancialsPage';
import CalendarPage from './components/dashboard/CalendarPage';
import ProgressPage from './components/dashboard/ProgressPage';
import SoulGardenPage from './components/dashboard/SoulGardenPage';
import TreeOfLifePage from './components/dashboard/TreeOfLifePage';
import OceanPage from './components/dashboard/OceanPage';
import MandalaPage from './components/dashboard/MandalaPage';
import HeadspacePage from './components/dashboard/HeadspacePage';
import BhaadPortalPage from './components/dashboard/BhaadPortalPage';
import SoulTribePage from './components/dashboard/SoulTribePage';
import PointsPage from './components/dashboard/PointsPage';
import DashboardCombinedCheckoutPage from './pages/DashboardCombinedCheckoutPage';
import DashboardAccessPage from './pages/DashboardAccessPage';
import { Toaster } from './components/ui/toaster';
import { HelmetProvider } from 'react-helmet-async';
import { SiteSettingsProvider } from './context/SiteSettingsContext';
import { SeoPageProvider } from './context/SeoPageContext';
import { CurrencyProvider, useCurrency } from './context/CurrencyContext';
import { CartProvider } from './context/CartContext';
import { AuthProvider } from './context/AuthContext';
import { Analytics } from '@vercel/analytics/react';
import SeoHead from './components/SeoHead';
import BackendStatusBanner from './components/BackendStatusBanner';
import { resolveImageUrl } from './lib/imageUtils';

const CurrencyGate = ({ children }) => {
  const { ready } = useCurrency();
  if (!ready) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0d1117' }}>
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  );
  return children;
};

const AppContent = () => {
  const location = useLocation();

  // Set favicon from brand logo
  useEffect(() => {
    const API = process.env.REACT_APP_BACKEND_URL || '';
    fetch(`${API}/api/settings`).then(r => r.json()).then(d => {
      if (d?.logo_url) {
        const link = document.querySelector("link[rel*='icon']") || document.createElement('link');
        link.type = 'image/png'; link.rel = 'icon';
        link.href = resolveImageUrl(d.logo_url);
        document.head.appendChild(link);
      }
    }).catch(() => {});
  }, []);

  // Handle OAuth callback (implicit flow via hash fragment)
  if (location.hash && location.hash.includes('session_id=')) {
    return <AuthCallback />;
  }

  return (
    <>
      <BackendStatusBanner />
      <SeoHead />
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
      <Route path="/india-payment/:enrollmentId" element={<IndiaPaymentPage />} />
      <Route path="/manual-payment/:enrollmentId" element={<ManualPaymentPage />} />
      <Route path="/manual-payment" element={<ManualPaymentPage />} />
      <Route path="/client-intake" element={<ClientIntakePage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/update-contact/:token" element={<ContactUpdatePage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/blog" element={<BlogPage />} />
      <Route path="/sponsor" element={<SponsorPage />} />
      
      {/* Auth Routes */}
      <Route path="/login" element={<LoginPage />} />
      
      {/* Dashboard Routes */}
      <Route path="/dashboard" element={<DashboardLayout />}>
        <Route index element={<StudentDashboard />} />
        <Route path="access" element={<DashboardAccessPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="orders" element={<OrderHistoryPage />} />
        <Route path="financials" element={<FinancialsPage />} />
        <Route path="points" element={<PointsPage />} />
        <Route path="combined-checkout" element={<DashboardCombinedCheckoutPage />} />
        <Route path="sessions" element={<CalendarPage />} />
        <Route path="progress" element={<ProgressPage />} />
        <Route path="garden" element={<SoulGardenPage />} />
        <Route path="garden/tree" element={<TreeOfLifePage />} />
        <Route path="garden/ocean" element={<OceanPage />} />
        <Route path="garden/mandala" element={<MandalaPage />} />
        <Route path="garden/zen" element={<HeadspacePage />} />
        <Route path="bhaad" element={<BhaadPortalPage />} />
        <Route path="tribe" element={<SoulTribePage />} />
        
        <Route path="roadmap" element={<div className="p-8 font-serif text-[#5D3FD3]">Growth Roadmap Coming Soon</div>} />
        <Route path="community" element={<div className="p-8 font-serif text-[#5D3FD3]">Experience Sharing Coming Soon</div>} />
        <Route path="archive" element={<div className="p-8 font-serif text-[#5D3FD3]">Workshop Archive Coming Soon</div>} />
        <Route path="diary" element={<div className="p-8 font-serif text-[#5D3FD3]">Mini Diary Coming Soon</div>} />
        <Route path="reports" element={<div className="p-8 font-serif text-[#5D3FD3]">Monthly Reports Coming Soon</div>} />
        <Route path="tracker" element={<div className="p-8 font-serif text-[#5D3FD3]">Interactive Tracker Coming Soon</div>} />
        <Route path="vault" element={<div className="p-8 font-serif text-[#5D3FD3]">Resource Vault Coming Soon</div>} />
      </Route>
    </Routes>
    </>
  );
};

function App() {
  return (
    <HelmetProvider>
      <div className="App">
        <BrowserRouter>
          <SeoPageProvider>
            <AuthProvider>
              <CurrencyProvider>
                <SiteSettingsProvider>
                  <CurrencyGate>
                    <CartProvider>
                      <AppContent />
                      <Toaster />
                    </CartProvider>
                  </CurrencyGate>
                </SiteSettingsProvider>
              </CurrencyProvider>
            </AuthProvider>
          </SeoPageProvider>
        </BrowserRouter>
        <Analytics />
      </div>
    </HelmetProvider>
  );
}

export default App;
