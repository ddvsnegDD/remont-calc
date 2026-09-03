import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';

// Pages
import HomePage from './pages/HomePage';
import LoginChoicePage from './pages/LoginChoicePage';
import B2CQuizPage from './pages/B2CQuizPage';
import B2CDetailPage from './pages/B2CDetailPage';
import B2CResultPage from './pages/B2CResultPage';
import B2CResultDetailPage from './pages/B2CResultDetailPage';
import B2BLoginPage from './pages/B2BLoginPage';
import B2BCabinetPage from './pages/B2BCabinetPage';
import B2BProfilePage from './pages/B2BProfilePage';
import B2BQuizPage from './pages/B2BQuizPage';
import B2BResultPage from './pages/B2BResultPage';
import B2BOfficePage from './pages/B2BOfficePage';
import B2BOfficeResultPage from './pages/B2BOfficeResultPage';
import { lazy, Suspense } from 'react';
const B2BOfficeDetailPage = lazy(() => import('./pages/B2BOfficeDetailPage'));
import ClubPage from './pages/ClubPage';
import ProPage from './pages/ProPage';
import PrivacyPage from './pages/PrivacyPage';
import OfferPage from './pages/OfferPage';
import ConsentPage from './pages/ConsentPage';
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
        <Route path="/b2c-book" element={<Navigate to="/b2c" replace />} />

        {/* B2B */}
        <Route path="/b2b-login" element={<B2BLoginPage />} />
        <Route path="/b2b-cabinet" element={<B2BCabinetPage />} />
        <Route path="/b2b-profile" element={<B2BProfilePage />} />
        <Route path="/b2b-quiz" element={<B2BQuizPage />} />
        <Route path="/b2b-result" element={<B2BResultPage />} />
        <Route path="/b2b-office" element={<B2BOfficePage />} />
        <Route path="/b2b-office-result" element={<B2BOfficeResultPage />} />
        <Route path="/b2b-office-detail" element={<Suspense fallback={<div style={{minHeight:'80vh',display:'grid',placeItems:'center'}}>Загрузка калькулятора...</div>}><B2BOfficeDetailPage /></Suspense>} />

        {/* Standalone */}
        <Route path="/club" element={<ClubPage />} />
        <Route path="/pro" element={<ProPage />} />
        <Route path="/partner-b2b" element={<Navigate to="/" replace />} />
        <Route path="/partner-b2c" element={<Navigate to="/" replace />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/offer" element={<OfferPage />} />
        <Route path="/consent" element={<ConsentPage />} />
        <Route path="/checklists" element={<ChecklistsPage />} />
        <Route path="/checklists/:id" element={<ChecklistDetailPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </>
  );
}
