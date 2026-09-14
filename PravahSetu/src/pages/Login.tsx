import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Shield,
  Lock,
  Phone,
  Mail,
  ArrowRight,
  KeyRound,
  Sparkles,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardContent } from '../components/ui/Card';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export const Login: React.FC = () => {
  const [tab, setTab] = useState<'password' | 'otp'>('otp');
  const [identifier, setIdentifier] = useState('aarav.sharma@example.com');
  const [password, setPassword] = useState('DemoPassword@2026');
  const [mobile, setMobile] = useState('9876543210');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [timer, setTimer] = useState(30);

  const { loginWithPassword, loginWithOtp, isLoading } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (otpSent && timer > 0) {
      interval = setInterval(() => setTimer((t) => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [otpSent, timer]);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      showToast('error', 'Error', 'Please enter your registered Email or Mobile Number.');
      return;
    }
    try {
      await loginWithPassword(identifier);
      showToast('success', 'Welcome Back', 'Signed in successfully.');
      navigate('/dashboard');
    } catch {
      showToast('error', 'Authentication Failed', 'Invalid credentials.');
    }
  };

  const handleSendOtp = () => {
    if (!mobile || mobile.length < 10) {
      showToast('error', 'Error', 'Please enter a valid 10-digit mobile number.');
      return;
    }
    setOtpSent(true);
    setTimer(30);
    showToast('info', 'OTP Dispatched', 'Simulated OTP: 261840 (Auto-filling for convenience)');
    setOtp('261840');
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length < 6) {
      showToast('error', 'Error', 'Please enter the 6-digit OTP.');
      return;
    }
    try {
      await loginWithOtp(mobile, otp);
      showToast('success', 'Verified Successfully', 'Signed in to citizen portal.');
      navigate('/dashboard');
    } catch {
      showToast('error', 'Invalid OTP', 'The OTP entered is incorrect. Try 261840.');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 py-12 px-4 sm:px-6">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full"
      >
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-navy-900 text-cyber-400 shadow-md mb-3">
            <Shield className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-extrabold text-navy-900 tracking-tight">Citizen Login</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Access your complaints, investigation timeline, and FIR slips
          </p>
        </div>

        <Card className="border-slate-200 shadow-card overflow-hidden">
          {/* Dual Tab: OTP vs Password */}
          <div className="flex border-b border-slate-200 bg-slate-50/50">
            <button
              type="button"
              onClick={() => setTab('otp')}
              className={`flex-1 py-3 text-xs font-bold transition-colors ${
                tab === 'otp'
                  ? 'bg-white text-cyber-700 border-b-2 border-cyber-600 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Instant OTP Login
            </button>
            <button
              type="button"
              onClick={() => setTab('password')}
              className={`flex-1 py-3 text-xs font-bold transition-colors ${
                tab === 'password'
                  ? 'bg-white text-cyber-700 border-b-2 border-cyber-600 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Password Login
            </button>
          </div>

          <CardContent className="p-6 sm:p-8">
            {tab === 'otp' ? (
              <form onSubmit={handleOtpSubmit} className="space-y-4 text-left">
                <div>
                  <Input
                    label="Registered Mobile Number"
                    placeholder="10-digit mobile number"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    leftIcon={<Phone className="w-4 h-4" />}
                    disabled={otpSent}
                  />
                  {!otpSent && (
                    <div className="mt-3">
                      <Button
                        type="button"
                        variant="primary"
                        onClick={handleSendOtp}
                        className="w-full"
                        rightIcon={<ArrowRight className="w-4 h-4" />}
                      >
                        Send Verification OTP
                      </Button>
                    </div>
                  )}
                </div>

                {otpSent && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-4 pt-2"
                  >
                    <div className="p-3 rounded-xl bg-cyber-50 border border-cyber-200 text-xs text-cyber-800 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-cyber-600" /> Demo Code: <strong>261840</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => setOtp('261840')}
                        className="text-[11px] font-bold text-cyber-600 underline"
                      >
                        Auto-Fill
                      </button>
                    </div>

                    <Input
                      label="Enter 6-Digit OTP"
                      placeholder="e.g. 261840"
                      value={otp}
                      maxLength={6}
                      onChange={(e) => setOtp(e.target.value)}
                      leftIcon={<KeyRound className="w-4 h-4" />}
                      className="text-center font-mono tracking-widest text-base font-bold"
                    />

                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Resend code in: {timer > 0 ? `${timer}s` : 'Available'}</span>
                      {timer === 0 && (
                        <button
                          type="button"
                          onClick={handleSendOtp}
                          className="font-bold text-cyber-600 hover:underline"
                        >
                          Resend OTP
                        </button>
                      )}
                    </div>

                    <Button
                      type="submit"
                      variant="primary"
                      isLoading={isLoading}
                      className="w-full"
                      rightIcon={<ArrowRight className="w-4 h-4" />}
                    >
                      Verify & Sign In
                    </Button>
                  </motion.div>
                )}
              </form>
            ) : (
              <form onSubmit={handlePasswordSubmit} className="space-y-4 text-left">
                <Input
                  label="Email or Mobile Number"
                  placeholder="name@example.com or 10-digit number"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  leftIcon={<Mail className="w-4 h-4" />}
                />

                <Input
                  label="Password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  leftIcon={<Lock className="w-4 h-4" />}
                />

                <div className="flex items-center justify-between text-xs">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-600">
                    <input type="checkbox" defaultChecked className="rounded border-slate-300 text-cyber-600" />
                    <span>Remember on this device</span>
                  </label>
                  <a href="#forgot" onClick={(e) => { e.preventDefault(); showToast('info', 'Demo Assistance', 'Use the instant OTP login or default demo credentials.'); }} className="text-cyber-600 font-semibold hover:underline">
                    Forgot?
                  </a>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isLoading}
                  className="w-full"
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Sign In to Portal
                </Button>
              </form>
            )}

            <div className="mt-6 pt-6 border-t border-slate-100 text-center text-xs text-slate-500">
              <span>New citizen to Pravah Setu? </span>
              <Link to="/register" className="font-bold text-cyber-600 hover:underline">
                Create an Account
              </Link>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};
