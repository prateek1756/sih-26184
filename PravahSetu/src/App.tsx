import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { AccessibilityProvider } from './context/AccessibilityContext';
import { EmergencyBanner } from './components/layout/EmergencyBanner';
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { ScrollToTop } from './components/layout/ScrollToTop';

// Pages
import { Home } from './pages/Home';
import { ReportComplaint } from './pages/ReportComplaint';
import { ComplaintSuccess } from './pages/ComplaintSuccess';
import { TrackComplaint } from './pages/TrackComplaint';
import { Dashboard } from './pages/Dashboard';
import { ComplaintDetails } from './pages/ComplaintDetails';
import { Awareness } from './pages/Awareness';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { About } from './pages/About';
import { Contact } from './pages/Contact';
import { NotFound } from './pages/NotFound';

export function App() {
  return (
    <BrowserRouter>
      <AccessibilityProvider>
        <LanguageProvider>
          <AuthProvider>
            <ToastProvider>
              <div className="flex flex-col min-h-screen w-full bg-slate-50 text-slate-900 selection:bg-cyber-500 selection:text-white">
                <ScrollToTop />
                <EmergencyBanner />
                <Navbar />
                <main className="flex-1 flex flex-col w-full">
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/report" element={<ReportComplaint />} />
                    <Route path="/complaint-success" element={<ComplaintSuccess />} />
                    <Route path="/track" element={<TrackComplaint />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/complaint/:id" element={<ComplaintDetails />} />
                    <Route path="/awareness" element={<Awareness />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/about" element={<About />} />
                    <Route path="/contact" element={<Contact />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </main>
                <Footer />
              </div>
            </ToastProvider>
          </AuthProvider>
        </LanguageProvider>
      </AccessibilityProvider>
    </BrowserRouter>
  );
}

export default App;
