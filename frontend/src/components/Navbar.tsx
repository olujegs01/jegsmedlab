"use client";

import type { Tab } from "@/types";
import {
  LayoutDashboard, Upload, Activity, History,
  TrendingUp, MessageCircle, FlaskConical,
  LogOut, User, ChevronDown,
} from "lucide-react";
import clsx from "clsx";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import AlertBell from "./AlertBell";

interface NavbarProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  onViewReport?: (id: string) => void;
}

const navItems: { id: Tab; label: string; icon: React.ElementType; color: string }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, color: "text-blue-600" },
  { id: "upload", label: "Analyze Labs", icon: Upload, color: "text-indigo-600" },
  { id: "symptoms", label: "Symptoms", icon: Activity, color: "text-purple-600" },
  { id: "trends", label: "Trends", icon: TrendingUp, color: "text-teal-600" },
  { id: "history", label: "History", icon: History, color: "text-slate-600" },
  { id: "ask", label: "Ask AI", icon: MessageCircle, color: "text-emerald-600" },
];

export default function Navbar({ activeTab, setActiveTab, onViewReport }: NavbarProps) {
  const { user, logout, isDemo, patientId } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    if (userMenuOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [userMenuOpen]);

  return (
    <>
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-sm">
              <FlaskConical className="w-5 h-5 text-white" />
            </div>
            <div className="hidden sm:block">
              <span className="font-bold text-slate-900 text-lg leading-tight">JegsMedLab</span>
              <p className="text-xs text-slate-400 leading-tight">Intelligent Lab Interpreter</p>
            </div>
          </div>

          {/* Nav items */}
          <div className="flex items-center gap-0.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={clsx(
                    "flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-all duration-150",
                    isActive
                      ? "bg-blue-50 text-blue-700"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  )}
                >
                  <Icon className={clsx("w-4 h-4", isActive ? "text-blue-600" : item.color)} />
                  <span className="hidden md:block">{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Right side: alerts + user */}
          <div className="flex items-center gap-2">
            {/* Alert Bell */}
            <AlertBell patientId={patientId} onViewReport={onViewReport} />

            {/* User menu */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-200"
              >
                <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                  <User className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="hidden sm:block text-sm font-medium text-slate-700 max-w-[100px] truncate">
                  {isDemo ? "Demo Mode" : (user?.full_name || user?.email)}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
                  {isDemo ? (
                    <div className="p-3">
                      <p className="text-xs font-semibold text-slate-800">Demo Mode</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Data is not saved between sessions
                      </p>
                    </div>
                  ) : (
                    <div className="p-3 border-b border-slate-100">
                      <p className="text-xs font-semibold text-slate-800 truncate">
                        {user?.full_name}
                      </p>
                      <p className="text-xs text-slate-400 truncate mt-0.5">{user?.email}</p>
                    </div>
                  )}
                  <div className="p-1">
                    {!isDemo && (
                      <>
                        <button
                          onClick={async () => {
                            try {
                              const token = localStorage.getItem("jegsmedlab_token");
                              const res = await fetch("/api/billing/checkout", {
                                method: "POST",
                                headers: { Authorization: `Bearer ${token}` },
                              });
                              const data = await res.json();
                              if (data.checkout_url) window.location.href = data.checkout_url;
                            } catch {}
                            setUserMenuOpen(false);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors font-medium"
                        >
                          ⚡ Upgrade to Pro
                        </button>
                        <button
                          onClick={() => {
                            logout();
                            setUserMenuOpen(false);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <LogOut className="w-4 h-4" />
                          Sign Out
                        </button>
                      </>
                    )}
                    {isDemo && (
                      <div className="px-3 py-2">
                        <p className="text-xs text-blue-600 font-medium">
                          Create an account to save your data
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>

    {/* Mobile bottom navigation */}
    <div className="fixed bottom-0 left-0 right-0 md:hidden bg-white border-t border-slate-200 z-50 safe-bottom">
      <div className="grid grid-cols-6 h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          const shortLabel = item.label === "Analyze Labs" ? "Labs" : item.label === "Dashboard" ? "Home" : item.label;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={clsx(
                "flex flex-col items-center justify-center gap-0.5 text-[9px] font-semibold transition-colors px-1",
                isActive ? "text-blue-600" : "text-slate-400"
              )}
            >
              <Icon className={clsx("w-5 h-5", isActive ? "text-blue-600" : "text-slate-400")} />
              <span className="leading-none">{shortLabel}</span>
            </button>
          );
        })}
      </div>
    </div>
  </>
  );
}
