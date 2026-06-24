import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, Building2, Sprout, User, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../db/supabaseClient';

interface LoginProps {
  onLogin: (user: { name: string; email: string; role: 'admin' | 'operator' }) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('kovacs.gabor@ceg.hu');
  const [password, setPassword] = useState('password123');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<'admin' | 'operator'>('admin');
  const [rememberMe, setRememberMe] = useState(true);

  // New state variables for registration and state management
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      if (isSupabaseConfigured) {
        const { error: authError } = await supabase!.auth.signInWithPassword({
          email,
          password,
        });

        if (authError) {
          throw new Error(
            authError.message === 'Invalid login credentials'
              ? 'Hibás e-mail cím vagy jelszó.'
              : authError.message
          );
        }

        // The auth state subscription in App.tsx will set the current user automatically.
      } else {
        // Offline / Mock Mode Login
        const savedUsersJson = localStorage.getItem('smartfarm_users');
        const savedUsers = savedUsersJson ? JSON.parse(savedUsersJson) : [];
        const localUser = savedUsers.find((u: any) => u.email === email && u.password === password);

        if (localUser) {
          onLogin({
            name: localUser.name,
            email: localUser.email,
            role: localUser.role,
          });
        } else {
          // Fallback to default test accounts
          if (email === 'kovacs.gabor@ceg.hu' && password === 'password123') {
            onLogin({ name: 'Kovács Gábor', email, role: 'admin' });
          } else if (email === 'kezelo.janos@ceg.hu' && password === 'password123') {
            onLogin({ name: 'Kezelő János', email, role: 'operator' });
          } else {
            throw new Error(
              'Hibás e-mail cím vagy jelszó. Offline módban használd a teszt fiókokat vagy regisztrálj újat!'
            );
          }
        }
      }
    } catch (err: any) {
      setError(err.message || 'Hiba történt a bejelentkezés során.');
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
      setError('Kérjük, add meg a teljes nevedet!');
      setLoading(false);
      return;
    }

    try {
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
              name: fullName,
              email: data.user.email || email,
              role: role,
            });
          } else {
            setSuccessMessage(
              'Sikeres regisztráció! Kérjük, ellenőrizd az e-mail fiókodat a megerősítő linkért.'
            );
            setIsRegisterMode(false);
            setFullName('');
            setPassword('');
          }
        }
      } else {
        // Offline / Mock Mode Registration
        const savedUsersJson = localStorage.getItem('smartfarm_users');
        const savedUsers = savedUsersJson ? JSON.parse(savedUsersJson) : [];

        if (savedUsers.some((u: any) => u.email === email)) {
          throw new Error('Ezzel az e-mail címmel már regisztráltak!');
        }

        const newUser = {
          name: fullName,
          email,
          password,
          role,
        };

        savedUsers.push(newUser);
        localStorage.setItem('smartfarm_users', JSON.stringify(savedUsers));

        setSuccessMessage('Sikeres regisztráció offline módban! Most már bejelentkezhetsz.');
        setIsRegisterMode(false);
        setFullName('');
        setPassword('');
      }
    } catch (err: any) {
      setError(err.message || 'Hiba történt a regisztráció során.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="brand-header">
        <div className="brand-logo">
          <Sprout size={36} fill="#006837" strokeWidth={1.5} />
        </div>
        <h1 className="brand-name">SmartFarm</h1>
      </div>

      {!isRegisterMode ? (
        <div className="login-card">
          <h2 className="login-title">Bejelentkezés</h2>
          <p className="login-subtitle">Lépj be a SmartFarm raktárkezelő rendszerébe</p>

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
            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label className="form-label">Teszt Szerepkör (Gyors kitöltés)</label>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{
                    flex: 1,
                    backgroundColor: role === 'admin' ? '#e6f3ec' : 'transparent',
                    borderColor: '#006837',
                    color: '#006837',
                    fontWeight: role === 'admin' ? '700' : '500',
                  }}
                  onClick={() => {
                    setRole('admin');
                    setEmail('kovacs.gabor@ceg.hu');
                    setPassword('password123');
                  }}
                >
                  Raktárvezető (Admin)
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{
                    flex: 1,
                    backgroundColor: role === 'operator' ? '#e6f3ec' : 'transparent',
                    borderColor: '#006837',
                    color: '#006837',
                    fontWeight: role === 'operator' ? '700' : '500',
                  }}
                  onClick={() => {
                    setRole('operator');
                    setEmail('kezelo.janos@ceg.hu');
                    setPassword('password123');
                  }}
                >
                  Kezelő (Munkatárs)
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="email">
                Email cím
              </label>
              <div className="input-icon-wrapper">
                <Mail className="input-icon" size={18} />
                <input
                  id="email"
                  type="email"
                  required
                  className="input-with-icon"
                  placeholder="példa@ceg.hu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">
                Jelszó
              </label>
              <div className="input-icon-wrapper">
                <Lock className="input-icon" size={18} />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="input-with-icon input-with-icon-right"
                  placeholder="••••••••••••"
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
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                Emlékezz rám
              </label>
              <a
                href="#forgot"
                className="forgot-password-link"
                onClick={(e) => e.preventDefault()}
              >
                Elfelejtett jelszó?
              </a>
            </div>

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Belépés...' : 'Belépés'}
            </button>

            <div className="form-divider">vagy</div>

            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setIsRegisterMode(true);
                setError(null);
                setSuccessMessage(null);
              }}
            >
              <Building2 size={18} />
              Regisztráció
            </button>
          </form>
        </div>
      ) : (
        <div className="login-card">
          <h2 className="login-title">Regisztráció</h2>
          <p className="login-subtitle">Hozz létre egy új SmartFarm fiókot</p>

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

          <form onSubmit={handleRegister}>
            <div className="form-group">
              <label className="form-label" htmlFor="fullName">
                Teljes név
              </label>
              <div className="input-icon-wrapper">
                <User className="input-icon" size={18} />
                <input
                  id="fullName"
                  type="text"
                  required
                  className="input-with-icon"
                  placeholder="Kovács Gábor"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="email">
                Email cím
              </label>
              <div className="input-icon-wrapper">
                <Mail className="input-icon" size={18} />
                <input
                  id="email"
                  type="email"
                  required
                  className="input-with-icon"
                  placeholder="példa@ceg.hu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">
                Jelszó
              </label>
              <div className="input-icon-wrapper">
                <Lock className="input-icon" size={18} />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="input-with-icon input-with-icon-right"
                  placeholder="••••••••••••"
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

            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label className="form-label">Szerepkör</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{
                    flex: 1,
                    backgroundColor: role === 'admin' ? '#e6f3ec' : 'transparent',
                    borderColor: '#006837',
                    color: '#006837',
                    fontWeight: role === 'admin' ? '700' : '500',
                  }}
                  onClick={() => setRole('admin')}
                >
                  Raktárvezető (Admin)
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{
                    flex: 1,
                    backgroundColor: role === 'operator' ? '#e6f3ec' : 'transparent',
                    borderColor: '#006837',
                    color: '#006837',
                    fontWeight: role === 'operator' ? '700' : '500',
                  }}
                  onClick={() => setRole('operator')}
                >
                  Kezelő (Munkatárs)
                </button>
              </div>
            </div>

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Fiók létrehozása...' : 'Regisztráció'}
            </button>

            <div className="form-divider">vagy</div>

            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setIsRegisterMode(false);
                setError(null);
                setSuccessMessage(null);
              }}
            >
              Vissza a bejelentkezéshez
            </button>
          </form>
        </div>
      )}

      <div className="login-footer">
        <div>
          <span>SmartFarm Raktárkezelő</span>
          <span className="login-footer-bullet">•</span>
          <span>Biztonságos belső rendszer</span>
        </div>
        <div className="login-footer-copy">© 2026 SmartFarm. Minden jog fenntartva.</div>
      </div>
    </div>
  );
};

