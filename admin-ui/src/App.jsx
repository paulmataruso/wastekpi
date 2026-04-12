import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import RouteLogs from './pages/RouteLogs';
import RoutesMgmt from './pages/RoutesMgmt';
import EmployeesMgmt from './pages/EmployeesMgmt';
import Admin from './pages/Admin';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));

  const handleLogin = (t) => {
    localStorage.setItem('token', t);
    setToken(t);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    setToken(null);
  };

  if (!token) return <Login onLogin={handleLogin} />;

  return (
    <BrowserRouter basename="/admin">
      <Layout onLogout={handleLogout}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/route-logs" element={<RouteLogs />} />
          <Route path="/routes" element={<RoutesMgmt />} />
          <Route path="/employees" element={<EmployeesMgmt />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
