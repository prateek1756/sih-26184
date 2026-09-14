import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldAlert,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  AlertCircle,
  CreditCard,
  Building2,
  Lock,
  FileCheck,
  Edit3,
  Bot,
  HelpCircle,
  Info,
} from 'lucide-react';
import { Stepper } from '../components/ui/ProgressBar';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Textarea } from '../components/ui/Textarea';
import { FileUploader } from '../components/ui/FileUploader';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../context/ToastContext';
import { ComplaintService } from '../services/complaintService';
import { AiAssistService } from '../services/aiAssistService';
import { CRIME_CATEGORIES, INDIAN_STATES } from '../data/constants';
import { CrimeCategory, EvidenceFile } from '../types';

// Zod Schema for Multi-step validation
const complaintSchema = z.object({
  // Step 1
  fullName: z.string().min(3, 'Full name must be at least 3 characters'),
  mobile: z
    .string()
    .regex(/^[6-9]\d{9}$/, 'Please enter a valid 10-digit Indian mobile number starting with 6-9'),
  email: z.string().email('Please enter a valid email address'),
  state: z.string().min(1, 'Please select your state/UT'),
  district: z.string().min(2, 'Please enter your district/city'),
  preferredLanguage: z.string().min(1, 'Please select your preferred language'),

  // Step 2
  category: z.string().min(1, 'Please select a crime category'),
  incidentDate: z.string().min(1, 'Please enter the incident date'),
  incidentTime: z.string().optional(),
  incidentDescription: z
    .string()
    .min(20, 'Please describe the incident in at least 20 characters for legal clarity'),
  suspectInfo: z.string().optional(),
  suspectContact: z.string().optional(),
  suspectUrl: z.string().optional(),

  // Step 3
  lostMoney: z.boolean(),
  amountLost: z.string().optional(),
  transactionType: z.string().optional(),
  transactionId: z.string().optional(),
  bankOrWallet: z.string().optional(),
  upiId: z.string().optional(),

  // Step 5 Declaration
  declarationConfirmed: z
    .boolean()
    .refine((val) => val === true, 'You must confirm the truthfulness of the complaint'),
});

type FormData = z.infer<typeof complaintSchema>;

const STEPS = [
  { id: 1, label: 'Citizen Details' },
  { id: 2, label: 'Incident Details' },
  { id: 3, label: 'Financial Loss' },
  { id: 4, label: 'Evidence Files' },
  { id: 5, label: 'Review & Submit' },
];

export const ReportComplaint: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [evidenceFiles, setEvidenceFiles] = useState<EvidenceFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiNotes, setAiNotes] = useState('');
  const [aiGeneratedText, setAiGeneratedText] = useState('');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  const { showToast } = useToast();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(complaintSchema),
    defaultValues: {
      fullName: '',
      mobile: '',
      email: '',
      state: 'Maharashtra',
      district: 'Pune',
      preferredLanguage: 'English',
      category: 'UPI_PAYMENT_FRAUD',
      incidentDate: new Date().toISOString().split('T')[0],
      incidentTime: '12:00',
      incidentDescription: '',
      suspectInfo: '',
      suspectContact: '',
      suspectUrl: '',
      lostMoney: false,
      amountLost: '',
      transactionType: 'UPI',
      transactionId: '',
      bankOrWallet: '',
      upiId: '',
      declarationConfirmed: false,
    },
    mode: 'onTouched',
  });

  const lostMoneyWatched = watch('lostMoney');
  const categoryWatched = watch('category');
  const descriptionWatched = watch('incidentDescription');
  const suspectContactWatched = watch('suspectContact');
  const suspectUrlWatched = watch('suspectUrl');
  const amountLostWatched = watch('amountLost');

  // Step validation triggers before advancing
  const nextStep = async () => {
    let fieldsToValidate: (keyof FormData)[] = [];

    if (currentStep === 1) {
      fieldsToValidate = ['fullName', 'mobile', 'email', 'state', 'district', 'preferredLanguage'];
    } else if (currentStep === 2) {
      fieldsToValidate = ['category', 'incidentDate', 'incidentDescription'];
    } else if (currentStep === 3) {
      if (lostMoneyWatched) {
        fieldsToValidate = ['amountLost'];
      }
    }

    const isValid = await trigger(fieldsToValidate);
    if (isValid) {
      setCurrentStep((prev) => Math.min(prev + 1, STEPS.length));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      showToast('error', 'Validation Error', 'Please complete the required fields in this step.');
    }
  };

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // AI Assistance Helper
  const handleOpenAiHelper = () => {
    setAiNotes(descriptionWatched || '');
    setAiGeneratedText('');
    setAiModalOpen(true);
  };

  const handleGenerateAiDraft = () => {
    setIsGeneratingAi(true);
    setTimeout(() => {
      const selectedCategoryObj = CRIME_CATEGORIES.find((c) => c.value === categoryWatched);
      const draft = AiAssistService.generateIncidentDraft({
        categoryLabel: selectedCategoryObj?.label,
        roughNotes: aiNotes,
        suspectContact: suspectContactWatched,
        suspectUrl: suspectUrlWatched,
        amountLost: amountLostWatched ? Number(amountLostWatched) : undefined,
      });
      setAiGeneratedText(draft);
      setIsGeneratingAi(false);
    }, 700);
  };

  const handleAcceptAiDraft = () => {
    setValue('incidentDescription', aiGeneratedText, { shouldValidate: true });
    setAiModalOpen(false);
    showToast('success', 'Incident Description Updated', 'AI-assisted statement inserted. You may review and edit further.');
  };

  // Final Form Submission
  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);

    try {
      const newComplaint = await ComplaintService.createComplaint({
        citizenName: data.fullName,
        citizenMobile: data.mobile,
        citizenEmail: data.email,
        state: data.state,
        district: data.district,
        preferredLanguage: data.preferredLanguage,
        category: data.category as CrimeCategory,
        incidentDate: data.incidentDate,
        incidentTime: data.incidentTime,
        incidentDescription: data.incidentDescription,
        suspectInfo: data.suspectInfo,
        suspectContact: data.suspectContact,
        suspectUrl: data.suspectUrl,
        lostMoney: data.lostMoney,
        financialDetails: data.lostMoney
          ? {
              amountLost: data.amountLost ? parseFloat(data.amountLost) : 0,
              transactionType: data.transactionType,
              transactionId: data.transactionId,
              bankOrWallet: data.bankOrWallet,
              upiId: data.upiId,
            }
          : undefined,
        evidence: evidenceFiles,
      });

      showToast('success', 'Complaint Registered', `Complaint reference ${newComplaint.id} recorded in national database.`);
      navigate('/complaint-success', { state: { complaint: newComplaint } });
    } catch (err: any) {
      const errorMsg = err?.message || 'An unexpected error occurred while saving your complaint.';
      showToast('error', 'Submission Failed', errorMsg);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50 py-8 sm:py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 w-full">
        {/* Header Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyber-50 text-cyber-700 border border-cyber-200 text-xs font-bold uppercase tracking-wider mb-2">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Official Grievance Registration</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-navy-900 tracking-tight">
            File a Cybercrime Complaint
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-slate-500 max-w-xl mx-auto leading-relaxed">
            Please provide accurate incident details and evidence to facilitate rapid investigation by the respective Cyber Crime Unit.
          </p>
        </div>

        {/* Stepper Progress */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-subtle mb-8">
          <Stepper
            steps={STEPS}
            currentStep={currentStep}
            onStepClick={(step) => {
              if (step < currentStep) setCurrentStep(step);
            }}
          />
        </div>

        {/* Wizard Form */}
        <form onSubmit={handleSubmit(onSubmit)}>
          <Card className="shadow-card border-slate-200 overflow-hidden">
            <CardContent className="p-6 sm:p-10">
              <AnimatePresence mode="wait">
                {/* STEP 1: CITIZEN PERSONAL DETAILS */}
                {currentStep === 1 && (
                  <motion.div
                    key="step-1"
                    initial={{ opacity: 0, x: 15 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -15 }}
                    className="space-y-6 text-left"
                  >
                    <div className="border-b border-slate-100 pb-4">
                      <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                        Step 1: Complainant / Citizen Information
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Your identity is confidential and protected under Indian privacy laws.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <Input
                        label="Full Name of Complainant"
                        requiredIndicator
                        placeholder="e.g. Aarav Sharma"
                        error={errors.fullName?.message}
                        {...register('fullName')}
                      />

                      <Input
                        label="Mobile Number (Active)"
                        requiredIndicator
                        placeholder="10-digit mobile number"
                        helperText="Used for official SMS tracking updates & OTP verification"
                        error={errors.mobile?.message}
                        {...register('mobile')}
                      />

                      <Input
                        label="Email Address"
                        type="email"
                        requiredIndicator
                        placeholder="citizen@example.com"
                        helperText="Investigation status & FIR receipt will be emailed here"
                        error={errors.email?.message}
                        {...register('email')}
                      />

                      <Select
                        label="State / Union Territory"
                        requiredIndicator
                        options={INDIAN_STATES}
                        error={errors.state?.message}
                        {...register('state')}
                      />

                      <Input
                        label="District / City"
                        requiredIndicator
                        placeholder="e.g. Pune / New Delhi"
                        error={errors.district?.message}
                        {...register('district')}
                      />

                      <Select
                        label="Preferred Language"
                        requiredIndicator
                        options={['English', 'Hindi', 'Marathi', 'Tamil', 'Telugu', 'Bengali', 'Gujarati']}
                        error={errors.preferredLanguage?.message}
                        {...register('preferredLanguage')}
                      />
                    </div>
                  </motion.div>
                )}

                {/* STEP 2: INCIDENT DETAILS */}
                {currentStep === 2 && (
                  <motion.div
                    key="step-2"
                    initial={{ opacity: 0, x: 15 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -15 }}
                    className="space-y-6 text-left"
                  >
                    <div className="border-b border-slate-100 pb-4">
                      <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                        Step 2: Cyber Incident Details
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Select the closest crime category and describe the sequence of events.
                      </p>
                    </div>

                    {/* Category Selection Grid */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-800 mb-2">
                        Crime Category <span className="text-rose-500">*</span>
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {CRIME_CATEGORIES.map((cat) => {
                          const isSelected = categoryWatched === cat.value;
                          return (
                            <div
                              key={cat.value}
                              onClick={() => setValue('category', cat.value, { shouldValidate: true })}
                              className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all duration-150 ${
                                isSelected
                                  ? 'border-cyber-600 bg-cyber-50/50 shadow-sm ring-2 ring-cyber-100'
                                  : 'border-slate-200 hover:border-slate-300 bg-white'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-bold text-slate-900">{cat.label}</span>
                                {isSelected && (
                                  <span className="w-2 h-2 rounded-full bg-cyber-600" />
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 leading-tight">
                                {cat.shortDesc}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                      {errors.category?.message && (
                        <p className="mt-1.5 text-xs text-rose-600 font-medium">
                          {errors.category.message}
                        </p>
                      )}
                    </div>

                    {/* Date & Time */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <Input
                        label="Date of Incident / Deception"
                        type="date"
                        requiredIndicator
                        error={errors.incidentDate?.message}
                        {...register('incidentDate')}
                      />

                      <Input
                        label="Approximate Time"
                        type="time"
                        error={errors.incidentTime?.message}
                        {...register('incidentTime')}
                      />
                    </div>

                    {/* Incident Narrative with AI Assistant */}
                    <div className="space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <label className="text-sm font-semibold text-slate-800">
                          Incident Description <span className="text-rose-500">*</span>
                        </label>

                        {/* AI Assistance Trigger Button */}
                        <button
                          type="button"
                          onClick={handleOpenAiHelper}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyber-600 to-indigo-600 text-white text-xs font-bold shadow-2xs hover:opacity-90 transition"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Need Help Describing? (AI Assist)</span>
                        </button>
                      </div>

                      <Textarea
                        rows={5}
                        placeholder="Chronologically detail how you were contacted, what deceptive claims were made, what links/apps you were told to access, and any monetary transfer details..."
                        maxLength={2500}
                        error={errors.incidentDescription?.message}
                        {...register('incidentDescription')}
                      />
                    </div>

                    {/* Suspect Information */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 pt-2 border-t border-slate-100">
                      <Input
                        label="Suspect Phone / WhatsApp"
                        placeholder="+91 9XXXX XXXXX"
                        helperText="If known or from call logs"
                        {...register('suspectContact')}
                      />

                      <Input
                        label="Suspicious Link / Website URL"
                        placeholder="https://fake-mseb-portal.in"
                        helperText="Malicious link received"
                        {...register('suspectUrl')}
                      />

                      <Input
                        label="Suspect Name / Social Handle"
                        placeholder="e.g. @TelegramTrader_VIP"
                        helperText="Profile or handle details"
                        {...register('suspectInfo')}
                      />
                    </div>
                  </motion.div>
                )}

                {/* STEP 3: FINANCIAL DETAILS */}
                {currentStep === 3 && (
                  <motion.div
                    key="step-3"
                    initial={{ opacity: 0, x: 15 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -15 }}
                    className="space-y-6 text-left"
                  >
                    <div className="border-b border-slate-100 pb-4">
                      <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                        Step 3: Financial Loss & Transaction Details
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        If money was fraudulently debited, providing accurate transaction IDs enables immediate bank freeze notices.
                      </p>
                    </div>

                    {/* Question: Did you lose money? */}
                    <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200">
                      <label className="block text-sm font-bold text-slate-900 mb-3">
                        Did you suffer a monetary / financial loss in this incident?
                      </label>
                      <div className="flex items-center gap-4">
                        <button
                          type="button"
                          onClick={() => setValue('lostMoney', true)}
                          className={`flex-1 py-3 px-4 rounded-xl border-2 font-bold text-sm transition-all ${
                            lostMoneyWatched
                              ? 'border-cyber-600 bg-cyber-50 text-cyber-700 shadow-sm'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          Yes, I lost money
                        </button>

                        <button
                          type="button"
                          onClick={() => setValue('lostMoney', false)}
                          className={`flex-1 py-3 px-4 rounded-xl border-2 font-bold text-sm transition-all ${
                            !lostMoneyWatched
                              ? 'border-cyber-600 bg-cyber-50 text-cyber-700 shadow-sm'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          No financial loss (Data / Phishing only)
                        </button>
                      </div>
                    </div>

                    {lostMoneyWatched && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="space-y-5 pt-2"
                      >
                        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-amber-800 text-xs">
                          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                          <span>
                            <strong>Golden Hour Protocol:</strong> Detailed bank transaction IDs and UPI VPAs are immediately synchronized with the Indian Cyber Crime Coordination Centre (I4C) for destination freeze.
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                          <Input
                            label="Total Amount Lost (in ₹ INR)"
                            type="number"
                            requiredIndicator
                            placeholder="e.g. 45000"
                            error={errors.amountLost?.message}
                            {...register('amountLost')}
                          />

                          <Select
                            label="Transaction Mode"
                            options={['UPI', 'IMPS', 'NEFT/RTGS', 'Debit/Credit Card', 'Net Banking', 'Crypto / Wallet']}
                            {...register('transactionType')}
                          />

                          <Input
                            label="Bank Transaction ID / UTR / Reference No."
                            placeholder="e.g. 324109823190"
                            helperText="12-digit UPI reference number or bank UTR"
                            {...register('transactionId')}
                          />

                          <Input
                            label="Your Bank / Wallet Name"
                            placeholder="e.g. State Bank of India, HDFC"
                            {...register('bankOrWallet')}
                          />

                          <Input
                            label="Beneficiary / Suspect UPI ID (if known)"
                            placeholder="fraudster@oksbi or phone@paytm"
                            {...register('upiId')}
                          />
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                )}

                {/* STEP 4: EVIDENCE FILES */}
                {currentStep === 4 && (
                  <motion.div
                    key="step-4"
                    initial={{ opacity: 0, x: 15 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -15 }}
                    className="space-y-6 text-left"
                  >
                    <div className="border-b border-slate-100 pb-4">
                      <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                        Step 4: Upload Evidence & Supporting Proofs
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Attach bank debit SMS screenshots, account statements, fake website URLs, or WhatsApp/Telegram chat exports.
                      </p>
                    </div>

                    <FileUploader
                      files={evidenceFiles}
                      onFilesChange={setEvidenceFiles}
                      maxFiles={6}
                    />
                  </motion.div>
                )}

                {/* STEP 5: REVIEW & SUBMIT */}
                {currentStep === 5 && (
                  <motion.div
                    key="step-5"
                    initial={{ opacity: 0, x: 15 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -15 }}
                    className="space-y-6 text-left"
                  >
                    <div className="border-b border-slate-100 pb-4">
                      <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                        Step 5: Review Complaint Dossier
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Please review your submission carefully before transmitting to the cyber crime cell.
                      </p>
                    </div>

                    {/* Summary Section 1 */}
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                          1. Complainant Information
                        </h4>
                        <button
                          type="button"
                          onClick={() => setCurrentStep(1)}
                          className="text-xs font-bold text-cyber-600 hover:text-cyber-700 flex items-center gap-1"
                        >
                          <Edit3 className="w-3.5 h-3.5" /> Edit
                        </button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div>
                          <span className="text-slate-400 block">Name:</span>
                          <span className="font-semibold text-slate-800">{watch('fullName')}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Mobile:</span>
                          <span className="font-semibold text-slate-800">{watch('mobile')}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Email:</span>
                          <span className="font-semibold text-slate-800 truncate block">
                            {watch('email')}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Location:</span>
                          <span className="font-semibold text-slate-800">
                            {watch('district')}, {watch('state')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Summary Section 2 */}
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                          2. Incident Narrative
                        </h4>
                        <button
                          type="button"
                          onClick={() => setCurrentStep(2)}
                          className="text-xs font-bold text-cyber-600 hover:text-cyber-700 flex items-center gap-1"
                        >
                          <Edit3 className="w-3.5 h-3.5" /> Edit
                        </button>
                      </div>
                      <p className="text-xs font-bold text-cyber-700">
                        Category: {CRIME_CATEGORIES.find((c) => c.value === watch('category'))?.label}
                      </p>
                      <p className="text-xs text-slate-700 leading-relaxed bg-white p-3 rounded-lg border border-slate-200">
                        {watch('incidentDescription')}
                      </p>
                      {(watch('suspectContact') || watch('suspectUrl')) && (
                        <div className="text-xs text-slate-600 pt-1">
                          {watch('suspectContact') && (
                            <span className="mr-3">
                              <strong>Suspect Phone:</strong> {watch('suspectContact')}
                            </span>
                          )}
                          {watch('suspectUrl') && (
                            <span>
                              <strong>Suspect Link:</strong> {watch('suspectUrl')}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Summary Section 3 */}
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                          3. Financial & Evidence Summary
                        </h4>
                        <button
                          type="button"
                          onClick={() => setCurrentStep(3)}
                          className="text-xs font-bold text-cyber-600 hover:text-cyber-700 flex items-center gap-1"
                        >
                          <Edit3 className="w-3.5 h-3.5" /> Edit
                        </button>
                      </div>
                      <div className="text-xs text-slate-700">
                        {lostMoneyWatched ? (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            <div>
                              <span className="text-slate-400 block">Amount Lost:</span>
                              <span className="font-extrabold text-rose-600 text-sm">
                                ₹{Number(watch('amountLost') || 0).toLocaleString('en-IN')}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400 block">Mode / Bank:</span>
                              <span className="font-semibold text-slate-800">
                                {watch('transactionType')} • {watch('bankOrWallet') || 'N/A'}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400 block">Transaction ID:</span>
                              <span className="font-semibold text-slate-800">
                                {watch('transactionId') || 'Pending'}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <p className="text-slate-500 italic">No financial loss reported.</p>
                        )}
                        <div className="mt-2 text-slate-600">
                          <strong>Attached Evidence Files:</strong> {evidenceFiles.length} file(s) attached
                        </div>
                      </div>
                    </div>

                    {/* Legal Confirmation Checkbox */}
                    <div className="p-4 rounded-xl bg-cyber-50/60 border border-cyber-200">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-slate-300 text-cyber-600 focus:ring-cyber-500 mt-0.5 shrink-0"
                          {...register('declarationConfirmed')}
                        />
                        <span className="text-xs text-slate-700 leading-relaxed">
                          I confirm that the information provided is true and accurate to the best of my
                          knowledge. I understand that filing a knowingly false complaint is a punishable
                          offense under the Indian Penal Code and Information Technology Act.
                        </span>
                      </label>
                      {errors.declarationConfirmed?.message && (
                        <p className="text-xs text-rose-600 font-medium mt-1.5 pl-7">
                          {errors.declarationConfirmed.message}
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Wizard Nav Controls */}
              <div className="flex items-center justify-between pt-8 mt-8 border-t border-slate-200">
                {currentStep > 1 ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={prevStep}
                    leftIcon={<ArrowLeft className="w-4 h-4" />}
                  >
                    Previous Step
                  </Button>
                ) : (
                  <div />
                )}

                {currentStep < STEPS.length ? (
                  <Button
                    type="button"
                    variant="primary"
                    onClick={nextStep}
                    rightIcon={<ArrowRight className="w-4 h-4" />}
                  >
                    Continue to Step {currentStep + 1}
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    variant="primary"
                    isLoading={isSubmitting}
                    rightIcon={<CheckCircle2 className="w-5 h-5" />}
                    className="px-8 py-3 text-base shadow-lg shadow-cyber-600/30"
                  >
                    Submit Complaint
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </form>

        {/* AI Assistance Modal (Citizen Review & Approval Required) */}
        <Modal
          isOpen={aiModalOpen}
          onClose={() => setAiModalOpen(false)}
          title="AI Incident Statement Helper"
          description="Transform your bullet points into a formal cyber incident statement. You must review and approve before insertion."
          maxWidth="lg"
        >
          <div className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Tell us briefly what happened:
              </label>
              <textarea
                value={aiNotes}
                onChange={(e) => setAiNotes(e.target.value)}
                rows={3}
                placeholder="e.g. got call from courier company, said parcel held, asked for ₹10 paytm, then money cut..."
                className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyber-500"
              />
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              isLoading={isGeneratingAi}
              onClick={handleGenerateAiDraft}
              leftIcon={<Sparkles className="w-4 h-4 text-cyber-600" />}
              className="w-full"
            >
              Generate Formal Statement
            </Button>

            {aiGeneratedText && (
              <div className="space-y-3 pt-2">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-cyber-700">
                      Generated Formal Statement:
                    </span>
                    <span className="text-[11px] text-slate-400">Review & Edit</span>
                  </div>
                  <textarea
                    value={aiGeneratedText}
                    onChange={(e) => setAiGeneratedText(e.target.value)}
                    rows={6}
                    className="w-full bg-white border border-slate-200 rounded-lg p-3 text-xs text-slate-800 leading-relaxed focus:outline-none focus:ring-2 focus:ring-cyber-500"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setAiModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={handleAcceptAiDraft}
                    leftIcon={<CheckCircle2 className="w-4 h-4" />}
                  >
                    Approve & Insert into Complaint
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      </div>
    </div>
  );
};
