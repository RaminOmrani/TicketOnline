import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './store/auth';
import { PageLoader } from './components/ui';
import AppShell from './components/layout/AppShell';

const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'));
const ForgotPage = lazy(() => import('./pages/auth/ForgotPage'));
const ResetPage = lazy(() => import('./pages/auth/ResetPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const TicketsPage = lazy(() => import('./pages/TicketsPage'));
const NewTicketPage = lazy(() => import('./pages/NewTicketPage'));
const TicketPage = lazy(() => import('./pages/TicketPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const KbListPage = lazy(() => import('./pages/kb/KbListPage'));
const KbArticlePage = lazy(() => import('./pages/kb/KbArticlePage'));
const CustomersPage = lazy(() => import('./pages/CustomersPage'));
const CannedPage = lazy(() => import('./pages/CannedPage'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminDepartments = lazy(() => import('./pages/admin/AdminDepartments'));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'));
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'));
const AdminKb = lazy(() => import('./pages/admin/AdminKb'));

function RequireAuth({ children }: { children: React.ReactElement }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

function RequireRole({ roles, children }: { roles: string[]; children: React.ReactElement }) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function GuestOnly({ children }: { children: React.ReactElement }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (user) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
        <Route path="/register" element={<GuestOnly><RegisterPage /></GuestOnly>} />
        <Route path="/forgot-password" element={<GuestOnly><ForgotPage /></GuestOnly>} />
        <Route path="/reset-password" element={<ResetPage />} />
        <Route element={<RequireAuth><AppShell /></RequireAuth>}>
          <Route index element={<DashboardPage />} />
          <Route path="tickets" element={<TicketsPage />} />
          <Route path="tickets/new" element={<NewTicketPage />} />
          <Route path="tickets/:id" element={<TicketPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="kb" element={<KbListPage />} />
          <Route path="kb/:slug" element={<KbArticlePage />} />
          <Route path="customers" element={<RequireRole roles={['agent', 'admin']}><CustomersPage /></RequireRole>} />
          <Route path="canned" element={<RequireRole roles={['agent', 'admin']}><CannedPage /></RequireRole>} />
          <Route path="admin" element={<RequireRole roles={['admin']}><AdminDashboard /></RequireRole>} />
          <Route path="admin/departments" element={<RequireRole roles={['admin']}><AdminDepartments /></RequireRole>} />
          <Route path="admin/users" element={<RequireRole roles={['admin']}><AdminUsers /></RequireRole>} />
          <Route path="admin/kb" element={<RequireRole roles={['admin']}><AdminKb /></RequireRole>} />
          <Route path="admin/settings" element={<RequireRole roles={['admin']}><AdminSettings /></RequireRole>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
