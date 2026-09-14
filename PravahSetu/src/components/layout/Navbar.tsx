import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  Shield,
  Menu,
  X,
  User as UserIcon,
  LogOut,
  LayoutDashboard,
  FilePlus,
  Globe,
  ChevronDown,
  Lock,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useAccessibility } from '../../context/AccessibilityContext';
import { useToast } from '../../context/ToastContext';
import { AshokaEmblem } from '../ui/AshokaEmblem';

export const Navbar: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const { user, isAuthenticated, logout } = useAuth();
  const { language, setLanguage } = useLanguage();
  const { textSize, increaseTextSize, decreaseTextSize, resetTextSize } = useAccessibility();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    setUserDropdownOpen(false);
    showToast('info', 'Logged Out', 'You have been safely signed out.');
    navigate('/');
  };

  const navLinks = [
    { to: '/', label: 'Home' },
    { to: '/report', label: 'Report Crime' },
    { to: '/track', label: 'Track Complaint' },
    { to: '/awareness', label: 'Awareness' },
    { to: '/about', label: 'About' },
    { to: '/contact', label: 'Contact' },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-xs select-none animate-fade-down">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Left Brand Area */}
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Government of India Emblem Treatment */}
            <div className="flex items-center gap-2 pr-3 sm:pr-4 border-r animate-border-glow">
              <AshokaEmblem className="w-8 h-10 shrink-0" variant="dark" />
              <div className="text-left leading-tight hidden sm:block">
                <p className="text-xs font-bold text-slate-900 tracking-tight animate-gov-title">Government of India</p>
                <p className="text-[10px] text-slate-500 font-medium animate-gov-sub">Ministry of Home Affairs</p>
              </div>
            </div>

            {/* Pravah Setu Logo & Tagline */}
            <Link to="/" className="flex items-center gap-2.5 group focus:outline-none">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyber-500 to-cyber-700 flex items-center justify-center text-white shadow-sm group-hover:scale-110 transition-transform duration-300 animate-shield-pulse">
                <Shield className="w-6 h-6 drop-shadow-sm" />
              </div>
              <div className="text-left leading-tight">
                <span className="text-lg font-black tracking-tight block animate-logo-shimmer">
                  PRAVAH SETU
                </span>
                <span className="text-[11px] font-semibold text-cyber-600 tracking-tight block animate-gov-sub">
                  Report. Track. Prevent.
                </span>
              </div>
            </Link>
          </div>

          {/* Center Navigation Links */}
          <nav className="hidden lg:flex items-center space-x-1" aria-label="Main Navigation">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `px-3.5 py-2 text-sm font-semibold transition-all relative ${
                    isActive
                      ? 'text-cyber-700 font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span>{link.label}</span>
                    {isActive && (
                      <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-cyber-600 rounded-full" />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Right Utilities: A- A A+, Language, Login */}
          <div className="hidden sm:flex items-center gap-3">
            {/* Accessibility Controls: A- A A+ */}
            <div className="flex items-center text-xs font-bold text-slate-600 gap-1 pr-1 border-r border-slate-200">
              <button
                type="button"
                onClick={decreaseTextSize}
                className={`px-1.5 py-0.5 rounded hover:text-cyber-600 transition ${
                  textSize === 'sm' ? 'text-cyber-600 font-extrabold' : ''
                }`}
                title="Small text size"
              >
                A-
              </button>
              <button
                type="button"
                onClick={resetTextSize}
                className={`px-1.5 py-0.5 rounded hover:text-cyber-600 transition ${
                  textSize === 'base' ? 'text-cyber-600 font-extrabold' : ''
                }`}
                title="Normal text size"
              >
                A
              </button>
              <button
                type="button"
                onClick={increaseTextSize}
                className={`px-1.5 py-0.5 rounded hover:text-cyber-600 transition ${
                  textSize === 'lg' ? 'text-cyber-600 font-extrabold' : ''
                }`}
                title="Large text size"
              >
                A+
              </button>
            </div>

            {/* Language Dropdown Selector */}
            <button
              type="button"
              onClick={() => setLanguage(language === 'en' ? 'hi' : 'en')}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-cyber-600 px-2 py-1 rounded transition"
            >
              <Globe className="w-3.5 h-3.5 text-slate-500" />
              <span>{language === 'en' ? 'English' : 'हिन्दी'}</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {/* Login Pill Button */}
            {isAuthenticated && user ? (
              <div className="relative">
                <button
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full bg-cyber-600 text-white font-semibold text-xs shadow-sm hover:bg-cyber-700 transition"
                >
                  <UserIcon className="w-3.5 h-3.5" />
                  <span>{user.fullName.split(' ')[0]}</span>
                  <ChevronDown className="w-3 h-3" />
                </button>

                {userDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in">
                    <div className="px-3 py-2 border-b border-slate-100 text-left">
                      <p className="text-xs font-bold text-slate-800">{user.fullName}</p>
                      <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
                    </div>
                    <Link
                      to="/dashboard"
                      onClick={() => setUserDropdownOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-cyber-600 text-left"
                    >
                      <LayoutDashboard className="w-4 h-4" /> Dashboard
                    </Link>
                    <Link
                      to="/report"
                      onClick={() => setUserDropdownOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-cyber-600 text-left"
                    >
                      <FilePlus className="w-4 h-4" /> New Complaint
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 text-left"
                    >
                      <LogOut className="w-4 h-4" /> Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link to="/login">
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyber-600 hover:bg-cyber-700 text-white text-xs font-bold shadow-sm shadow-cyber-600/20 transition-all active:scale-95"
                >
                  <UserIcon className="w-3.5 h-3.5" />
                  <span>Login</span>
                </button>
              </Link>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex items-center gap-2 lg:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-6 space-y-3 shadow-lg text-left">
          <div className="flex flex-col space-y-1">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `px-3.5 py-2.5 rounded-xl text-sm font-semibold block ${
                    isActive
                      ? 'text-cyber-700 bg-cyber-50 font-bold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </div>

          <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
            {isAuthenticated && user ? (
              <Link
                to="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-slate-100 text-slate-800 text-sm font-bold"
              >
                <LayoutDashboard className="w-4 h-4" />
                Citizen Dashboard
              </Link>
            ) : (
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-cyber-600 text-white text-sm font-bold"
              >
                <UserIcon className="w-4 h-4" />
                Login
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
