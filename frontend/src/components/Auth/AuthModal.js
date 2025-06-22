'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { setCookie } from '@/utils/cookieUtils';
import Link from 'next/link';
import StatusMessage from '@/components/UI/StatusMessage';
import { useTheme } from '@/hooks/ThemeProvider';

const WP_GRAPHQL_URL = process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || 'http://localhost:4000/graphql';

function getPasswordValidationErrors(pw) {
  const errors = [];
  if (pw.length < 8) errors.push('At least 8 characters');
  if (!/[A-Z]/.test(pw)) errors.push('At least one uppercase letter');
  if (!/[a-z]/.test(pw)) errors.push('At least one lowercase letter');
  if (!/[0-9]/.test(pw)) errors.push('At least one number');
  if (!/[\W_]/.test(pw)) errors.push('At least one special character');
  return errors;
}

export default function AuthModal({ isOpen, onClose, onAuthSuccess }) {
  const { dark } = useTheme();
  const [isLogin, setIsLogin] = useState(true);
  const [statusMessage, setStatusMessage] = useState(null);
  const [registerPassword, setRegisterPassword] = useState('');
  const [showPasswordRules, setShowPasswordRules] = useState(false);
  const [showVerifyWarning, setShowVerifyWarning] = useState(false);
  const [verifyResendStatus, setVerifyResendStatus] = useState('');
  const [lastLoginEmail, setLastLoginEmail] = useState('');
  const [pendingVerification, setPendingVerification] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm();

  let GoogleLoginComponent = null;
  if (typeof window !== 'undefined') {
    const googleMod = require('@react-oauth/google');
    GoogleLoginComponent = googleMod.GoogleLogin;
  }

  const showStatusMessage = (type, message) => {
    setStatusMessage({ type, message });
    setTimeout(() => setStatusMessage(null), 4500);
  };

  const handleResendVerification = async () => {
    setVerifyResendStatus('Sending...');
    const res = await fetch('/api/resend-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: lastLoginEmail }),
    });
    if (res.ok) {
      setVerifyResendStatus('Verification email sent! Please check your inbox.');
    } else {
      setVerifyResendStatus('Could not send verification email. Please contact support.');
    }
  };

  const onSubmit = async (formData) => {
    const { username, email, password, terms } = formData;
    if (!isLogin && !terms) {
      showStatusMessage('error', 'You must agree to the Terms and Privacy Policy.');
      return;
    }
    if (!isLogin) {
      const pwErrors = getPasswordValidationErrors(password);
      if (pwErrors.length > 0) {
        setShowPasswordRules(true);
        showStatusMessage('error', `Password requirements not met: ${pwErrors.join(', ')}`);
        return;
      }
    }

    // --- Updated mutation structure to match backend schema ---
    const query = isLogin
      ? `
        mutation Login($login: String!, $password: String!) {
          login(login: $login, password: $password) {
            token
            user {
              id
              username
              email
            }
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
              isVerified
              lastLoginAt
              createdAt
              updatedAt
              avatarUrl
              mfaEnabled
              oauthProvider
              oauthId
            }
          }
        }
      `;
    const variables = isLogin ? { login: username, password } : { username, email, password };

    try {
      const response = await fetch(WP_GRAPHQL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables }),
      });
      const json = await response.json();

      if (isLogin) {
        const errorMsg = json?.errors?.[0]?.extensions?.debugMessage || json?.errors?.[0]?.message;
        if (errorMsg === 'Please verify your email before logging in.') {
          setShowVerifyWarning(true);
          setLastLoginEmail(username);
          showStatusMessage('warning', errorMsg);
          return;
        }
        setShowVerifyWarning(false);
        const { token, user } = json?.data?.login || {};
        if (token) {
          setCookie('authToken', token, 7);
          if (onAuthSuccess) onAuthSuccess({ username: user?.username, email: user?.email });
          onClose();
        } else {
          showStatusMessage('error', json?.errors?.[0]?.message || 'Login failed');
        }
      } else {
        setShowVerifyWarning(false);
        const registerResult = json?.data?.register;
        if (registerResult && registerResult.user) {
          // Show message, do NOT auto-login
          setPendingVerification(true);
          showStatusMessage('success', `Registration successful! Please check your email to verify your account before logging in.`);
          reset();
          setRegisterPassword('');
        } else {
          const errorMsg = json?.errors?.[0]?.message || 'Registration failed';

          if (errorMsg === 'Username is already taken.') {
            showStatusMessage('error', 'That username is already taken. Please choose another.');
          } else if (errorMsg === 'Email is already registered.') {
            showStatusMessage('error', 'That email address is already registered. Try logging in or resetting your password.');
          } else {
            showStatusMessage('error', errorMsg);
          }
        }
      }
    } catch (err) {
      showStatusMessage('error', 'Something went wrong. Please try again.');
      console.error('Login error:', err);
    }
  };

  const handleGoogleSuccess = async (response) => {
    const { credential } = response;
    const query = `
      mutation GoogleLogin($idToken: String!) {
        loginCustomUser(input: { credentials: { idToken: $idToken } }) {
          token
          user { id username email }
        }
      }
    `;
    const variables = { idToken: credential };

    try {
      const res = await fetch(WP_GRAPHQL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables }),
      });
      const json = await res.json();
      const { token, user } = json?.data?.loginCustomUser || {};
      if (token) {
        setCookie('authToken', token, 7);
        if (onAuthSuccess) onAuthSuccess({ username: user?.username, email: user?.email });
        onClose();
      } else {
        showStatusMessage('error', json?.errors?.[0]?.message || 'Google login failed');
      }
    } catch (err) {
      showStatusMessage('error', 'Something went wrong with Google login. Please try again.');
      console.error('Google login error:', err);
    }
  };

  const handleGoogleFailure = (error) => {
    console.error('Google login error:', error);
    showStatusMessage('error', 'Google login failed. Please try again.');
  };

  const pwErrors = !isLogin ? getPasswordValidationErrors(registerPassword) : [];

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className={`
          relative w-full max-w-md mx-auto rounded-3xl px-7 py-8 shadow-2xl
          flex flex-col items-stretch bg-light-surface dark:bg-dark-surface
          border border-light-border dark:border-dark-border
          transition-colors
        `}
        onClick={e => e.stopPropagation()}
      >
        <button
          className="absolute top-5 right-6 text-3xl text-light-textMuted dark:text-dark-textMuted hover:text-light-accent dark:hover:text-dark-accent transition"
          aria-label="Close modal"
          onClick={onClose}
          type="button"
        >
          &times;
        </button>
        <h2 className="text-2xl font-bold text-center mb-6 text-light-accent dark:text-dark-accent tracking-tight">
          {isLogin ? "Login" : "Register"}
        </h2>
        {pendingVerification && (
          <div className="mb-3 rounded-xl bg-light-warning/20 border-l-4 border-light-accent dark:bg-dark-warning/10 dark:border-dark-accent px-4 py-3 text-light-text dark:text-dark-text text-sm font-medium">
            Registration successful! Please check your email to verify your account before logging in.
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
              {verifyResendStatus === "Sending..." ? "Sending..." : "Resend Verification Email"}
            </button>
            <div className="mt-2 text-xs text-light-textMuted dark:text-dark-textMuted">{verifyResendStatus}</div>
          </div>
        )}
        <form className="flex flex-col gap-2 mb-3" onSubmit={handleSubmit(onSubmit)} autoComplete="on">
          <div className="flex flex-col gap-1 mb-2">
            <label htmlFor="username" className="font-semibold text-light-accent dark:text-dark-accent">Username</label>
            <input
              {...register("username", { required: true })}
              id="username"
              placeholder="Username"
              autoComplete="username"
              className="rounded-lg border border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt px-4 py-2 text-base text-light-text dark:text-dark-text focus:border-light-accent dark:focus:border-dark-accent focus:outline-none transition"
            />
            {errors.username && <p className="text-xs text-light-error dark:text-dark-error">Username is required</p>}
          </div>
          {!isLogin && (
            <div className="flex flex-col gap-1 mb-2">
              <label htmlFor="email" className="font-semibold text-light-accent dark:text-dark-accent">Email</label>
              <input
                {...register("email", { required: true })}
                id="email"
                placeholder="Email"
                autoComplete="email"
                className="rounded-lg border border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt px-4 py-2 text-base text-light-text dark:text-dark-text focus:border-light-accent dark:focus:border-dark-accent focus:outline-none transition"
              />
              {errors.email && <p className="text-xs text-light-error dark:text-dark-error">Email is required</p>}
            </div>
          )}
          <div className="flex flex-col gap-1 mb-1">
            <label htmlFor="password" className="font-semibold text-light-accent dark:text-dark-accent">Password</label>
            <input
              {...register("password", { required: true })}
              id="password"
              type="password"
              placeholder="Password"
              autoComplete={isLogin ? "current-password" : "new-password"}
              className="rounded-lg border border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt px-4 py-2 text-base text-light-text dark:text-dark-text focus:border-light-accent dark:focus:border-dark-accent focus:outline-none transition"
              onFocus={() => !isLogin && setShowPasswordRules(true)}
              onBlur={() => !isLogin && setShowPasswordRules(true)}
              onChange={e => {
                if (!isLogin) setRegisterPassword(e.target.value);
                register('password').onChange(e);
              }}
            />
            {errors.password && <p className="text-xs text-light-error dark:text-dark-error">Password is required</p>}
            {!isLogin && showPasswordRules && (
              <ul className="pl-5 pt-1 pb-1 text-sm">
                {[
                  "At least 8 characters",
                  "At least one uppercase letter",
                  "At least one lowercase letter",
                  "At least one number",
                  "At least one special character"
                ].map((rule, i) => {
                  const isFail = pwErrors.includes(rule);
                  return (
                    <li key={rule} className={`mb-0.5 ${isFail ? "text-light-error dark:text-dark-error" : "text-green-600 dark:text-green-400"} flex items-center gap-1`}>
                      {isFail ? "✗" : "✓"} {rule}
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="text-right mt-1 text-xs">
              <Link href="/forgot-password" className="text-light-accent dark:text-dark-accent hover:underline">
                Forgot Password?
              </Link>
            </p>
          </div>
          {!isLogin && (
            <div className="flex items-center gap-2 my-2">
              <input
                type="checkbox"
                id="terms"
                {...register("terms", { required: true })}
                className="accent-light-accent dark:accent-dark-accent rounded focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent transition"
              />
              <label htmlFor="terms" className="text-sm text-light-textSecondary dark:text-dark-textSecondary">
                I agree to the{" "}
                <Link href="/terms" className="text-light-accent dark:text-dark-accent underline" target="_blank">
                  Terms of Service
                </Link>{" "}
                and{" "}
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
          <button
            type="submit"
            className="mt-2 w-full rounded-lg bg-light-accent dark:bg-dark-accent text-white font-bold text-lg py-2 px-4 transition-colors hover:bg-light-accentLight dark:hover:bg-dark-accentLight focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent"
            disabled={statusMessage?.type === 'loading'}
          >
            {isLogin ? "Login" : "Register"}
          </button>
        </form>
        <div className="flex items-center gap-3 text-center my-4">
          <hr className="flex-grow border-light-border dark:border-dark-border" />
          <span className="text-light-textMuted dark:text-dark-textMuted text-sm">or</span>
          <hr className="flex-grow border-light-border dark:border-dark-border" />
        </div>
        <div className="mb-2 text-center">
          {GoogleLoginComponent ? (
            <GoogleLoginComponent onSuccess={handleGoogleSuccess} onError={handleGoogleFailure} useOneTap />
          ) : (
            <span className="text-light-textMuted dark:text-dark-textMuted text-sm">Google Login not available</span>
          )}
        </div>
        <div className="flex justify-center items-center gap-2 mt-2 text-base text-light-textSecondary dark:text-dark-textSecondary">
          {isLogin ? "No account?" : "Already have an account?"}
          <button
            type="button"
            className="font-bold text-light-accent dark:text-dark-accent hover:underline"
            onClick={() => {
              setIsLogin(!isLogin);
              setStatusMessage(null);
              setRegisterPassword('');
              setShowPasswordRules(false);
              reset();
              setShowVerifyWarning(false);
              setVerifyResendStatus('');
              setPendingVerification(false);
            }}
          >
            {isLogin ? "Register" : "Login"}
          </button>
        </div>
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
