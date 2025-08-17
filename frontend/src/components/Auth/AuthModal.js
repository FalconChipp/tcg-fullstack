'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { setCookie } from '@/utils/cookieUtils';
import Link from 'next/link';
import StatusMessage from '@/components/UI/StatusMessage';
import { useTheme } from '@/hooks/ThemeProvider';

const WP_GRAPHQL_URL = process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT;

/* ========= Helpers ========= */

function getPasswordValidationErrors(pw) {
  const errors = [];
  if (pw.length < 8) errors.push('At least 8 characters');
  if (!/[A-Z]/.test(pw)) errors.push('At least one uppercase letter');
  if (!/[a-z]/.test(pw)) errors.push('At least one lowercase letter');
  if (!/[0-9]/.test(pw)) errors.push('At least one number');
  if (!/[\W_]/.test(pw)) errors.push('At least one special character');
  return errors;
}

// CHANGED: simple analytics shim (works with gtag or dataLayer if present)
function track(event, payload = {}) {
  try {
    if (typeof window === 'undefined') return;
    if (window.gtag) window.gtag('event', event, payload);
    if (window.dataLayer) window.dataLayer.push({ event, ...payload });
  } catch (_) {}
}

/* ========= Component ========= */

export default function AuthModal({
  isOpen,
  onClose,
  onAuthSuccess,
  defaultMode = 'login', // 'login' | 'register'
}) {
  const { dark } = useTheme();

  const [isLogin, setIsLogin] = useState(defaultMode === 'login');
  const [statusMessage, setStatusMessage] = useState(null);
  const [registerPassword, setRegisterPassword] = useState('');
  const [showPasswordRules, setShowPasswordRules] = useState(false);
  const [showVerifyWarning, setShowVerifyWarning] = useState(false);
  const [verifyResendStatus, setVerifyResendStatus] = useState('');
  const [lastLoginEmail, setLastLoginEmail] = useState('');
  const [pendingVerification, setPendingVerification] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const modalRef = useRef(null);
  const firstFocusRef = useRef(null);
  const lastFocusRef = useRef(null);
  const backdropRef = useRef(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setFocus,
  } = useForm();

  // // Google (only on client)
  // let GoogleLoginComponent = null;
  // if (typeof window !== 'undefined') {
  //   try {
  //     const googleMod = require('@react-oauth/google');
  //     GoogleLoginComponent = googleMod.GoogleLogin;
  //   } catch (_) {}
  // }

  const showStatus = (type, message, ttl = 4500) => {
    setStatusMessage({ type, message });
    if (ttl) {
      setTimeout(() => setStatusMessage(null), ttl);
    }
  };

  // Password strength (live)
  const pwErrors = useMemo(
    () => (!isLogin ? getPasswordValidationErrors(registerPassword) : []),
    [isLogin, registerPassword]
  );
  const pwStrength = useMemo(() => {
    if (isLogin) return null;
    const total = 5;
    const passed = total - pwErrors.length;
    return { score: passed, total };
  }, [pwErrors, isLogin]);

  // Focus trap + ESC close (CHANGED)
  useEffect(() => {
    if (!isOpen) return;
    const modalEl = modalRef.current;
    // initial focus
    setTimeout(() => {
      try {
        (firstFocusRef.current || modalEl)?.focus();
      } catch (_) {}
    }, 0);

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose?.();
      }
      if (e.key === 'Tab') {
        const focusables = modalEl?.querySelectorAll(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusables || focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [isOpen, onClose]);

  // Backdrop click (don’t close when clicking inside)
  const onBackdropClick = (e) => {
    if (e.target === backdropRef.current) {
      onClose?.();
    }
  };

  // Verification resend (CHANGED: small debounce + feedback)
  let resendTimer = useRef(null);
  const handleResendVerification = async () => {
    if (resendTimer.current) return;
    setVerifyResendStatus('Sending…');
    resendTimer.current = setTimeout(() => (resendTimer.current = null), 2500);
    try {
      const res = await fetch('/api/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: lastLoginEmail }),
      });
      if (res.ok) {
        setVerifyResendStatus('Verification email sent! Check your inbox.');
        track('auth_resend_verification', { method: 'email' });
      } else {
        setVerifyResendStatus('Could not send verification email. Please contact support.');
      }
    } catch (err) {
      setVerifyResendStatus('Network error. Please try again.');
    }
  };

  const onSubmit = async (formData) => {
    if (submitting) return;
    const { username: identifier, email, password, terms } = formData;

    // Register: terms + strong password
    if (!isLogin && !terms) {
      showStatus('error', 'You must agree to the Terms and Privacy Policy.');
      return;
    }
    if (!isLogin) {
      const errs = getPasswordValidationErrors(password);
      if (errs.length > 0) {
        setShowPasswordRules(true);
        showStatus('error', `Password requirements not met: ${errs.join(', ')}`);
        return;
      }
    }

    const query = isLogin
      ? `
        mutation Login($email: String, $username: String, $password: String!) {
          login(email: $email, username: $username, password: $password) {
            token
            user { id username email }
          }
        }
      `
      : `
        mutation Register($username: String!, $email: String!, $password: String!) {
          register(username: $username, email: $email, password: $password) {
            user {
              id
              username
              email
              emailVerified
              lastLogin
              createdAt
              updatedAt
              avatar
              mfaEnabled
              oauthProvider
              oauthId
            }
          }
        }
      `;

    const variables = isLogin
      ? identifier?.includes('@')
        ? { email: identifier, password }
        : { username: identifier, password }
      : { username: identifier, email, password };

    try {
      setSubmitting(true);
      showStatus('loading', isLogin ? 'Logging in…' : 'Creating your account…', 0);

      const response = await fetch(WP_GRAPHQL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables }),
      });

      if (!response.ok) {
        showStatus('error', 'Server error. Please try again.');
        setSubmitting(false);
        return;
      }

      const json = await response.json();

      if (json?.errors?.length) {
        const errorMsg =
          json.errors[0]?.extensions?.debugMessage ||
          json.errors[0]?.message ||
          'Something went wrong. Please try again.';
        if (isLogin && /verify your email/i.test(errorMsg)) {
          setShowVerifyWarning(true);
          setLastLoginEmail(identifier?.includes('@') ? identifier : '');
          showStatus('warning', 'Please verify your email before logging in.');
          setSubmitting(false);
          return;
        }
        showStatus('error', errorMsg);
        setSubmitting(false);
        return;
      }

      if (isLogin) {
        const { token, user } = json?.data?.login || {};
        if (token) {
          setCookie('authToken', token, 7);
          showStatus(null, null); // clear
          track('auth_login_success', { method: 'password' });
          onAuthSuccess?.({ id: user?.id, username: user?.username, email: user?.email });
          onClose?.();
        } else {
          showStatus('error', 'Login failed. Please try again.');
        }
      } else {
        const registerResult = json?.data?.register;
        if (registerResult?.user) {
          setPendingVerification(true);
          showStatus(
            'success',
            'Registration successful! Please check your email to verify your account.'
          );
          reset();
          setRegisterPassword('');
          track('auth_register_success', { method: 'password' });
          // keep modal open so they can switch to Login after verifying
        } else {
          showStatus('error', 'Registration failed. Please try again.');
        }
      }
    } catch (err) {
      showStatus('error', 'Network error. Please try again.');
      console.error('Auth error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // const handleGoogleSuccess = async (response) => {
  //   const { credential } = response || {};
  //   if (!credential) return showStatus('error', 'Google login failed. Try again.');
  //   const query = `
  //     mutation GoogleLogin($idToken: String!) {
  //       loginGoogle(googleToken: $idToken) {
  //         token
  //         user { id username email }
  //       }
  //     }
  //   `;
  //   const variables = { idToken: credential };

  //   try {
  //     setSubmitting(true);
  //     showStatus('loading', 'Signing you in…', 0);
  //     const res = await fetch(WP_GRAPHQL_URL, {
  //       method: 'POST',
  //       headers: { 'Content-Type': 'application/json' },
  //       body: JSON.stringify({ query, variables }),
  //     });
  //     const json = await res.json();
  //     const { token, user } = json?.data?.loginGoogle || {};
  //     if (token) {
  //       setCookie('authToken', token, 7);
  //       track('auth_login_success', { method: 'google' });
  //       onAuthSuccess?.({ id: user?.id, username: user?.username, email: user?.email });
  //       onClose?.();
  //     } else {
  //       showStatus('error', json?.errors?.[0]?.message || 'Google login failed');
  //     }
  //   } catch (err) {
  //     showStatus('error', 'Something went wrong with Google login. Please try again.');
  //     console.error('Google login error:', err);
  //   } finally {
  //     setSubmitting(false);
  //   }
  // };

  const handleGoogleFailure = (error) => {
    console.error('Google login error:', error);
    showStatus('error', 'Google login failed. Please try again.');
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setStatusMessage(null);
    setRegisterPassword('');
    setShowPasswordRules(false);
    reset();
    setShowVerifyWarning(false);
    setVerifyResendStatus('');
    setPendingVerification(false);
    setTimeout(() => {
      try {
        setFocus('username');
      } catch (_) {}
    }, 0);
    track('auth_toggle_mode', { to: !isLogin ? 'login' : 'register' });
  };

  if (!isOpen) return null;

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center"
      onClick={onBackdropClick}
      role="presentation"
      data-testid="auth-backdrop"
    >
      <div
        ref={modalRef}
        className="
          relative w-full max-w-md mx-auto rounded-3xl px-7 py-8 shadow-2xl
          flex flex-col items-stretch bg-light-surface dark:bg-dark-surface
          border border-light-border dark:border-dark-border
          transition-colors
          outline-none
        "
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        {/* Close */}
        <button
          className="absolute top-5 right-6 text-3xl text-light-textMuted dark:text-dark-textMuted hover:text-light-accent dark:hover:text-dark-accent transition"
          aria-label="Close modal"
          onClick={onClose}
          type="button"
          ref={firstFocusRef}
        >
          &times;
        </button>

        {/* Title */}
        <h2
          id="auth-title"
          className="text-2xl font-bold text-center mb-2 text-light-accent dark:text-dark-accent tracking-tight"
        >
          {isLogin ? 'Login' : 'Create your account'}
        </h2>
        {!isLogin && (
          <p className="text-center text-sm text-light-textSecondary dark:text-dark-textSecondary mb-4">
            Track your collection, build binders, and share your profile. Free to start.
          </p>
        )}

        {pendingVerification && (
          <div className="mb-3 rounded-xl bg-light-warning/20 border-l-4 border-light-accent dark:bg-dark-warning/10 dark:border-dark-accent px-4 py-3 text-light-text dark:text-dark-text text-sm font-medium">
            Registration successful! Check your email to verify your account before logging in.
          </div>
        )}

        {showVerifyWarning && (
          <div className="mb-3 rounded-xl bg-light-warning/20 border-l-4 border-light-accent dark:bg-dark-warning/10 dark:border-dark-accent px-4 py-3 text-light-text dark:text-dark-text text-sm font-medium">
            <p>You must verify your email address before logging in.</p>
            <button
              className="mt-2 w-full rounded-lg py-2 px-4 bg-light-accent/10 dark:bg-dark-accent/10 text-light-accent dark:text-dark-accent font-bold hover:bg-light-accent/30 dark:hover:bg-dark-accent/30 transition"
              onClick={handleResendVerification}
              type="button"
            >
              {verifyResendStatus === 'Sending…' ? 'Sending…' : 'Resend verification email'}
            </button>
            <div className="mt-2 text-xs text-light-textMuted dark:text-dark-textMuted">
              {verifyResendStatus}
            </div>
          </div>
        )}

        {/* Form */}
        <form
          className="flex flex-col gap-2 mb-3"
          onSubmit={handleSubmit(onSubmit)}
          autoComplete="on"
        >
          {/* Username / Email */}
          <div className="flex flex-col gap-1 mb-2">
            <label htmlFor="username" className="font-semibold text-light-accent dark:text-dark-accent">
              {isLogin ? 'Username or Email' : 'Username'}
            </label>
            <input
              {...register('username', { required: true })}
              id="username"
              placeholder={isLogin ? 'Username or Email' : 'Username'}
              autoComplete="username"
              className="rounded-lg border border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt px-4 py-2 text-base text-light-text dark:text-dark-text focus:border-light-accent dark:focus:border-dark-accent focus:outline-none transition"
            />
            {errors.username && (
              <p className="text-xs text-light-error dark:text-dark-error">
                {isLogin ? 'Username or Email is required' : 'Username is required'}
              </p>
            )}
          </div>

          {!isLogin && (
            <div className="flex flex-col gap-1 mb-2">
              <label htmlFor="email" className="font-semibold text-light-accent dark:text-dark-accent">
                Email
              </label>
              <input
                {...register('email', { required: true })}
                id="email"
                placeholder="Email"
                autoComplete="email"
                className="rounded-lg border border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt px-4 py-2 text-base text-light-text dark:text-dark-text focus:border-light-accent dark:focus:border-dark-accent focus:outline-none transition"
              />
              {errors.email && (
                <p className="text-xs text-light-error dark:text-dark-error">Email is required</p>
              )}
            </div>
          )}

          {/* Password */}
          <div className="flex flex-col gap-1 mb-1">
            <label htmlFor="password" className="font-semibold text-light-accent dark:text-dark-accent">
              Password
            </label>
            <div className="relative">
              <input
                {...register('password', { required: true })}
                id="password"
                type={showPw ? 'text' : 'password'}
                placeholder="Password"
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                className="w-full rounded-lg border border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt px-4 py-2 pr-12 text-base text-light-text dark:text-dark-text focus:border-light-accent dark:focus:border-dark-accent focus:outline-none transition"
                onFocus={() => !isLogin && setShowPasswordRules(true)}
                onBlur={() => !isLogin && setShowPasswordRules(true)}
                onChange={(e) => {
                  if (!isLogin) setRegisterPassword(e.target.value);
                  register('password').onChange(e);
                }}
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-sm px-2 py-1 rounded hover:bg-light-border/50 dark:hover:bg-dark-border/50"
                aria-label={showPw ? 'Hide password' : 'Show password'}
                onClick={() => setShowPw((v) => !v)}
              >
                {showPw ? 'Hide' : 'Show'}
              </button>
            </div>
            {errors.password && (
              <p className="text-xs text-light-error dark:text-dark-error">Password is required</p>
            )}

            {/* Rules + strength (register only) */}
            {!isLogin && showPasswordRules && (
              <div className="mt-1">
                {/* Strength bar */}
                {pwStrength && (
                  <div className="mb-1 h-2 w-full bg-light-border dark:bg-dark-border rounded">
                    <div
                      className={`h-2 rounded ${
                        pwStrength.score >= 4
                          ? 'bg-green-500'
                          : pwStrength.score >= 3
                          ? 'bg-amber-500'
                          : 'bg-red-500'
                      }`}
                      style={{
                        width: `${(pwStrength.score / pwStrength.total) * 100}%`,
                        transition: 'width 150ms ease',
                      }}
                    />
                  </div>
                )}
                <ul className="pl-5 pt-1 pb-1 text-sm">
                  {[
                    'At least 8 characters',
                    'At least one uppercase letter',
                    'At least one lowercase letter',
                    'At least one number',
                    'At least one special character',
                  ].map((rule) => {
                    const fail = pwErrors.includes(rule);
                    return (
                      <li
                        key={rule}
                        className={`mb-0.5 flex items-center gap-1 ${
                          fail ? 'text-light-error dark:text-dark-error' : 'text-green-600 dark:text-green-400'
                        }`}
                      >
                        {fail ? '✗' : '✓'} {rule}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <p className="text-right mt-1 text-xs">
              <Link href="/forgot-password" className="text-light-accent dark:text-dark-accent hover:underline">
                Forgot password?
              </Link>
            </p>
          </div>

          {/* Terms (register only) */}
          {!isLogin && (
            <div className="flex items-start gap-2 my-2">
              <input
                type="checkbox"
                id="terms"
                {...register('terms', { required: true })}
                className="mt-1 accent-light-accent dark:accent-dark-accent rounded focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent transition"
              />
              <label htmlFor="terms" className="text-sm text-light-textSecondary dark:text-dark-textSecondary">
                I agree to the{' '}
                <Link href="/terms" className="text-light-accent dark:text-dark-accent underline" target="_blank">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link href="/privacy" className="text-light-accent dark:text-dark-accent underline" target="_blank">
                  Privacy Policy
                </Link>
                .
              </label>
            </div>
          )}
          {!isLogin && errors.terms && (
            <p className="text-xs text-light-error dark:text-dark-error mb-1">
              You must agree to the Terms of Service and Privacy Policy to register.
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            className="
              mt-2 w-full rounded-lg bg-light-accent dark:bg-dark-accent
              text-white font-bold text-lg py-2 px-4 transition-colors
              hover:bg-light-accentLight dark:hover:bg-dark-accentLight
              focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent
              disabled:opacity-70 disabled:cursor-not-allowed
            "
            disabled={submitting}
            data-testid="auth-submit"
            ref={lastFocusRef}
          >
            {submitting ? (isLogin ? 'Logging in…' : 'Creating…') : isLogin ? 'Login' : 'Register'}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 text-center my-4">
          <hr className="flex-grow border-light-border dark:border-dark-border" />
          <span className="text-light-textMuted dark:text-dark-textMuted text-sm">or</span>
          <hr className="flex-grow border-light-border dark:border-dark-border" />
        </div>

        {/* Google login (shows if available) */}
        {/* <div className="mb-2 text-center">
          {GoogleLoginComponent ? (
            <GoogleLoginComponent onSuccess={handleGoogleSuccess} onError={handleGoogleFailure} useOneTap />
          ) : (
            <span className="text-light-textMuted dark:text-dark-textMuted text-sm">
              Social sign-in is coming soon.
            </span>
          )}
        </div> */}

        {/* Toggle mode */}
        <div className="flex justify-center items-center gap-2 mt-2 text-base text-light-textSecondary dark:text-dark-textSecondary">
          {isLogin ? 'No account?' : 'Already have an account?'}
          <button
            type="button"
            className="font-bold text-light-accent dark:text-dark-accent hover:underline"
            onClick={toggleMode}
          >
            {isLogin ? 'Register' : 'Login'}
          </button>
        </div>

        {/* Toast / status */}
        {statusMessage && (
          <div className="absolute left-1/2 -translate-x-1/2 bottom-6 w-[90%] max-w-md z-10">
            <StatusMessage
              type={statusMessage.type}
              message={statusMessage.message}
              onClose={() => setStatusMessage(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
