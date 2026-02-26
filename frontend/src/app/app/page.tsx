"use client";

import { useState } from "react";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import Dashboard from "@/components/Dashboard";
import LabUploader from "@/components/LabUploader";
import SymptomChecker from "@/components/SymptomChecker";
import PatientHistory from "@/components/PatientHistory";
import AskAI from "@/components/AskAI";
import TrendCharts from "@/components/TrendCharts";
import type { Tab } from "@/types";
import OnboardingModal from "@/components/OnboardingModal";

function AppContent() {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [lastReportId, setLastReportId] = useState<string | null>(null);
  const { patientId } = useAuth();

  const handleViewReport = (id: string) => {
    setLastReportId(id);
    setActiveTab("history");
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <OnboardingModal />
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onViewReport={handleViewReport}
      />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === "dashboard" && (
          <Dashboard setActiveTab={setActiveTab} patientId={patientId} />
        )}
        {activeTab === "upload" && (
          <LabUploader
            onReportUploaded={(id) => setLastReportId(id)}
            patientId={patientId}
          />
        )}
        {activeTab === "symptoms" && <SymptomChecker patientId={patientId} />}
        {activeTab === "history" && (
          <PatientHistory
            onViewReport={(id) => setLastReportId(id)}
            patientId={patientId}
          />
        )}
        {activeTab === "trends" && <TrendCharts patientId={patientId} />}
        {activeTab === "ask" && <AskAI reportId={lastReportId} patientId={patientId} />}
      </main>

      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-400">
        <p>MedLab AI is for educational purposes only. Always consult a qualified healthcare provider for diagnosis and treatment.</p>
        <p className="mt-1">Powered by Claude Opus 4.6 · © 2025 MedLab AI</p>
      </footer>
    </div>
  );
}

export default function AppPage() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
