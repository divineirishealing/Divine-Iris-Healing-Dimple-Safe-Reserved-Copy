import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage';
import ProgramDetailRoute from './pages/ProgramDetailPage';
import SessionDetailPage from './pages/SessionDetailPage';
import EnrollmentPage from './pages/EnrollmentPage';
import AuthCallback from './components/auth/AuthCallback';
import RouteErrorBoundary from './components/RouteErrorBoundary';
import { Toaster } from './components/ui/toaster';
import { HelmetProvider } from 'react-helmet-async';
import { SiteSettingsProvider } from './context/SiteSettingsContext';
import { SeoPageProvider } from './context/SeoPageContext';
import { CurrencyProvider } from './context/CurrencyContext';
import { CartProvider } from './context/CartContext';
import { AuthProvider } from './context/AuthContext';
import { Analytics } from '@vercel/analytics/react';
import SeoHead from './components/SeoHead';
import BackendStatusBanner from './components/BackendStatusBanner';
import PageAnalyticsBeacon from './components/PageAnalyticsBeacon';
import FaviconFromSettings from './components/FaviconFromSettings';
import { AWRP_INTRO_INDIA_PAYMENT_QR_PATH, INDIA_AWRP_SUCCESS_FROM } from './lib/awrpIntroProgram';
import IndiaSiteLayout from './layouts/IndiaSiteLayout';

const AdminPage = lazy(() => import('./pages/AdminPage'));
const AllProgramsPage = lazy(() => import('./pages/AllProgramsPage'));
const AllSessionsPage = lazy(() => import('./pages/AllSessionsPage'));
const PaymentSuccessPage = lazy(() => import('./pages/PaymentSuccessPage'));
const PaymentCancelPage = lazy(() => import('./pages/PaymentCancelPage'));
const PaymentRequestPage = lazy(() => import('./pages/PaymentRequestPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const ServicesPage = lazy(() => import('./pages/ServicesPage'));
const MediaPage = lazy(() => import('./pages/MediaPage'));
const TransformationsPage = lazy(() => import('./pages/TransformationsPage'));
const CaseStudiesPage = lazy(() => import('./pages/CaseStudiesPage'));
const CaseStudyDetailPage = lazy(() => import('./pages/CaseStudyDetailPage'));
const BlueprintImmersionDetailPage = lazy(() => import('./pages/BlueprintImmersionDetailPage'));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'));
const CartPage = lazy(() => import('./pages/CartPage'));
const CartCheckoutPage = lazy(() => import('./pages/CartCheckoutPage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const RefundCancellationPolicyPage = lazy(() => import('./pages/RefundCancellationPolicyPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const BlogPage = lazy(() => import('./pages/BlogPage'));
const BlogPostDetailPage = lazy(() => import('./pages/BlogPostDetailPage'));
const SponsorPage = lazy(() => import('./pages/SponsorPage'));
const IndiaPaymentPage = lazy(() => import('./pages/IndiaPaymentPage'));
const ManualPaymentPage = lazy(() => import('./pages/ManualPaymentPage'));
const ClientIntakePage = lazy(() => import('./pages/ClientIntakePage'));
const ContactUpdatePage = lazy(() => import('./pages/ContactUpdatePage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const StudentDashboard = lazy(() => import('./pages/StudentDashboard'));
const DashboardLayout = lazy(() => import('./layouts/DashboardLayout'));
const ProfilePage = lazy(() => import('./components/dashboard/ProfilePage'));
const OrderHistoryPage = lazy(() => import('./components/dashboard/OrderHistoryPage'));
const FinancialsPage = lazy(() => import('./components/dashboard/FinancialsPage'));
const AnnualPackagePurchasePage = lazy(() => import('./components/dashboard/AnnualPackagePurchasePage'));
const CalendarPage = lazy(() => import('./components/dashboard/CalendarPage'));
const ProgressPage = lazy(() => import('./components/dashboard/ProgressPage'));
const SoulGardenPage = lazy(() => import('./components/dashboard/SoulGardenPage'));
const TreeOfLifePage = lazy(() => import('./components/dashboard/TreeOfLifePage'));
const OceanPage = lazy(() => import('./components/dashboard/OceanPage'));
const MandalaPage = lazy(() => import('./components/dashboard/MandalaPage'));
const HeadspacePage = lazy(() => import('./components/dashboard/HeadspacePage'));
const BhaadPortalPage = lazy(() => import('./components/dashboard/BhaadPortalPage'));
const SoulTribePage = lazy(() => import('./components/dashboard/SoulTribePage'));
const StudentJourneyIntakePage = lazy(() => import('./components/dashboard/StudentJourneyIntakePage'));
const PointsPage = lazy(() => import('./components/dashboard/PointsPage'));
const DashboardCombinedCheckoutPage = lazy(() => import('./pages/DashboardCombinedCheckoutPage'));
const TrustSplitLayoutPreviewPage = lazy(() => import('./pages/TrustSplitLayoutPreviewPage'));
const MahalakshmiLandingPage = lazy(() => import('./pages/MahalakshmiLandingPage'));
const AwrpIntroCallPage = lazy(() => import('./pages/AwrpIntroCallPage'));
const AwrpIntroPaymentQrPage = lazy(() => import('./pages/AwrpIntroPaymentQrPage'));

const RouteFallback = () => (
  <div className="min-h-[50vh] flex items-center justify-center bg-gray-50">
    <div className="w-8 h-8 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
  </div>
);

const Lazy = ({ children }) => (
  <Suspense fallback={<RouteFallback />}>
    <RouteErrorBoundary>{children}</RouteErrorBoundary>
  </Suspense>
);

const IndiaPage = ({ children }) => (
  <IndiaSiteLayout>
    <Lazy>{children}</Lazy>
  </IndiaSiteLayout>
);

const AppContent = () => {
  const location = useLocation();

  if (location.hash && location.hash.includes('exchange=')) {
    return <AuthCallback />;
  }

  const searchFrom = new URLSearchParams(location.search).get('from');
  const indiaAwrpIntroOnly =
    location.pathname === '/india/awrp-intro-call'
    || location.pathname === AWRP_INTRO_INDIA_PAYMENT_QR_PATH
    || (location.pathname === '/payment/success' && searchFrom === INDIA_AWRP_SUCCESS_FROM);

  return (
    <>
      <FaviconFromSettings />
      <PageAnalyticsBeacon />
      {!indiaAwrpIntroOnly && <BackendStatusBanner />}
      <SeoHead />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/india" element={<HomePage checkoutSurface="india" />} />
        {process.env.NODE_ENV === 'development' && (
          <Route path="/preview/trust-split" element={<Lazy><TrustSplitLayoutPreviewPage /></Lazy>} />
        )}
        <Route path="/admin" element={<Lazy><AdminPage /></Lazy>} />
        <Route path="/programs" element={<Lazy><AllProgramsPage /></Lazy>} />
        <Route path="/india/programs" element={<IndiaPage><AllProgramsPage surface="india" /></IndiaPage>} />
        <Route path="/india/program" element={<Navigate to="/india/programs" replace />} />
        <Route path="/india/sessions" element={<IndiaPage><AllSessionsPage /></IndiaPage>} />
        <Route path="/india/session/:id" element={<IndiaPage><SessionDetailPage /></IndiaPage>} />
        <Route path="/india/services" element={<IndiaPage><ServicesPage /></IndiaPage>} />
        <Route path="/india/media" element={<IndiaPage><MediaPage /></IndiaPage>} />
        <Route path="/india/transformations" element={<IndiaPage><TransformationsPage /></IndiaPage>} />
        <Route path="/india/case-studies" element={<IndiaPage><CaseStudiesPage /></IndiaPage>} />
        <Route path="/india/case-studies/:slug" element={<IndiaPage><CaseStudyDetailPage /></IndiaPage>} />
        <Route path="/india/blueprint-immersion" element={<IndiaPage><BlueprintImmersionDetailPage /></IndiaPage>} />
        <Route path="/india/contact" element={<IndiaPage><ContactPage /></IndiaPage>} />
        <Route path="/india/about" element={<IndiaPage><AboutPage /></IndiaPage>} />
        <Route path="/india/blog" element={<IndiaPage><BlogPage /></IndiaPage>} />
        <Route path="/india/blog/:slug" element={<IndiaPage><BlogPostDetailPage /></IndiaPage>} />
        <Route path="/india/sponsor" element={<IndiaPage><SponsorPage /></IndiaPage>} />
        <Route path="/india/cart" element={<IndiaPage><CartPage /></IndiaPage>} />
        <Route path="/india/cart/checkout" element={<IndiaPage><CartCheckoutPage /></IndiaPage>} />
        <Route path="/india/terms" element={<IndiaPage><TermsPage /></IndiaPage>} />
        <Route path="/india/privacy" element={<IndiaPage><PrivacyPage /></IndiaPage>} />
        <Route path="/india/refund-cancellation" element={<IndiaPage><RefundCancellationPolicyPage /></IndiaPage>} />
        <Route path="/program" element={<Navigate to="/programs" replace />} />
        <Route path="/program/:id" element={<RouteErrorBoundary><ProgramDetailRoute /></RouteErrorBoundary>} />
        <Route
          path="/india/program/:id"
          element={(
            <IndiaSiteLayout>
              <RouteErrorBoundary><ProgramDetailRoute /></RouteErrorBoundary>
            </IndiaSiteLayout>
          )}
        />
        <Route path="/services" element={<Lazy><ServicesPage /></Lazy>} />
        <Route path="/sessions" element={<Lazy><AllSessionsPage /></Lazy>} />
        <Route path="/session/:id" element={<RouteErrorBoundary><SessionDetailPage /></RouteErrorBoundary>} />
        <Route path="/media" element={<Lazy><MediaPage /></Lazy>} />
        <Route path="/transformations" element={<Lazy><TransformationsPage /></Lazy>} />
        <Route path="/case-studies" element={<Lazy><CaseStudiesPage /></Lazy>} />
        <Route path="/case-studies/:slug" element={<Lazy><CaseStudyDetailPage /></Lazy>} />
        <Route path="/blueprint-immersion" element={<Lazy><BlueprintImmersionDetailPage /></Lazy>} />
        <Route path="/checkout/:type/:id" element={<Lazy><CheckoutPage /></Lazy>} />
        <Route path="/enroll/:type/:id" element={<RouteErrorBoundary><EnrollmentPage /></RouteErrorBoundary>} />
        <Route path="/cart" element={<Lazy><CartPage /></Lazy>} />
        <Route path="/cart/checkout" element={<Lazy><CartCheckoutPage /></Lazy>} />
        <Route path="/payment/success" element={<Lazy><PaymentSuccessPage /></Lazy>} />
        <Route path="/pay/:id" element={<Lazy><PaymentRequestPage /></Lazy>} />
        <Route path="/pay/:id/success" element={<Lazy><PaymentRequestPage /></Lazy>} />
        <Route path="/payment/cancel" element={<Lazy><PaymentCancelPage /></Lazy>} />
        <Route path="/india-payment/:enrollmentId" element={<Lazy><IndiaPaymentPage /></Lazy>} />
        <Route path="/manual-payment/:enrollmentId" element={<Lazy><ManualPaymentPage /></Lazy>} />
        <Route path="/manual-payment" element={<Lazy><ManualPaymentPage /></Lazy>} />
        <Route path="/dashboardaccessform" element={<Lazy><ClientIntakePage /></Lazy>} />
        <Route path="/client-intake" element={<Navigate to="/dashboardaccessform" replace />} />
        <Route path="/contact" element={<Lazy><ContactPage /></Lazy>} />
        <Route path="/update-contact/:token" element={<Lazy><ContactUpdatePage /></Lazy>} />
        <Route path="/terms" element={<Lazy><TermsPage /></Lazy>} />
        <Route path="/privacy" element={<Lazy><PrivacyPage /></Lazy>} />
        <Route path="/refund-cancellation" element={<Lazy><RefundCancellationPolicyPage /></Lazy>} />
        <Route path="/about" element={<Lazy><AboutPage /></Lazy>} />
        <Route path="/blog" element={<Lazy><BlogPage /></Lazy>} />
        <Route path="/blog/:slug" element={<Lazy><BlogPostDetailPage /></Lazy>} />
        <Route path="/sponsor" element={<Lazy><SponsorPage /></Lazy>} />
        <Route path="/india/shri-mahalakshmi-akshaya-samriddhi" element={<Lazy><MahalakshmiLandingPage /></Lazy>} />
        <Route path={AWRP_INTRO_INDIA_PAYMENT_QR_PATH} element={<Lazy><AwrpIntroPaymentQrPage /></Lazy>} />
        <Route path="/india/awrp-intro-call" element={<Lazy><AwrpIntroCallPage /></Lazy>} />
        <Route path="/awrp-intro-call" element={<Lazy><AwrpIntroCallPage surface="website" /></Lazy>} />
        <Route path="/login" element={<Lazy><LoginPage /></Lazy>} />
        <Route path="/dashboard" element={<Lazy><DashboardLayout /></Lazy>}>
          <Route index element={<Lazy><StudentDashboard /></Lazy>} />
          <Route path="profile" element={<Lazy><ProfilePage /></Lazy>} />
          <Route path="orders" element={<Lazy><OrderHistoryPage /></Lazy>} />
          <Route path="financials" element={<Lazy><FinancialsPage /></Lazy>} />
          <Route path="home-coming-package" element={<Lazy><AnnualPackagePurchasePage /></Lazy>} />
          <Route path="points" element={<Lazy><PointsPage /></Lazy>} />
          <Route path="combined-checkout" element={<Lazy><DashboardCombinedCheckoutPage /></Lazy>} />
          <Route path="sessions" element={<Lazy><CalendarPage /></Lazy>} />
          <Route path="progress" element={<Lazy><ProgressPage /></Lazy>} />
          <Route path="journey-intake" element={<Lazy><StudentJourneyIntakePage /></Lazy>} />
          <Route path="garden" element={<Lazy><SoulGardenPage /></Lazy>} />
          <Route path="garden/tree" element={<Lazy><TreeOfLifePage /></Lazy>} />
          <Route path="garden/ocean" element={<Lazy><OceanPage /></Lazy>} />
          <Route path="garden/mandala" element={<Lazy><MandalaPage /></Lazy>} />
          <Route path="garden/zen" element={<Lazy><HeadspacePage /></Lazy>} />
          <Route path="bhaad" element={<Lazy><BhaadPortalPage /></Lazy>} />
          <Route path="tribe" element={<Lazy><SoulTribePage /></Lazy>} />
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
                  <CartProvider>
                    <AppContent />
                    <Toaster />
                  </CartProvider>
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
