import { useState, useEffect } from 'react';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import './App.css';

interface UserSession {
  name: string;
  email: string;
  role: 'admin' | 'operator';
}

function App() {
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  // Check session on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('smartfarm_current_user');
    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch (err) {
        console.error('Failed to parse saved user session', err);
        localStorage.removeItem('smartfarm_current_user');
      }
    }
    setCheckingSession(false);
  }, []);

  const handleLogin = (user: UserSession) => {
    setCurrentUser(user);
    localStorage.setItem('smartfarm_current_user', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('smartfarm_current_user');
  };

  if (checkingSession) {
    return (
      <div 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          height: '100vh', 
          backgroundColor: '#f4f7f6',
          fontSize: '14px',
          fontWeight: 500,
          color: '#006837'
        }}
      >
        Töltés...
      </div>
    );
  }

  return (
    <>
      {currentUser === null ? (
        <Login onLogin={handleLogin} />
      ) : (
        <Dashboard user={currentUser} onLogout={handleLogout} />
      )}
    </>
  );
}

export default App;
