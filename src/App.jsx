import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';

// Pages
import HomePage from './pages/HomePage';
import LoginChoicePage from './pages/LoginChoicePage';
import B2CQuizPage from './pages/B2CQuizPage';
import B2CDetailPage from './pages/B2CDetailPage';
import B2CResultPage from './pages/B2CResultPage';
import B2CResultDetailPage from './pages/B2CResultDetailPage';
import B2CBookPage from './pages/B2CBookPage';
import B2BLoginPage from './pages/B2BLoginPage';
import B2BCabinetPage from './pages/B2BCabinetPage';
import B2BQuizPage from './pages/B2BQuizPage';
import B2BResultPage from './pages/B2BResultPage';
import B2BOfficePage from './pages/B2BOfficePage';
import B2BOfficeResultPage from './pages/B2BOfficeResultPage';
import ClubPage from './pages/ClubPage';
import ProPage from './pages/ProPage';
import PartnerB2BPage from './pages/PartnerB2BPage';
import PartnerB2CPage from './pages/PartnerB2CPage';
import DashboardPage from './pages/DashboardPage';
import PrivacyPage from './pages/PrivacyPage';
import OfferPage from './pages/OfferPage';
import AdminPage from './pages/AdminPage';
import ChecklistsPage from './pages/ChecklistsPage';
import ChecklistDetailPage from './pages/ChecklistDetailPage';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginChoicePage />} />
        <Route path="/auth" element={<Navigate to="/login" replace />} />

        {/* B2C */}
        <Route path="/b2c" element={<B2CQuizPage />} />
        <Route path="/b2c-detail" element={<B2CDetailPage />} />
        <Route path="/b2c-result" element={<B2CResultPage />} />
        <Route path="/b2c-result-detail" element={<B2CResultDetailPage />} />
        <Route path="/b2c-book" element={<B2CBookPage />} />

        {/* B2B */}
        <Route path="/b2b-login" element={<B2BLoginPage />} />
        <Route path="/b2b-cabinet" element={<B2BCabinetPage />} />
        <Route path="/b2b-quiz" element={<B2BQuizPage />} />
        <Route path="/b2b-result" element={<B2BResultPage />} />
        <Route path="/b2b-office" element={<B2BOfficePage />} />
        <Route path="/b2b-office-result" element={<B2BOfficeResultPage />} />

        {/* Standalone */}
        <Route path="/club" element={<ClubPage />} />
        <Route path="/pro" element={<ProPage />} />
        <Route path="/partner-b2b" element={<PartnerB2BPage />} />
        <Route path="/partner-b2c" element={<PartnerB2CPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/offer" element={<OfferPage />} />
        <Route path="/checklists" element={<ChecklistsPage />} />
        <Route path="/checklists/:id" element={<ChecklistDetailPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </>
  );
}
