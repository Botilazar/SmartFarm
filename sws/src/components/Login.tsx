import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, Building2, Sprout, User, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../db/supabaseClient';
import { dbService } from '../db/dbService';
import { useTranslation } from '../context/LanguageContext';

interface LoginProps {
  onLogin: (user: { id: string; name: string; email: string; role: 'admin' | 'operator'; avatar_url?: string; is_gep?: boolean }) => void;
  initialView?: 'login' | 'register' | 'forgot' | 'reset-password';
  onPasswordResetComplete?: () => void;
}

export const Login: React.FC<LoginProps> = ({
  onLogin,
  initialView = 'login',
  onPasswordResetComplete
}) => {
  const { t, language, setLanguage } = useTranslation();
  const [rememberMe, setRememberMe] = useState(() => {
    return localStorage.getItem('smartfarm_remember_me') !== 'false';
  });
  const [email, setEmail] = useState(() => {
    const isRemembered = localStorage.getItem('smartfarm_remember_me') !== 'false';
    return isRemembered ? (localStorage.getItem('smartfarm_remembered_email') || '') : '';
  });
  const [password, setPassword] = useState(() => {
    const isRemembered = localStorage.getItem('smartfarm_remember_me') !== 'false';
    return isRemembered ? (localStorage.getItem('smartfarm_remembered_password') || '') : '';
  });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const role: 'admin' | 'operator' = 'operator';

  // New state variables for registration and state management
  const [authView, setAuthView] = useState<'login' | 'register' | 'forgot' | 'reset-password'>(initialView);
  const [resetEmailTarget, setResetEmailTarget] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAuthView(initialView);
  }, [initialView]);

  const formatAuthError = (rawMsg: string): string => {
    if (!rawMsg) return t('authErrorGeneral');

    const msg = rawMsg.toLowerCase();

    // Whitelist / Authorization error
    if (msg.includes('nincs engedélyezve') || msg.includes('not authorized') || msg.includes('not allowed')) {
      return t('authErrorNotAllowed');
    }

    // Invalid credentials
    if (
      msg.includes('invalid login credentials') ||
      msg.includes('invalid credentials') ||
      msg.includes('hibás e-mail cím') ||
      msg.includes('invalid email or password')
    ) {
      return t('authErrorInvalidCredentials');
    }

    // Email not confirmed
    if (msg.includes('email not confirmed') || msg.includes('not verified')) {
      return t('authErrorEmailNotConfirmed');
    }

    // User already exists
    if (
      msg.includes('already registered') ||
      msg.includes('already exists') ||
      msg.includes('már regisztráltak')
    ) {
      return t('authErrorUserExists');
    }

    // Password weak
    if (
      msg.includes('at least 6 characters') ||
      msg.includes('too weak') ||
      msg.includes('legalább 6 karakter')
    ) {
      return t('authErrorPwdWeak');
    }

    // Rate limit
    if (msg.includes('rate limit') || msg.includes('too many requests') || msg.includes('túl sok próbálkozás')) {
      return t('authErrorRateLimit');
    }

    // Invalid token / expired link
    if (
      msg.includes('invalid link') ||
      msg.includes('token expired') ||
      msg.includes('expired') ||
      msg.includes('érvénytelen')
    ) {
      return t('authErrorInvalidToken');
    }

    // Email required
    if (msg.includes('add meg az e-mail') || msg.includes('email is required')) {
      return t('authErrorEmailRequired');
    }

    // Password required
    if (msg.includes('add meg a jelszavad') || msg.includes('password is required')) {
      return t('authErrorPwdRequired');
    }

    // Name required
    if (msg.includes('teljes neved') || msg.includes('name is required')) {
      return t('authErrorNameRequired');
    }

    // Not registered
    if (msg.includes('nincs regisztrálva') || msg.includes('not registered') || msg.includes('user not found')) {
      return t('authErrorNotRegistered');
    }

    // Passwords mismatch
    if (msg.includes('nem egyezik') || msg.includes('do not match')) {
      return t('authErrorPwdMismatch');
    }

    return rawMsg;
  };

  const handleRememberMeChange = (checked: boolean) => {
    setRememberMe(checked);
    localStorage.setItem('smartfarm_remember_me', checked ? 'true' : 'false');
    if (!checked) {
      localStorage.removeItem('smartfarm_remembered_email');
      localStorage.removeItem('smartfarm_remembered_password');
    } else {
      if (email) localStorage.setItem('smartfarm_remembered_email', email);
      if (password) localStorage.setItem('smartfarm_remembered_password', password);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    let loginEmail = email.trim();
    let loginPassword = password;

    // Save rememberMe preference & credentials
    localStorage.setItem('smartfarm_remember_me', rememberMe ? 'true' : 'false');
    if (rememberMe) {
      if (loginEmail) localStorage.setItem('smartfarm_remembered_email', loginEmail);
      if (loginPassword) localStorage.setItem('smartfarm_remembered_password', loginPassword);
    } else {
      localStorage.removeItem('smartfarm_remembered_email');
      localStorage.removeItem('smartfarm_remembered_password');
    }

    if (!loginEmail) {
      if (!isSupabaseConfigured) {
        loginEmail = 'kezelo.janos@ceg.hu';
        loginPassword = loginPassword || 'password123';
      } else {
        setError(t('authErrorEmailRequired'));
        setLoading(false);
        return;
      }
    }

    if (!loginPassword) {
      if (!isSupabaseConfigured) {
        loginPassword = 'password123';
      } else {
        setError(t('authErrorPwdRequired'));
        setLoading(false);
        return;
      }
    }

    try {
      // Check if email is in allowed whitelist
      const isAllowed = await dbService.isEmailAllowed(loginEmail);

      if (!isAllowed) {
        throw new Error(t('authErrorNotAllowed'));
      }

      if (isSupabaseConfigured) {
        const { error: authError } = await supabase!.auth.signInWithPassword({
          email: loginEmail,
          password: loginPassword,
        });

        if (authError) {
          throw new Error(authError.message);
        }

        // The auth state subscription in App.tsx will set the current user automatically.
      } else {
        // Offline / Mock Mode Login
        const savedUsersJson = localStorage.getItem('smartfarm_users');
        const savedUsers = savedUsersJson ? JSON.parse(savedUsersJson) : [];
        const localUser = savedUsers.find((u: { email: string; password?: string; id?: string; name: string; role: 'admin' | 'operator'; is_gep?: boolean }) => u.email === loginEmail && u.password === loginPassword);

        if (localUser) {
          onLogin({
            id: localUser.id || 'mock-id-' + localUser.email,
            name: localUser.name,
            email: localUser.email,
            role: localUser.role,
            is_gep: localUser.is_gep !== undefined ? localUser.is_gep : (localUser.role === 'admin'),
          });
        } else {
          // Fallback to default test accounts
          if (loginEmail === 'kovacs.gabor@ceg.hu' && loginPassword === 'password123') {
            onLogin({ id: 'admin-mock-id', name: 'Kovács Gábor', email: loginEmail, role: 'admin', is_gep: true });
          } else if (loginEmail === 'kezelo.janos@ceg.hu' && loginPassword === 'password123') {
            onLogin({ id: 'operator-mock-id', name: 'Kezelő János', email: loginEmail, role: 'operator', is_gep: false });
          } else {
            throw new Error(t('authErrorInvalidCredentials'));
          }
        }
      }
    } catch (err: unknown) {
      setError(formatAuthError((err as Error)?.message));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    if (!fullName.trim()) {
      setError(t('authErrorNameRequired'));
      setLoading(false);
      return;
    }

    try {
      const isAllowed = await dbService.isEmailAllowed(email);

      if (!isAllowed) {
        setError(t('authErrorNotAllowed'));
        setLoading(false);
        return;
      }

      // Email is approved! Complete registration
      if (isSupabaseConfigured) {
        const { data, error: authError } = await supabase!.auth.signUp({
          email,
          password,
          options: {
            data: {
              name: fullName,
              role: role,
            },
          },
        });

        if (authError) {
          throw new Error(authError.message);
        }

        if (data.user) {
          // Save a fallback profile record to the database
          try {
            await supabase!.from('profiles').insert({
              id: data.user.id,
              email: data.user.email || email,
              name: fullName,
              role: role,
            });
          } catch (err) {
            console.warn('Profile insert handled by database trigger or skipped:', err);
          }

          if (data.session) {
            onLogin({
              id: data.user.id,
              name: fullName,
              email: data.user.email || email,
              role: role,
              is_gep: false,
            });
          } else {
            setSuccessMessage(t('authSuccessRegister'));
            setAuthView('login');
            setFullName('');
            setPassword('');
          }
        }
      } else {
        // Offline / Mock Mode Registration
        const savedUsersJson = localStorage.getItem('smartfarm_users');
        const savedUsers = savedUsersJson ? JSON.parse(savedUsersJson) : [];

        if (savedUsers.some((u: { email: string }) => u.email === email)) {
          throw new Error(t('authErrorUserExists'));
        }

        const newUser = {
          id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11),
          name: fullName,
          email,
          password,
          role,
          is_gep: false, // Default newly registered operator to non-GEP
        };

        savedUsers.push(newUser);
        localStorage.setItem('smartfarm_users', JSON.stringify(savedUsers));

        setSuccessMessage(t('authSuccessRegisterDemo'));
        setAuthView('login');
        setFullName('');
        setPassword('');
      }
    } catch (err: unknown) {
      setError(formatAuthError((err as Error)?.message));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    if (!email) {
      setError(t('authErrorEmailRequired'));
      setLoading(false);
      return;
    }

    try {
      if (isSupabaseConfigured) {
        const { error: resetError } = await supabase!.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}`,
        });

        if (resetError) {
          throw new Error(resetError.message);
        }

        setSuccessMessage(t('authSuccessForgotSent'));
      } else {
        // Offline / Mock Mode Forgot Password
        const savedUsersJson = localStorage.getItem('smartfarm_users');
        const savedUsers = savedUsersJson ? JSON.parse(savedUsersJson) : [];

        // Check if user exists (either in local store or default fallback test accounts)
        const isDefaultAdmin = email === 'kovacs.gabor@ceg.hu';
        const isDefaultOperator = email === 'kezelo.janos@ceg.hu';
        const userExists = savedUsers.some((u: { email: string }) => u.email === email) || isDefaultAdmin || isDefaultOperator;

        if (!userExists) {
          throw new Error(t('authErrorNotRegistered'));
        }

        // Simulating the email redirect by transitioning directly to the reset-password view
        setResetEmailTarget(email);
        setSuccessMessage(t('authSuccessForgotDemo'));
        setPassword('');
        setConfirmPassword('');
        setAuthView('reset-password');
      }
    } catch (err: unknown) {
      setError(formatAuthError((err as Error)?.message));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    if (!password) {
      setError(t('authErrorNewPwdRequired'));
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError(t('authErrorPwdMismatch'));
      setLoading(false);
      return;
    }

    try {
      if (isSupabaseConfigured) {
        const { error: resetError } = await supabase!.auth.updateUser({
          password: password,
        });

        if (resetError) {
          throw new Error(resetError.message);
        }

        setSuccessMessage(t('authSuccessResetDone'));

        if (onPasswordResetComplete) {
          setTimeout(() => {
            onPasswordResetComplete();
          }, 3000);
        } else {
          setTimeout(() => {
            setAuthView('login');
            setSuccessMessage(null);
          }, 3000);
        }
      } else {
        // Offline / Mock Mode Reset Password
        const targetEmail = resetEmailTarget || email;
        if (!targetEmail) {
          throw new Error(t('authErrorGeneral'));
        }

        const savedUsersJson = localStorage.getItem('smartfarm_users');
        const savedUsers = savedUsersJson ? JSON.parse(savedUsersJson) : [];

        const userIndex = savedUsers.findIndex((u: { email: string }) => u.email === targetEmail);

        if (userIndex !== -1) {
          savedUsers[userIndex].password = password;
          localStorage.setItem('smartfarm_users', JSON.stringify(savedUsers));
        } else {
          // If it was one of the default mock accounts, we can create a record for it in local storage users
          const newMockUser = {
            name: targetEmail === 'kovacs.gabor@ceg.hu' ? 'Kovács Gábor' : 'Kezelő János',
            email: targetEmail,
            password: password,
            role: targetEmail === 'kovacs.gabor@ceg.hu' ? 'admin' : 'operator',
          };
          savedUsers.push(newMockUser);
          localStorage.setItem('smartfarm_users', JSON.stringify(savedUsers));
        }

        setSuccessMessage(t('authSuccessResetDemo'));

        setPassword('');
        setConfirmPassword('');
        setResetEmailTarget('');

        setTimeout(() => {
          setAuthView('login');
          setSuccessMessage(null);
        }, 2500);
      }
    } catch (err: unknown) {
      setError(formatAuthError((err as Error)?.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container" style={{ position: 'relative' }}>
      {/* Top Language Switcher */}
      <div className="login-lang-switcher">
        {(['hu', 'en', 'de'] as const).map((lang) => (
          <button
            key={lang}
            type="button"
            onClick={() => setLanguage(lang)}
            style={{
              padding: '5px 11px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: language === lang ? 700 : 500,
              backgroundColor: language === lang ? 'var(--primary)' : 'var(--bg-card)',
              color: language === lang ? '#ffffff' : 'var(--text-secondary)',
              border: '1px solid var(--border)',
              cursor: 'pointer',
              textTransform: 'uppercase',
              transition: 'all 0.2s ease',
              boxShadow: language === lang ? '0 2px 4px rgba(0,104,55,0.2)' : 'none'
            }}
          >
            {lang}
          </button>
        ))}
      </div>

      <div className="brand-header">
        <div className="brand-logo">
          <Sprout size={36} fill="#006837" strokeWidth={1.5} />
        </div>
        <h1 className="brand-name">SmartFarm</h1>
      </div>

      {authView === 'login' && (
        <div className="login-card">
          <h2 className="login-title">{t('loginCardTitle')}</h2>
          <p className="login-subtitle">{t('loginCardSubtitle')}</p>

          {error && (
            <div
              className="error-message"
              style={{
                padding: '10px 14px',
                backgroundColor: 'var(--danger-bg)',
                color: 'var(--danger)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '13px',
                marginBottom: '16px',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div
              className="success-message"
              style={{
                padding: '10px 14px',
                backgroundColor: 'var(--success-bg)',
                color: 'var(--success)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '13px',
                marginBottom: '16px',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <CheckCircle size={16} style={{ flexShrink: 0 }} />
              <span>{successMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="email">
                {t('loginLabelEmail')}
              </label>
              <div className="input-icon-wrapper">
                <Mail className="input-icon" size={18} />
                <input
                  id="email"
                  type="email"
                  className="input-with-icon"
                  placeholder={t('loginPlaceholderEmail')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">
                {t('loginLabelPwd')}
              </label>
              <div className="input-icon-wrapper">
                <Lock className="input-icon" size={18} />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className="input-with-icon input-with-icon-right"
                  placeholder={t('loginPlaceholderPwd')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="input-icon-right"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Jelszó megjelenítése"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="form-options">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  className="checkbox-input"
                  checked={rememberMe}
                  onChange={(e) => handleRememberMeChange(e.target.checked)}
                />
                {t('loginRemember')}
              </label>
              <a
                href="#forgot"
                className="forgot-password-link"
                onClick={(e) => {
                  e.preventDefault();
                  setAuthView('forgot');
                  setError(null);
                  setSuccessMessage(null);
                }}
              >
                {t('loginForgotPwdLink')}
              </a>
            </div>

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? t('loginBtnSubmitLoading') : t('loginBtnSubmit')}
            </button>

            <div className="form-divider">{t('loginOrDivider')}</div>

            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setAuthView('register');
                setError(null);
                setSuccessMessage(null);
              }}
            >
              <Building2 size={18} />
              {t('loginRegisterTitle')}
            </button>
          </form>
        </div>
      )}

      {authView === 'register' && (
        <div className="login-card">
          <h2 className="login-title">{t('loginRegisterCardTitle')}</h2>
          <p className="login-subtitle">{t('loginRegisterCardSubtitle')}</p>

          {error && (
            <div
              className="error-message"
              style={{
                padding: '10px 14px',
                backgroundColor: 'var(--danger-bg)',
                color: 'var(--danger)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '13px',
                marginBottom: '16px',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div
              className="success-message"
              style={{
                padding: '10px 14px',
                backgroundColor: 'var(--success-bg)',
                color: 'var(--success)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '13px',
                marginBottom: '16px',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <CheckCircle size={16} style={{ flexShrink: 0 }} />
              <span>{successMessage}</span>
            </div>
          )}

          <form onSubmit={handleRegister}>
            <div className="form-group">
              <label className="form-label" htmlFor="fullName">
                {t('loginLabelFullName')}
              </label>
              <div className="input-icon-wrapper">
                <User className="input-icon" size={18} />
                <input
                  id="fullName"
                  type="text"
                  required
                  className="input-with-icon"
                  placeholder={t('loginRegisterPlaceholderName')}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="email">
                {t('loginLabelEmail')}
              </label>
              <div className="input-icon-wrapper">
                <Mail className="input-icon" size={18} />
                <input
                  id="email"
                  type="email"
                  required
                  className="input-with-icon"
                  placeholder={t('loginPlaceholderEmail')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">
                {t('loginLabelPwd')}
              </label>
              <div className="input-icon-wrapper">
                <Lock className="input-icon" size={18} />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="input-with-icon input-with-icon-right"
                  placeholder={t('loginPlaceholderPwd')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="input-icon-right"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Jelszó megjelenítése"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? t('loginRegisterBtnSubmitLoading') : t('loginRegisterBtnSubmit')}
            </button>

            <div className="form-divider">{t('loginOrDivider')}</div>

            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setAuthView('login');
                setError(null);
                setSuccessMessage(null);
              }}
            >
              {t('loginForgotBackToLogin')}
            </button>
          </form>
        </div>
      )}

      {authView === 'forgot' && (
        <div className="login-card">
          <h2 className="login-title">{t('loginForgotCardTitle')}</h2>
          <p className="login-subtitle">{t('loginForgotCardSubtitle')}</p>

          {error && (
            <div
              className="error-message"
              style={{
                padding: '10px 14px',
                backgroundColor: 'var(--danger-bg)',
                color: 'var(--danger)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '13px',
                marginBottom: '16px',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div
              className="success-message"
              style={{
                padding: '10px 14px',
                backgroundColor: 'var(--success-bg)',
                color: 'var(--success)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '13px',
                marginBottom: '16px',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <CheckCircle size={16} style={{ flexShrink: 0 }} />
              <span>{successMessage}</span>
            </div>
          )}

          <form onSubmit={handleForgotPassword}>
            <div className="form-group">
              <label className="form-label" htmlFor="email">
                {t('loginLabelEmail')}
              </label>
              <div className="input-icon-wrapper">
                <Mail className="input-icon" size={18} />
                <input
                  id="email"
                  type="email"
                  required
                  className="input-with-icon"
                  placeholder={t('loginPlaceholderEmail')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? t('loginForgotBtnSubmitLoading') : t('loginForgotBtnSubmit')}
            </button>

            <div className="form-divider">{t('loginOrDivider')}</div>

            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setAuthView('login');
                setError(null);
                setSuccessMessage(null);
              }}
            >
              {t('loginForgotBackToLogin')}
            </button>
          </form>
        </div>
      )}

      {authView === 'reset-password' && (
        <div className="login-card">
          <h2 className="login-title">{t('loginResetCardTitle')}</h2>
          <p className="login-subtitle">{t('loginResetCardSubtitle')}</p>

          {error && (
            <div
              className="error-message"
              style={{
                padding: '10px 14px',
                backgroundColor: 'var(--danger-bg)',
                color: 'var(--danger)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '13px',
                marginBottom: '16px',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div
              className="success-message"
              style={{
                padding: '10px 14px',
                backgroundColor: 'var(--success-bg)',
                color: 'var(--success)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '13px',
                marginBottom: '16px',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <CheckCircle size={16} style={{ flexShrink: 0 }} />
              <span>{successMessage}</span>
            </div>
          )}

          <form onSubmit={handleResetPassword}>
            <div className="form-group">
              <label className="form-label" htmlFor="password">
                {t('loginResetLabelNewPwd')}
              </label>
              <div className="input-icon-wrapper">
                <Lock className="input-icon" size={18} />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="input-with-icon input-with-icon-right"
                  placeholder={t('loginPlaceholderPwd')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="input-icon-right"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Jelszó megjelenítése"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="confirmPassword">
                {t('loginResetLabelConfirmPwd')}
              </label>
              <div className="input-icon-wrapper">
                <Lock className="input-icon" size={18} />
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  className="input-with-icon input-with-icon-right"
                  placeholder={t('loginPlaceholderPwd')}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="input-icon-right"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label="Jelszó megerősítés megjelenítése"
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? t('loginResetBtnSubmitLoading') : t('loginResetBtnSubmit')}
            </button>

            {!isSupabaseConfigured && (
              <>
                <div className="form-divider">{t('loginOrDivider')}</div>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setAuthView('login');
                    setError(null);
                    setSuccessMessage(null);
                    setPassword('');
                    setConfirmPassword('');
                    setResetEmailTarget('');
                  }}
                >
                  {t('allowedModalBtnCancel')}
                </button>
              </>
            )}
          </form>
        </div>
      )}

      <div className="login-footer">
        <div>
          <span>SmartFarm Raktárkezelő</span>
        </div>
        <div className="login-footer-copy">© 2026 SmartFarm. Minden jog fenntartva.</div>
      </div>
    </div>
  );
};
