import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';

function ComingSoon({ title }) {
  return <div className="p-8 text-[#464555]">{title} — coming soon.</div>;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/clients" element={<ProtectedRoute><ComingSoon title="Clients" /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><ComingSoon title="Reports" /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><ComingSoon title="Settings" /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;