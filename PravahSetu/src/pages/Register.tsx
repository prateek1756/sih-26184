import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, ArrowRight, UserPlus, CheckCircle2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Card, CardContent } from '../components/ui/Card';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { INDIAN_STATES } from '../data/constants';

export const Register: React.FC = () => {
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [state, setState] = useState('Maharashtra');
  const [district, setDistrict] = useState('Pune');
  const [password, setPassword] = useState('');

  const { register: registerAuth, isLoading } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !mobile || !email) {
      showToast('error', 'Incomplete Details', 'Please fill all required registration fields.');
      return;
    }
    try {
      await registerAuth({
        fullName,
        mobile,
        email,
        state,
        district,
      });
      showToast('success', 'Account Created', `Welcome to Pravah Setu, ${fullName}!`);
      navigate('/dashboard');
    } catch {
      showToast('error', 'Registration Error', 'Unable to create account. Please try again.');
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
          <h1 className="text-2xl font-extrabold text-navy-900 tracking-tight">Citizen Registration</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Register your verified profile for rapid FIR tracking & safety advisories
          </p>
        </div>

        <Card className="border-slate-200 shadow-card">
          <CardContent className="p-6 sm:p-8">
            <form onSubmit={handleRegisterSubmit} className="space-y-4 text-left">
              <Input
                label="Full Name"
                requiredIndicator
                placeholder="e.g. Aarav Sharma"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />

              <Input
                label="Active Mobile Number"
                requiredIndicator
                placeholder="10-digit mobile number"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
              />

              <Input
                label="Email Address"
                type="email"
                requiredIndicator
                placeholder="citizen@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <div className="grid grid-cols-2 gap-3">
                <Select
                  label="State / UT"
                  options={INDIAN_STATES}
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                />
                <Input
                  label="District / City"
                  placeholder="e.g. Pune"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                />
              </div>

              <Input
                label="Create Password"
                type="password"
                requiredIndicator
                placeholder="Minimum 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isLoading}
                  className="w-full"
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Create Citizen Account
                </Button>
              </div>
            </form>

            <div className="mt-6 pt-6 border-t border-slate-100 text-center text-xs text-slate-500">
              <span>Already have an account? </span>
              <Link to="/login" className="font-bold text-cyber-600 hover:underline">
                Sign In
              </Link>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};
