import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '../components/common/Logo';
import { 
  ShieldCheck, 
  Award, 
  FileText, 
  CheckCircle2, 
  Lock, 
  ArrowRight, 
  AlertCircle, 
  CheckCircle 
} from 'lucide-react';
import { authService } from '../services/authService';
import { isSupabaseConfigured } from '../lib/supabase';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const [isSignUpMode, setIsSignUpMode] = useState(false);
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
    <div 
      className="min-h-screen flex flex-col justify-between bg-[#0A101D] text-slate-100 font-sans selection:bg-[#2BB673] selection:text-slate-950 relative overflow-x-hidden bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url('/lab-bg.jpg')` }}
    >
      {/* Dark Navy Glassmorphism Overlay */}
      <div className="absolute inset-0 bg-[#0A101D]/80 backdrop-blur-[2px] pointer-events-none" />

      {/* Main Container */}
      <div className="relative z-10 flex-1 flex flex-col lg:flex-row items-center justify-between p-6 sm:p-10 lg:p-14 max-w-7xl mx-auto w-full gap-8">
        
        {/* Left Side Branding & Hero Content */}
        <div className="w-full lg:w-7/12 flex flex-col justify-between space-y-8 py-2">
          
          {/* Top Branding Header */}
          <div>
            <Logo variant="dark" showSubtitle={true} showSIHBadge={true} />
          </div>

          {/* Hero Content Section */}
          <div className="space-y-6 max-w-2xl">
            {/* Compact Platform Pill */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-semibold tracking-wider text-[#2BB673] bg-[#0E281F]/80 border border-[#2BB673]/30 backdrop-blur-md">
              <ShieldCheck className="w-3.5 h-3.5 text-[#2BB673] shrink-0" />
              <span>LEGAL METROLOGY LABORATORY PLATFORM</span>
            </div>

            {/* Main Hero Heading */}
            <h1 className="text-4xl sm:text-5xl lg:text-[52px] font-extrabold text-white tracking-tight leading-[1.12]">
              Type evaluation & OIML R 76 <br />
              test automation.
            </h1>

            {/* Hero Description */}
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-xl font-normal">
              Digital type-evaluation and compliance reporting for Non-Automatic Weighing Instruments (NAWI) according to OIML Recommendation R 76.
            </p>

            {/* Three Stacked Glass Feature Cards */}
            <div className="space-y-3.5 pt-1 max-w-xl">
              
              {/* Feature Card 1 */}
              <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-[#111A2E]/75 border border-slate-800/80 backdrop-blur-md hover:border-[#2BB673]/30 transition-all shadow-md">
                <div className="p-2.5 rounded-xl bg-[#2BB673]/10 text-[#2BB673] shrink-0 border border-[#2BB673]/20 mt-0.5">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">Standardized Test Workflows</h3>
                  <p className="text-xs text-slate-400 mt-1 leading-normal">
                    Rules-based OIML R 76 test workflows covering weighing performance, repeatability, eccentricity, zero-setting & tare.
                  </p>
                </div>
              </div>

              {/* Feature Card 2 */}
              <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-[#111A2E]/75 border border-slate-800/80 backdrop-blur-md hover:border-[#2BB673]/30 transition-all shadow-md">
                <div className="p-2.5 rounded-xl bg-[#2BB673]/10 text-[#2BB673] shrink-0 border border-[#2BB673]/20 mt-0.5">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">Compliance-Ready Records</h3>
                  <p className="text-xs text-slate-400 mt-1 leading-normal">
                    Automated MPE tolerance verification, Supabase database persistence & audit trails.
                  </p>
                </div>
              </div>

              {/* Feature Card 3 */}
              <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-[#111A2E]/75 border border-slate-800/80 backdrop-blur-md hover:border-[#2BB673]/30 transition-all shadow-md">
                <div className="p-2.5 rounded-xl bg-[#2BB673]/10 text-[#2BB673] shrink-0 border border-[#2BB673]/20 mt-0.5">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">Traceable Digital Reports</h3>
                  <p className="text-xs text-slate-400 mt-1 leading-normal">
                    Instant generation of OIML R 76 Test Evaluation Reports with digital officer sign-offs.
                  </p>
                </div>
              </div>

            </div>
          </div>

        </div>

        {/* Right Side Login Panel */}
        <div className="w-full lg:w-5/12 flex items-center justify-center">
          <div className="w-full max-w-md bg-[#131C31]/95 border border-slate-700/50 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl space-y-6">
            
            {/* Mode Switcher Tabs */}
            <div className="flex items-center gap-6 border-b border-slate-800 pb-3">
              <button
                type="button"
                onClick={() => { setIsSignUpMode(false); setErrorMessage(null); setSuccessMessage(null); }}
                className={`pb-2 text-sm font-bold transition-all border-b-2 cursor-pointer ${
                  !isSignUpMode 
                    ? 'border-[#2BB673] text-[#2BB673] font-extrabold' 
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setIsSignUpMode(true); setErrorMessage(null); setSuccessMessage(null); }}
                className={`pb-2 text-sm font-bold transition-all border-b-2 cursor-pointer ${
                  isSignUpMode 
                    ? 'border-[#2BB673] text-[#2BB673] font-extrabold' 
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Register / Sign Up
              </button>
            </div>

            {/* Panel Heading & Subtitle */}
            <div className="space-y-1.5">
              <h2 className="text-xl font-bold text-white tracking-tight">
                {isSignUpMode ? 'Register Laboratory Account' : 'Laboratory Portal Sign In'}
              </h2>
              <p className="text-xs text-slate-400">
                {isSignUpMode
                  ? 'Create a new laboratory officer profile to access NAWI type evaluations.'
                  : 'Enter your official laboratory credentials to access active evaluations.'}
              </p>
            </div>

            {/* Error Message Box */}
            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                <span className="leading-relaxed">{errorMessage}</span>
              </div>
            )}

            {/* Success Message Box */}
            {successMessage && (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-start gap-2.5">
                <CheckCircle className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                <span className="leading-relaxed">{successMessage}</span>
              </div>
            )}

            {/* Login / Register Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {isSignUpMode && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Officer Full Name *
                  </label>
                  <input
                    type="text"
                    required={isSignUpMode}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Dr. Ananya Rao"
                    className="w-full px-4 py-3 text-xs bg-[#1A253E] border border-slate-700/60 rounded-xl text-white placeholder-slate-500 focus:outline-hidden focus:border-[#2BB673] focus:ring-1 focus:ring-[#2BB673] transition-all"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Laboratory / Organization ID
                </label>
                <input
                  type="text"
                  required
                  value={labId}
                  onChange={(e) => setLabId(e.target.value)}
                  placeholder="e.g. NML-DELHI-001"
                  className="w-full px-4 py-3 text-xs bg-[#1A253E] border border-slate-700/60 rounded-xl text-white placeholder-slate-500 focus:outline-hidden focus:border-[#2BB673] focus:ring-1 focus:ring-[#2BB673] transition-all font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Officer Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="officer@metrology.gov.in"
                  className="w-full px-4 py-3 text-xs bg-[#1A253E] border border-slate-700/60 rounded-xl text-white placeholder-slate-500 focus:outline-hidden focus:border-[#2BB673] focus:ring-1 focus:ring-[#2BB673] transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Password *
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 text-xs bg-[#1A253E] border border-slate-700/60 rounded-xl text-white placeholder-slate-500 focus:outline-hidden focus:border-[#2BB673] focus:ring-1 focus:ring-[#2BB673] transition-all"
                />
              </div>

              {!isSignUpMode && (
                <div className="flex items-center justify-between text-xs pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-300 select-none hover:text-white">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded border-slate-700 bg-[#1A253E] text-[#2BB673] focus:ring-0 cursor-pointer"
                    />
                    Remember this station
                  </label>
                </div>
              )}

              {/* Primary Teal Action Button matching exact #2BB673 color */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 bg-[#2BB673] hover:bg-[#239B61] text-white font-semibold text-sm rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 disabled:opacity-50 cursor-pointer mt-2"
              >
                {loading ? (
                  <span>{isSignUpMode ? 'Registering Officer...' : 'Authenticating Officer...'}</span>
                ) : (
                  <>
                    <span>{isSignUpMode ? 'Complete Registration & Sign Up' : 'Sign In to Laboratory System'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Real Supabase Authentication Status Notice */}
            {isSupabaseConfigured() && (
              <div className="p-3.5 rounded-xl bg-[#1A253E]/80 border border-slate-700/40 text-xs text-slate-400 space-y-1.5">
                <div className="flex items-center justify-between font-medium text-[#2BB673]">
                  <span className="flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5" /> Real Supabase Authentication Active
                  </span>
                  <button
                    type="button"
                    onClick={handleSignOutExisting}
                    className="text-[11px] text-rose-400 hover:underline cursor-pointer"
                  >
                    Clear Cached Session
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 leading-normal">
                  All demo/mock role login buttons are disabled. Enter your registered Supabase user email and password above to authenticate.
                </p>
              </div>
            )}

            {/* Card Security Footer */}
            <p className="text-[11px] text-slate-400 text-center flex items-center justify-center gap-1.5 pt-1">
              <Lock className="w-3.5 h-3.5 text-slate-500" />
              <span>Access restricted to authorized laboratory personnel.</span>
            </p>

          </div>
        </div>

      </div>

      {/* Page Footer */}
      <div className="relative z-10 px-6 lg:px-14 py-4 border-t border-slate-800/40 flex items-center justify-between text-xs text-slate-500 max-w-7xl mx-auto w-full">
        <span>Smart India Hackathon 2026 • Problem SIH26035</span>
        <span>v1.0.0</span>
      </div>
    </div>
  );
};
