import React, { useState, useEffect, useRef } from 'react';
import { 
  KeyRound, 
  ArrowLeft, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  Lock, 
  Mail, 
  RefreshCw, 
  ShieldCheck 
} from 'lucide-react';
import { authService } from '../../services/authService';

export type ForgotPasswordStep = 'ENTER_EMAIL' | 'ENTER_OTP' | 'NEW_PASSWORD' | 'SUCCESS';

interface ForgotPasswordFormProps {
  initialEmail?: string;
  onBackToLogin: () => void;
}

export const ForgotPasswordForm: React.FC<ForgotPasswordFormProps> = ({
  initialEmail = '',
  onBackToLogin,
}) => {
  const [step, setStep] = useState<ForgotPasswordStep>('ENTER_EMAIL');
  const [email, setEmail] = useState(initialEmail);
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  // Resend Countdown Timer State (60s)
  const [resendCountdown, setResendCountdown] = useState(0);

  // Refs for 6 OTP Input elements
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Mask email for display e.g. "su***@gmail.com"
  const getMaskedEmail = (rawEmail: string): string => {
    const clean = rawEmail.trim();
    if (!clean.includes('@')) return clean;
    const [name, domain] = clean.split('@');
    if (name.length <= 2) {
      return `${name}***@${domain}`;
    }
    return `${name.substring(0, 2)}***@${domain}`;
  };

  // Focus first OTP box when stepping into ENTER_OTP
  useEffect(() => {
    if (step === 'ENTER_OTP') {
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    }
  }, [step]);

  // Resend Countdown Effect
  useEffect(() => {
    let timer: any = null;
    if (resendCountdown > 0) {
      timer = setInterval(() => {
        setResendCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [resendCountdown]);

  // STEP 1: SEND RESET OTP
  const handleSendResetOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.trim()) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setInfoMessage(null);

    try {
      await authService.sendPasswordResetOTP(email);
      setInfoMessage('If an account exists for this email, a password reset code has been sent.');
      setStep('ENTER_OTP');
      setResendCountdown(60);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to send password reset code.');
    } finally {
      setLoading(false);
    }
  };

  // STEP 2: RESEND OTP
  const handleResendOTP = async () => {
    if (resendCountdown > 0 || loading) return;
    setLoading(true);
    setErrorMessage(null);
    setInfoMessage(null);

    try {
      await authService.sendPasswordResetOTP(email);
      setInfoMessage('A new password reset verification code has been sent to your email.');
      setResendCountdown(60);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to resend code.');
    } finally {
      setLoading(false);
    }
  };

  // OTP Input Key Handling (Auto-focus next/prev, Backspace, Paste)
  const handleOtpChange = (index: number, value: string) => {
    // Keep numeric digits only
    const digit = value.replace(/[^0-9]/g, '');
    
    const newDigits = [...otpDigits];
    newDigits[index] = digit.substring(digit.length - 1); // take single last typed digit
    setOtpDigits(newDigits);

    // Auto-advance if a digit was entered
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!otpDigits[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/[^0-9]/g, '').trim();
    if (!pastedData) return;

    const digits = pastedData.substring(0, 6).split('');
    const newDigits = ['', '', '', '', '', ''];
    digits.forEach((d, idx) => {
      newDigits[idx] = d;
    });
    setOtpDigits(newDigits);

    // Focus last filled digit or final input box
    const focusIndex = Math.min(digits.length, 5);
    inputRefs.current[focusIndex]?.focus();
  };

  // STEP 2: VERIFY OTP
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = otpDigits.join('');
    if (token.length < 6) {
      setErrorMessage('Please enter the full 6-digit verification code.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setInfoMessage(null);

    try {
      await authService.verifyRecoveryOTP(email, token);
      setInfoMessage('Verification successful! Create your new password below.');
      setStep('NEW_PASSWORD');
    } catch (err: any) {
      setErrorMessage(err.message || 'OTP verification failed. Please check the code and try again.');
    } finally {
      setLoading(false);
    }
  };

  // STEP 3: CHANGE PASSWORD
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPassword || newPassword.trim() === '') {
      setErrorMessage('Please enter a new password.');
      return;
    }

    if (newPassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please verify both fields.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setInfoMessage(null);

    try {
      await authService.updateUserPassword(newPassword);
      setStep('SUCCESS');
    } catch (err: any) {
      setErrorMessage(err.message || 'Password update failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // STEP 4: SUCCESS RETURN TO LOGIN
  const handleCompleteSuccess = async () => {
    try {
      await authService.signOut();
    } catch (_e) {
      // Ignore
    }
    onBackToLogin();
  };

  return (
    <div className="space-y-5">
      {/* Header Info Banner */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2 text-[#2BB673]">
          <KeyRound className="w-5 h-5 shrink-0" />
          <span className="font-extrabold text-sm tracking-tight text-white">Password Recovery</span>
        </div>
        {step !== 'SUCCESS' && (
          <button
            type="button"
            onClick={onBackToLogin}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
          </button>
        )}
      </div>

      {/* Subtitle / Step Progress */}
      <div className="space-y-1">
        {step === 'ENTER_EMAIL' && (
          <>
            <h2 className="text-lg font-bold text-white tracking-tight">Forgot Password</h2>
            <p className="text-xs text-slate-400">
              Enter your registered laboratory officer email address to receive a 6-digit verification code.
            </p>
          </>
        )}

        {step === 'ENTER_OTP' && (
          <>
            <h2 className="text-lg font-bold text-white tracking-tight">Verify Reset Code</h2>
            <p className="text-xs text-slate-400">
              We sent a password reset code to{' '}
              <strong className="text-slate-200 font-mono">{getMaskedEmail(email)}</strong>
            </p>
          </>
        )}

        {step === 'NEW_PASSWORD' && (
          <>
            <h2 className="text-lg font-bold text-white tracking-tight">Create New Password</h2>
            <p className="text-xs text-slate-400">
              Set a new secure password for your METRIQ laboratory account.
            </p>
          </>
        )}

        {step === 'SUCCESS' && (
          <>
            <h2 className="text-lg font-bold text-emerald-400 tracking-tight flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" /> Password Changed Successfully
            </h2>
            <p className="text-xs text-slate-300">
              Your password has been updated. Sign in using your new password.
            </p>
          </>
        )}
      </div>

      {/* Error Message Box */}
      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
          <span className="leading-relaxed">{errorMessage}</span>
        </div>
      )}

      {/* Info/Generic Neutral Notification Box */}
      {infoMessage && (
        <div className="p-3.5 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-300 text-xs flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-teal-400" />
          <span className="leading-relaxed">{infoMessage}</span>
        </div>
      )}

      {/* STEP 1: ENTER EMAIL FORM */}
      {step === 'ENTER_EMAIL' && (
        <form onSubmit={handleSendResetOTP} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Registered Email Address *
            </label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="officer@metrology.gov.in"
                className="w-full pl-10 pr-4 py-3 text-xs bg-[#1A253E] border border-slate-700/60 rounded-xl text-white placeholder-slate-500 focus:outline-hidden focus:border-[#2BB673] focus:ring-1 focus:ring-[#2BB673] transition-all"
              />
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !email.trim()}
            className="w-full py-3.5 px-4 bg-[#2BB673] hover:bg-[#239B61] text-white font-semibold text-sm rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <span>Sending Reset Code...</span>
            ) : (
              <>
                <span>Send Reset OTP</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      )}

      {/* STEP 2: ENTER OTP FORM */}
      {step === 'ENTER_OTP' && (
        <form onSubmit={handleVerifyOTP} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2.5 text-center">
              Enter 6-Digit Verification Code *
            </label>

            {/* 6 Digit Numeric Boxes */}
            <div className="flex items-center justify-center gap-2 sm:gap-3">
              {otpDigits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => { inputRefs.current[idx] = el; }}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(idx, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                  onPaste={handleOtpPaste}
                  className="w-11 h-12 text-center text-lg font-mono font-extrabold bg-[#1A253E] border-2 border-slate-700/70 focus:border-[#2BB673] focus:ring-2 focus:ring-[#2BB673]/30 rounded-xl text-white outline-hidden transition-all shadow-inner"
                />
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || otpDigits.join('').length < 6}
            className="w-full py-3.5 px-4 bg-[#2BB673] hover:bg-[#239B61] text-white font-semibold text-sm rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <span>Verifying Code...</span>
            ) : (
              <>
                <span>Verify OTP & Continue</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          {/* Resend Code Footer */}
          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800">
            <button
              type="button"
              onClick={() => { setStep('ENTER_EMAIL'); setErrorMessage(null); setInfoMessage(null); }}
              className="text-slate-400 hover:text-white cursor-pointer"
            >
              Change Email
            </button>

            {resendCountdown > 0 ? (
              <span className="text-slate-400 font-mono">
                Resend code in <strong className="text-teal-400">{resendCountdown}s</strong>
              </span>
            ) : (
              <button
                type="button"
                onClick={handleResendOTP}
                disabled={loading}
                className="text-[#2BB673] hover:underline font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Resend Reset OTP
              </button>
            )}
          </div>
        </form>
      )}

      {/* STEP 3: NEW PASSWORD FORM */}
      {step === 'NEW_PASSWORD' && (
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              New Password *
            </label>
            <div className="relative">
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-3 text-xs bg-[#1A253E] border border-slate-700/60 rounded-xl text-white placeholder-slate-500 focus:outline-hidden focus:border-[#2BB673] focus:ring-1 focus:ring-[#2BB673] transition-all"
              />
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Confirm New Password *
            </label>
            <div className="relative">
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-3 text-xs bg-[#1A253E] border border-slate-700/60 rounded-xl text-white placeholder-slate-500 focus:outline-hidden focus:border-[#2BB673] focus:ring-1 focus:ring-[#2BB673] transition-all"
              />
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !newPassword || newPassword !== confirmPassword}
            className="w-full py-3.5 px-4 bg-[#2BB673] hover:bg-[#239B61] text-white font-semibold text-sm rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <span>Updating Password...</span>
            ) : (
              <>
                <span>Change Password</span>
                <CheckCircle2 className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      )}

      {/* STEP 4: SUCCESS VIEW */}
      {step === 'SUCCESS' && (
        <div className="space-y-5 text-center pt-2">
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs space-y-2 max-w-sm mx-auto">
            <p className="leading-relaxed">
              Your account password has been updated in Supabase Auth. You can now sign in with your new password.
            </p>
          </div>

          <button
            type="button"
            onClick={handleCompleteSuccess}
            className="w-full py-3.5 px-4 bg-[#2BB673] hover:bg-[#239B61] text-white font-semibold text-sm rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 cursor-pointer"
          >
            <span>Back to Sign In</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
