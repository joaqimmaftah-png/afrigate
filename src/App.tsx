import { BrowserRouter, Routes, Route, Link, useParams } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ServicesProvider } from './contexts/ServicesContext';
import { handleGoogleRedirect } from './lib/googleAuth';
import PublicLayout from './components/PublicLayout';
import PortalLayout from './components/PortalLayout';
import ProtectedRoute from './components/ProtectedRoute';
import ConsultationWorkspace from './components/ConsultationWorkspace';
import Home from './pages/public/Home';
import Services from './pages/public/Services';
import ServiceDetail from './pages/public/ServiceDetail';
import About from './pages/public/About';
import Articles from './pages/public/Articles';
import ArticleDetail from './pages/public/ArticleDetail';
import Track from './pages/public/Track';
import Contact from './pages/public/Contact';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import Dashboard from './pages/portal/Dashboard';
import NewConsultation from './pages/portal/NewConsultation';
import ConsultationList from './pages/shared/ConsultationList';
import Appointments from './pages/shared/Appointments';
import Documents from './pages/shared/Documents';
import Profile from './pages/shared/Profile';
import Overview from './pages/staff/Overview';
import Users from './pages/staff/Users';
import ServicesAdmin from './pages/staff/ServicesAdmin';
import Content from './pages/staff/Content';
import Enquiries from './pages/staff/Enquiries';
import Reports from './pages/staff/Reports';
import Audit from './pages/staff/Audit';

handleGoogleRedirect();

function WorkspaceRoute({ mode }: { mode: 'customer' | 'staff' }) {
  const { id } = useParams();
  return <ConsultationWorkspace key={id} id={Number(id)} mode={mode} />;
}

function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <div className="font-display text-6xl font-extrabold text-gold">404</div>
      <h1 className="mt-2 font-display text-2xl font-bold text-navy">Page not found</h1>
      <p className="mt-2 text-muted">The page you are looking for doesn’t exist or has moved.</p>
      <Link to="/" className="btn btn-navy mt-6">Back to home</Link>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ServicesProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<PublicLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/services" element={<Services />} />
              <Route path="/services/:slug" element={<ServiceDetail />} />
              <Route path="/about" element={<About />} />
              <Route path="/tax-information" element={<Articles key="tax" category="tax" />} />
              <Route path="/tax-information/:slug" element={<ArticleDetail category="tax" />} />
              <Route path="/news" element={<Articles key="news" category="news" />} />
              <Route path="/news/:slug" element={<ArticleDetail category="news" />} />
              <Route path="/track" element={<Track />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="*" element={<NotFound />} />
            </Route>

            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            <Route path="/portal" element={<ProtectedRoute roles={['customer']}><PortalLayout area="customer" /></ProtectedRoute>}>
              <Route index element={<Dashboard />} />
              <Route path="new" element={<NewConsultation />} />
              <Route path="requests" element={<ConsultationList mode="customer" />} />
              <Route path="requests/:id" element={<WorkspaceRoute mode="customer" />} />
              <Route path="appointments" element={<Appointments mode="customer" />} />
              <Route path="documents" element={<Documents mode="customer" />} />
              <Route path="profile" element={<Profile />} />
            </Route>

            <Route path="/staff" element={<ProtectedRoute roles={['consultant', 'admin']}><PortalLayout area="staff" /></ProtectedRoute>}>
              <Route index element={<Overview />} />
              <Route path="consultations" element={<ConsultationList mode="staff" />} />
              <Route path="consultations/:id" element={<WorkspaceRoute mode="staff" />} />
              <Route path="appointments" element={<Appointments mode="staff" />} />
              <Route path="documents" element={<Documents mode="staff" />} />
              <Route path="profile" element={<Profile />} />
              <Route path="users" element={<ProtectedRoute roles={['admin']}><Users /></ProtectedRoute>} />
              <Route path="services" element={<ProtectedRoute roles={['admin']}><ServicesAdmin /></ProtectedRoute>} />
              <Route path="content" element={<ProtectedRoute roles={['admin']}><Content /></ProtectedRoute>} />
              <Route path="enquiries" element={<ProtectedRoute roles={['admin']}><Enquiries /></ProtectedRoute>} />
              <Route path="reports" element={<ProtectedRoute roles={['admin']}><Reports /></ProtectedRoute>} />
              <Route path="audit" element={<ProtectedRoute roles={['admin']}><Audit /></ProtectedRoute>} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ServicesProvider>
    </AuthProvider>
  );
}
