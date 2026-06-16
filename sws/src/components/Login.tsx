import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, Building2, Sprout } from 'lucide-react';

interface LoginProps {
  onLogin: (user: { name: string; email: string; role: 'admin' | 'operator' }) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('peldavezető@ceg.hu');
  const [password, setPassword] = useState('password123');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<'admin' | 'operator'>('admin');
  const [rememberMe, setRememberMe] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In mock/demo mode we log in based on chosen email/role
    const name = role === 'admin' ? 'Kovács Gábor' : 'Kezelő János';
    const emailAddr = role === 'admin' ? 'kovacs.gabor@ceg.hu' : 'kezelo.janos@ceg.hu';
    onLogin({ name, email: emailAddr, role });
  };

  return (
    <div className="login-container">
      <div className="brand-header">
        <div className="brand-logo">
          <Sprout size={36} fill="#006837" strokeWidth={1.5} />
        </div>
        <h1 className="brand-name">SmartFarm</h1>
      </div>

      <div className="login-card">
        <h2 className="login-title">Bejelentkezés</h2>
        <p className="login-subtitle">Lépj be a SmartFarm raktárkezelő rendszerébe</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label className="form-label">Teszt Szerepkör (Gyors bejelentkezés)</label>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
              <button
                type="button"
                className={`btn-secondary`}
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
                }}
              >
                Raktárvezető (Admin)
              </button>
              <button
                type="button"
                className={`btn-secondary`}
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
                }}
              >
                Kezelő (Munkatárs)
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="email">Email cím</label>
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
            <label className="form-label" htmlFor="password">Jelszó</label>
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
            <a href="#forgot" className="forgot-password-link" onClick={(e) => e.preventDefault()}>
              Elfelejtett jelszó?
            </a>
          </div>

          <button type="submit" className="btn-primary">
            Belépés
          </button>

          <div className="form-divider">vagy</div>

          <button
            type="button"
            className="btn-secondary"
            onClick={() => onLogin({ name: 'Regisztrált Felhasználó', email: 'uj.user@ceg.hu', role: 'operator' })}
          >
            <Building2 size={18} />
            Regisztráció
          </button>
        </form>
      </div>

      <div className="login-footer">
        <div>
          <span>SmartFarm Raktárkezelő</span>
          <span className="login-footer-bullet">•</span>
          <span>Biztonságos belső rendszer</span>
        </div>
        <div className="login-footer-copy">
          © 2026 SmartFarm. Minden jog fenntartva.
        </div>
      </div>
    </div>
  );
};
