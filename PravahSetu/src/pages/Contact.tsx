import React, { useState } from 'react';
import { PhoneCall, Mail, MapPin, Send, AlertCircle, CheckCircle2, MessageSquare } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
import { Card, CardContent } from '../components/ui/Card';
import { useToast } from '../context/ToastContext';

export const Contact: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const { showToast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !message) {
      showToast('error', 'Error', 'Please fill all required inquiry fields.');
      return;
    }
    setSubmitted(true);
    showToast('success', 'Message Sent', 'Thank you for contacting the Pravah Setu helpdesk.');
  };

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50 py-12 sm:py-16 text-left">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 w-full space-y-10">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-navy-900 tracking-tight">
            Contact & Citizen Support
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            For emergencies dial 1930 immediately. For general portal inquiries, feedback, or grievance escalation, reach out below.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          {/* Contact Details & Helplines */}
          <div className="md:col-span-5 space-y-5">
            {/* National 1930 Helpline Card */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-navy-950 to-navy-900 text-white shadow-lg border border-navy-800 space-y-3">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[11px] font-bold border border-amber-500/30">
                Official National Helpline
              </span>
              <h3 className="text-xl font-bold">Financial Cyber Fraud</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                If you have lost money to unauthorized UPI, netbanking, or card transactions within the last 24 hours, dial immediately.
              </p>
              <div className="p-3 bg-navy-900/90 rounded-xl border border-cyber-500/40 flex items-center gap-3">
                <PhoneCall className="w-6 h-6 text-cyber-400" />
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                    Toll-Free 24×7
                  </span>
                  <span className="text-2xl font-black text-white">1930</span>
                </div>
              </div>
            </div>

            {/* General Helpdesk */}
            <Card className="border-slate-200 shadow-subtle p-5 space-y-4 text-xs">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-cyber-50 text-cyber-600 flex items-center justify-center shrink-0">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">Helpdesk Email:</span>
                  <span className="font-bold text-slate-800 text-sm">support@pravahsetu.gov.in</span>
                  <span className="text-slate-400 block text-[10px]">(Demo Prototype Desk)</span>
                </div>
              </div>

              <div className="flex items-start gap-3 pt-2 border-t border-slate-100">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">Jurisdiction Headquarters:</span>
                  <span className="font-bold text-slate-800 text-sm">National Cyber Coordination Centre</span>
                  <span className="text-slate-500 block text-[11px]">New Delhi, India</span>
                </div>
              </div>
            </Card>
          </div>

          {/* Contact Inquiry Form */}
          <div className="md:col-span-7">
            <Card className="border-slate-200 shadow-card">
              <CardContent className="p-6 sm:p-8">
                {submitted ? (
                  <div className="text-center py-10 space-y-3">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">Message Received</h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      Thank you for submitting your feedback. A support ticket has been created and our team will respond shortly.
                    </p>
                    <Button variant="outline" size="sm" onClick={() => setSubmitted(false)}>
                      Send Another Inquiry
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <h3 className="text-lg font-bold text-slate-900 tracking-tight mb-2">
                      Send Support Inquiry
                    </h3>

                    <Input
                      label="Your Name"
                      requiredIndicator
                      placeholder="e.g. Aarav Sharma"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />

                    <Input
                      label="Your Email"
                      type="email"
                      requiredIndicator
                      placeholder="citizen@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />

                    <Input
                      label="Subject"
                      placeholder="e.g. Portal query / Feedback / Complaint ID followup"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                    />

                    <Textarea
                      label="Inquiry Message"
                      requiredIndicator
                      rows={4}
                      placeholder="Please describe your query or feedback..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                    />

                    <Button
                      type="submit"
                      variant="primary"
                      className="w-full"
                      rightIcon={<Send className="w-4 h-4" />}
                    >
                      Transmit Inquiry
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};
