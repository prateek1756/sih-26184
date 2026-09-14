import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { Landing } from '../pages/Landing';
import { Login } from '../pages/Login';
import { Dashboard } from '../pages/Dashboard';
import { DataIngestion } from '../pages/DataIngestion';
import { TransactionAnalysis } from '../pages/TransactionAnalysis';
import { PatternDetection } from '../pages/PatternDetection';
import { RiskAnalysis } from '../pages/RiskAnalysis';
import { KnowledgeGraph } from '../pages/KnowledgeGraph';
import { GeographicIntelligence } from '../pages/GeographicIntelligence';
import { PredictiveForecast } from '../pages/PredictiveForecast';
import { AlertCenter } from '../pages/AlertCenter';
import { ComplaintsIntelligence } from '../pages/ComplaintsIntelligence';
import { InvestigationWorkspace } from '../pages/InvestigationWorkspace';
import { CommandLayout } from '../components/layout/CommandLayout';

export const AppRouter: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Landing Page */}
          <Route path="/" element={<Landing />} />

          {/* Authentication */}
          <Route path="/login" element={<Login />} />

          {/* Command Center Layout Routes */}
          <Route
            path="/dashboard"
            element={
              <CommandLayout>
                <Dashboard />
              </CommandLayout>
            }
          />
          <Route
            path="/dashboard/ingestion"
            element={
              <CommandLayout>
                <DataIngestion />
              </CommandLayout>
            }
          />
          <Route
            path="/dashboard/sources"
            element={
              <CommandLayout>
                <DataIngestion />
              </CommandLayout>
            }
          />
          <Route
            path="/dashboard/transactions"
            element={
              <CommandLayout>
                <TransactionAnalysis />
              </CommandLayout>
            }
          />
          <Route
            path="/dashboard/patterns"
            element={
              <CommandLayout>
                <PatternDetection />
              </CommandLayout>
            }
          />
          <Route
            path="/dashboard/risk"
            element={
              <CommandLayout>
                <RiskAnalysis />
              </CommandLayout>
            }
          />
          <Route
            path="/dashboard/graph"
            element={
              <CommandLayout>
                <KnowledgeGraph />
              </CommandLayout>
            }
          />
          <Route
            path="/dashboard/geo"
            element={
              <CommandLayout>
                <GeographicIntelligence />
              </CommandLayout>
            }
          />
          <Route
            path="/dashboard/ai"
            element={
              <CommandLayout>
                <PredictiveForecast />
              </CommandLayout>
            }
          />
          <Route
            path="/dashboard/forecast"
            element={
              <CommandLayout>
                <PredictiveForecast />
              </CommandLayout>
            }
          />
          <Route
            path="/dashboard/alerts"
            element={
              <CommandLayout>
                <AlertCenter />
              </CommandLayout>
            }
          />
          <Route
            path="/dashboard/complaints"
            element={
              <CommandLayout>
                <ComplaintsIntelligence />
              </CommandLayout>
            }
          />
          <Route
            path="/dashboard/investigations"
            element={
              <CommandLayout>
                <InvestigationWorkspace />
              </CommandLayout>
            }
          />
          <Route
            path="/dashboard/reports"
            element={
              <CommandLayout>
                <InvestigationWorkspace />
              </CommandLayout>
            }
          />
          <Route
            path="/dashboard/settings"
            element={
              <CommandLayout>
                <AlertCenter />
              </CommandLayout>
            }
          />

          {/* 404 fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};
