import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import PaymentLink from './pages/PaymentLink';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import ClientDetail from './pages/ClientDetail';
import Products from './pages/Products';
import NewInvoice from './pages/Newinvoice';
import EditInvoice from './pages/Editinvoice';
import InvoiceDetail from './pages/Invoicedetail ';
import Estimates from './pages/Estimates';
import EstimateDetail from './pages/EstimateDetail';
import EstimateView from './pages/EstimateView';
import Payments from './pages/Payments';
import Notifications from './pages/Notifications';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Recurring from './pages/Recurring';
import Members from './pages/Members';
import JoinWorkspace from './pages/JoinWorkspace';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/pay/:token" element={<PaymentLink />} />
          {/* Public quote page: reviewed and answered by clients with no account. */}
          <Route path="/q/:token" element={<EstimateView />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/clients" element={<ProtectedRoute><Clients /></ProtectedRoute>} />
          <Route path="/clients/:id" element={<ProtectedRoute><ClientDetail /></ProtectedRoute>} />
          <Route path="/products" element={<ProtectedRoute><Products /></ProtectedRoute>} />
          <Route path="/payments" element={<ProtectedRoute><Payments /></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
          <Route path="/invoices/new" element={<ProtectedRoute><NewInvoice /></ProtectedRoute>} />
          <Route path="/invoices/:id/edit" element={<ProtectedRoute><EditInvoice /></ProtectedRoute>} />
          <Route path="/invoices/:id" element={<ProtectedRoute><InvoiceDetail /></ProtectedRoute>} />
          <Route path="/estimates" element={<ProtectedRoute><Estimates /></ProtectedRoute>} />
          <Route path="/estimates/:id" element={<ProtectedRoute><EstimateDetail /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings/></ProtectedRoute>} />
          <Route path="/recurring" element={<ProtectedRoute><Recurring /></ProtectedRoute>} />
          <Route path="/members" element={<ProtectedRoute><Members /></ProtectedRoute>} />
          <Route path="/join" element={<ProtectedRoute><JoinWorkspace /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;