import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ShieldCheck, 
  Award, 
  FileText, 
  CheckCircle2, 
  Lock, 
  ArrowRight, 
  AlertCircle, 
  CheckCircle,
  ExternalLink,
  Phone,
  Mail,
  BookOpen,
  FileCheck2,
  Building2
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { authService } from '../services/authService';
import { isSupabaseConfigured } from '../lib/supabase';
import { ForgotPasswordForm } from '../components/auth/ForgotPasswordForm';
import { MetriqLogo } from '../components/common/MetriqLogo';
import { LanguageSwitcher } from '../components/common/LanguageSwitcher';

export const Login: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const [isForgotPasswordMode, setIsForgotPasswordMode] = useState(false);
  const [labId, setLabId] = useState('NML-DELHI-001');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Clear obsolete legacy mock keys on mount
  useEffect(() => {
    localStorage.removeItem('nawi_auth_state');
    localStorage.removeItem('nawi_demo_role');
    localStorage.removeItem('nawi_current_user');
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      if (isSignUpMode) {
        const result = await authService.signUp(email, password, fullName);
        if (result.session) {
          navigate('/dashboard', { replace: true });
        } else {
          setSuccessMessage('Registration submitted! If Supabase email verification is enabled, check your email inbox to confirm before signing in.');
        }
      } else {
        const result = await authService.signIn(email, password);

        if (!result || !result.user || !result.session) {
          throw new Error('Authentication failed');
        }

        navigate('/dashboard', { replace: true });
      }
    } catch (err: any) {
      const rawMsg = err.message || '';
      if (rawMsg.toLowerCase().includes('rate limit')) {
        setErrorMessage('Supabase Email Rate Limit Exceeded (default free SMTP limit). To bypass this: Go to Supabase Dashboard -> Authentication -> Providers -> Email -> Turn "Confirm Email" to OFF.');
      } else if (rawMsg.toLowerCase().includes('email not confirmed')) {
        setErrorMessage('Email not confirmed. Please check your email inbox to verify your account before logging in (or disable "Confirm Email" in your Supabase Dashboard -> Authentication -> Providers -> Email).');
      } else if (rawMsg.toLowerCase().includes('invalid login credentials')) {
        setErrorMessage('Invalid email or password. Please verify your credentials or use the Register / Sign Up tab to create an account.');
      } else {
        setErrorMessage(rawMsg || (isSignUpMode ? 'Registration failed.' : 'Invalid email or password.'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignOutExisting = async () => {
    await authService.signOut();
    setErrorMessage('Previous session cleared. Please enter credentials.');
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#F9F8F3] text-slate-900 font-sans selection:bg-[#D4AF37] selection:text-slate-950">
      
      {/* TOP INSTITUTIONAL BAR */}
      <header className="bg-[#0B1F3A] text-white border-b-2 border-[#C8A46B]/50 px-6 py-3 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          
          {/* Top-Left METRIQ Branding */}
          <MetriqLogo variant="full" size="lg" showSubtitle={true} showSIHBadge={true} isLight={true} />

          {/* Top-Right Institutional Subtitle & Language Switcher */}
          <div className="flex items-center gap-4">
            <LanguageSwitcher />

            <div className="text-right text-xs space-y-0.5 hidden md:block">
              <span className="text-slate-300 font-semibold block">
                National Legal Metrology Laboratory Portal
              </span>
              <span className="text-[11px] text-[#C8A46B] font-mono block">
                OIML R 76-2:2007 (E) Digital Test Report Format
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN CLEAN 2-COLUMN LAYOUT CONTAINER */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-10 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
        
        {/* LEFT COLUMN: BRANDING HERO & INSTITUTIONAL HIGHLIGHTS */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Main Hero Card */}
          <div className="space-y-4 bg-[#0B1F3A] text-white p-8 rounded-2xl border border-slate-700 shadow-xl relative overflow-hidden">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xs text-[10px] font-mono font-bold text-[#C8A46B] bg-[#C8A46B]/10 border border-[#C8A46B]/30">
              <ShieldCheck className="w-3.5 h-3.5 text-[#C8A46B]" />
              <span>LEGAL METROLOGY LABORATORY PLATFORM</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight font-sans leading-tight">
              Type Evaluation &amp; OIML R 76 Test Automation
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-sans max-w-2xl">
              Digital test execution, compliance recording, and report generation for Non-Automatic Weighing Instruments (NAWI) according to OIML Recommendation R 76.
            </p>

            {/* Key Platform Capability Highlights */}
            <div className="pt-4 border-t border-slate-700/80 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="flex items-center gap-2 text-slate-200">
                <CheckCircle2 className="w-4 h-4 text-[#C8A46B] shrink-0" />
                <span>OIML R 76-1:2006 Standardized Workflows</span>
              </div>
              <div className="flex items-center gap-2 text-slate-200">
                <CheckCircle2 className="w-4 h-4 text-[#C8A46B] shrink-0" />
                <span>Automated MPE Error Calculation Engine</span>
              </div>
              <div className="flex items-center gap-2 text-slate-200">
                <CheckCircle2 className="w-4 h-4 text-[#C8A46B] shrink-0" />
                <span>Multi-Role Sign-Off &amp; Review Workflow</span>
              </div>
              <div className="flex items-center gap-2 text-slate-200">
                <CheckCircle2 className="w-4 h-4 text-[#C8A46B] shrink-0" />
                <span>QR-Verifiable Digital Test Evaluation Reports</span>
              </div>
            </div>
          </div>

          {/* Quick Institutional Context Card */}
          <div className="p-4 bg-white rounded-xl border border-[#D9D3C7] shadow-sm flex items-start gap-3">
            <Building2 className="w-5 h-5 text-[#0B1F3A] shrink-0 mt-0.5" />
            <div className="text-xs space-y-0.5">
              <span className="font-bold text-[#0B1F3A] block">Smart India Hackathon SIH26035 Prototype</span>
              <p className="text-slate-600 leading-relaxed">
                Designed for Legal Metrology officers, technical reviewers, and laboratory directors to execute, audit, and approve weighing instrument type evaluations digitally.
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: INSTITUTIONAL LOGIN CARD */}
        <div className="lg:col-span-5 w-full">
          <div className="bg-[#08162A] text-white border-2 border-slate-700/80 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
            
            {isForgotPasswordMode ? (
              <ForgotPasswordForm
                initialEmail={email}
                onBackToLogin={() => setIsForgotPasswordMode(false)}
              />
            ) : (
              <>
                {/* Mode Switcher Tabs */}
                <div className="flex items-center gap-6 border-b border-slate-700 pb-3">
                  <button
                    type="button"
                    onClick={() => { setIsSignUpMode(false); setErrorMessage(null); setSuccessMessage(null); }}
                    className={`pb-2 text-xs font-extrabold uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
                      !isSignUpMode 
                        ? 'border-[#C8A46B] text-[#C8A46B]' 
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIsSignUpMode(true); setErrorMessage(null); setSuccessMessage(null); }}
                    className={`pb-2 text-xs font-extrabold uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
                      isSignUpMode 
                        ? 'border-[#C8A46B] text-[#C8A46B]' 
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Register / Sign Up
                  </button>
                </div>

                {/* Heading & Subtitle */}
                <div className="space-y-1">
                  <h2 className="text-xl font-extrabold text-white tracking-tight font-sans">
                    {isSignUpMode ? 'Register Laboratory Account' : t('login.title')}
                  </h2>
                  <p className="text-xs text-slate-300 leading-relaxed font-sans">
                    {isSignUpMode
                      ? 'Create a new laboratory officer profile to access NAWI type evaluations.'
                      : 'Enter your authorized laboratory credentials to access OIML R 76 test sessions and reports.'}
                  </p>
                </div>

                {/* Error Message */}
                {errorMessage && (
                  <div className="p-3.5 rounded-lg bg-rose-950/80 border border-rose-700/80 text-rose-200 text-xs flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                    <span className="leading-relaxed font-sans">{errorMessage}</span>
                  </div>
                )}

                {/* Success Message */}
                {successMessage && (
                  <div className="p-3.5 rounded-lg bg-emerald-950/80 border border-emerald-700/80 text-emerald-200 text-xs flex items-start gap-2.5">
                    <CheckCircle className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                    <span className="leading-relaxed font-sans">{successMessage}</span>
                  </div>
                )}

                {/* Login / Register Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  {isSignUpMode && (
                    <div>
                      <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-1 font-sans">
                        Officer Full Name *
                      </label>
                      <input
                        type="text"
                        required={isSignUpMode}
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Dr. Ananya Rao"
                        className="w-full px-3.5 py-2.5 text-xs bg-[#0B1F3A] border border-slate-600 rounded-md text-white placeholder-slate-500 focus:outline-none focus:border-[#C8A46B] focus:ring-1 focus:ring-[#C8A46B] font-sans"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-1 font-sans">
                      Laboratory / Organization ID
                    </label>
                    <input
                      type="text"
                      required
                      value={labId}
                      onChange={(e) => setLabId(e.target.value)}
                      placeholder="e.g. NML-DELHI-001"
                      className="w-full px-3.5 py-2.5 text-xs bg-[#0B1F3A] border border-slate-600 rounded-md text-white placeholder-slate-500 focus:outline-none focus:border-[#C8A46B] focus:ring-1 focus:ring-[#C8A46B] font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-1 font-sans">
                      {t('login.emailLabel')} *
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t('login.emailPlaceholder')}
                      className="w-full px-3.5 py-2.5 text-xs bg-[#0B1F3A] border border-slate-600 rounded-md text-white placeholder-slate-500 focus:outline-none focus:border-[#C8A46B] focus:ring-1 focus:ring-[#C8A46B] font-sans"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-1 font-sans">
                      {t('login.passwordLabel')} *
                    </label>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3.5 py-2.5 text-xs bg-[#0B1F3A] border border-slate-600 rounded-md text-white placeholder-slate-500 focus:outline-none focus:border-[#C8A46B] focus:ring-1 focus:ring-[#C8A46B] font-sans"
                    />
                  </div>

                  {!isSignUpMode && (
                    <div className="flex items-center justify-between text-xs pt-1">
                      <label className="flex items-center gap-2 cursor-pointer text-slate-300 select-none hover:text-white font-sans">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="rounded border-slate-600 bg-[#0B1F3A] text-[#C8A46B] focus:ring-0 cursor-pointer"
                        />
                        Remember station
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setIsForgotPasswordMode(true);
                          setErrorMessage(null);
                          setSuccessMessage(null);
                        }}
                        className="text-[#C8A46B] hover:underline font-semibold cursor-pointer font-sans"
                      >
                        {t('login.forgotPassword')}
                      </button>
                    </div>
                  )}

                  {/* Primary Action Button (Beige / Deep Navy Contrast) */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 px-4 bg-[#C8A46B] hover:bg-[#B79055] text-[#08162A] font-extrabold text-xs uppercase tracking-wider rounded-md transition-all flex items-center justify-center gap-2 shadow-md disabled:opacity-50 cursor-pointer font-sans mt-2"
                  >
                    {loading ? (
                      <span>{isSignUpMode ? 'Registering Officer...' : t('login.signingIn')}</span>
                    ) : (
                      <>
                        <span>{isSignUpMode ? 'Complete Registration & Sign Up' : t('login.signInBtn')}</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>

                {/* Real Supabase Authentication Status Notice */}
                {isSupabaseConfigured() && (
                  <div className="p-3 rounded-lg bg-[#0B1F3A] border border-slate-700/60 text-xs text-slate-300 space-y-1">
                    <div className="flex items-center justify-between font-bold text-[#C8A46B] font-sans">
                      <span className="flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5" /> Supabase Authentication Active
                      </span>
                      <button
                        type="button"
                        onClick={handleSignOutExisting}
                        className="text-[10px] text-rose-400 hover:underline cursor-pointer"
                      >
                        Clear Session
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-normal font-sans">
                      Enter your registered Supabase user email and password above to authenticate.
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Card Security Footer */}
            <p className="text-[11px] text-slate-400 text-center flex items-center justify-center gap-1.5 pt-1 font-sans">
              <Lock className="w-3.5 h-3.5 text-slate-500" />
              <span>Access restricted to authorized legal metrology personnel.</span>
            </p>

          </div>
        </div>

      </main>

      {/* INSTITUTIONAL FOOTER */}
      <footer className="bg-[#0B1F3A] text-white border-t-2 border-[#C8A46B]/50 font-sans mt-auto">
        
        {/* Main Footer Content Grid */}
        <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 md:grid-cols-12 gap-8 text-xs text-slate-300">
          
          {/* Column 1: System Info & Disclaimer */}
          <div className="md:col-span-4 space-y-3">
            <MetriqLogo variant="compact" size="sm" showSIHBadge={true} isLight={true} />
            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              OIML R 76 Test &amp; Compliance System • SIH26035
            </p>
            <p className="text-[11px] text-slate-400 leading-relaxed italic bg-[#08162A] p-3 rounded border border-slate-800">
              "METRIQ is an SIH26035 prototype for digital OIML R 76 test workflow and evaluation. OIML reference documents are linked to the official OIML website."
            </p>
          </div>

          {/* Column 2: Official OIML Reference Links */}
          <div className="md:col-span-5 space-y-3">
            <h4 className="text-xs font-extrabold text-[#C8A46B] uppercase tracking-wider font-sans flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-[#C8A46B]" />
              Official OIML References
            </h4>
            <div className="space-y-2 font-sans text-xs">
              <div className="p-2.5 bg-[#08162A] rounded border border-slate-800 flex items-start justify-between gap-2">
                <div>
                  <span className="font-bold text-white block">OIML R 76-1:2006</span>
                  <span className="text-[11px] text-slate-400 block">Metrological and technical requirements — Tests</span>
                </div>
                <a
                  href="https://www.oiml.org/en/files/pdf_r/r076-1-e06.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 bg-[#12355B] hover:bg-[#0B1F3A] text-[#C8A46B] text-[10px] font-bold rounded flex items-center gap-1 shrink-0 cursor-pointer"
                  title="Official OIML Reference PDF (External)"
                >
                  <span>PDF</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="p-2.5 bg-[#08162A] rounded border border-slate-800 flex items-start justify-between gap-2">
                <div>
                  <span className="font-bold text-white block">OIML R 76-2:2007</span>
                  <span className="text-[11px] text-slate-400 block">Test report format</span>
                </div>
                <a
                  href="https://www.oiml.org/en/files/pdf_r/r076-2-e07.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 bg-[#12355B] hover:bg-[#0B1F3A] text-[#C8A46B] text-[10px] font-bold rounded flex items-center gap-1 shrink-0 cursor-pointer"
                  title="Official OIML Reference PDF (External)"
                >
                  <span>PDF</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>

          {/* Column 3: Project Contact Block & Links */}
          <div className="md:col-span-3 space-y-3">
            <h4 className="text-xs font-extrabold text-[#C8A46B] uppercase tracking-wider font-sans">
              Project Contact
            </h4>
            <div className="space-y-2 text-xs font-sans text-slate-300">
              <a
                href="tel:+916382838376"
                className="flex items-center gap-2 p-2 bg-[#08162A] rounded border border-slate-800 hover:text-[#C8A46B] transition-colors"
              >
                <Phone className="w-3.5 h-3.5 text-[#C8A46B] shrink-0" />
                <span className="font-mono text-xs">+91 63828 38376</span>
              </a>

              <a
                href="mailto:sujansk2801@gmail.com"
                className="flex items-center gap-2 p-2 bg-[#08162A] rounded border border-slate-800 hover:text-[#C8A46B] transition-colors"
              >
                <Mail className="w-3.5 h-3.5 text-[#C8A46B] shrink-0" />
                <span className="font-mono text-xs truncate">sujansk2801@gmail.com</span>
              </a>
            </div>
          </div>

        </div>

        {/* Lower Navigation Strip */}
        <div className="border-t border-slate-800 px-6 py-3 text-[11px] font-sans text-slate-400">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-4 text-slate-300 font-medium">
              <a href="https://www.oiml.org/en/files/pdf_r/r076-1-e06.pdf" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">OIML R 76-1</a>
              <span>•</span>
              <a href="https://www.oiml.org/en/files/pdf_r/r076-2-e07.pdf" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">OIML R 76-2</a>
              <span>•</span>
              <a href="mailto:sujansk2801@gmail.com" className="hover:text-white transition-colors">Project Contact</a>
              <span>•</span>
              <span className="hover:text-white cursor-pointer">Laboratory Access</span>
            </div>

            <div className="font-mono text-[11px] text-slate-400">
              Smart India Hackathon • SIH26035
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
};
