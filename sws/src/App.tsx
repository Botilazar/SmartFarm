import { useState, useEffect } from 'react';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { supabase, isSupabaseConfigured } from './db/supabaseClient';
import { dbService } from './db/dbService';
import './App.css';

interface UserSession {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'operator';
  avatar_url?: string;
}

function App() {
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [isRecoveringPassword, setIsRecoveringPassword] = useState(false);

  // Fetch user profile details from profiles table, falling back to user metadata
  const fetchUserProfile = async (supabaseUser: any): Promise<UserSession | null> => {
    const email = supabaseUser.email || '';
    
    // Check if email access is allowed
    if (email) {
      const isAllowed = await dbService.isEmailAllowed(email);
      if (!isAllowed) {
        console.warn(`User ${email} access is not allowed. Signing out.`);
        await supabase!.auth.signOut();
        return null;
      }
    }

    const metadataName = supabaseUser.user_metadata?.name || 'Új Felhasználó';
    const metadataRole = supabaseUser.user_metadata?.role || 'operator';
    
    try {
      const { data, error } = await supabase!
        .from('profiles')
        .select('name, role, avatar_url')
        .eq('id', supabaseUser.id)
        .maybeSingle();
        
      if (!error && data) {
        return {
          id: supabaseUser.id,
          name: data.name || metadataName,
          email: email,
          role: data.role === 'admin' ? 'admin' : 'operator',
          avatar_url: data.avatar_url || undefined
        };
      }
    } catch (err) {
      console.error('Failed to fetch profile from database:', err);
    }
    
    return {
      id: supabaseUser.id,
      name: metadataName,
      email: email,
      role: metadataRole === 'admin' ? 'admin' : 'operator'
    };
  };

  // Check session on mount and subscribe to auth changes
  useEffect(() => {
    // Check if the URL is a password recovery link
    if (window.location.hash.includes('type=recovery') || window.location.href.includes('type=recovery')) {
      setIsRecoveringPassword(true);
    }

    if (!isSupabaseConfigured) {
      const savedUser = localStorage.getItem('smartfarm_current_user') || sessionStorage.getItem('smartfarm_current_user');
      if (savedUser) {
        try {
          const parsed = JSON.parse(savedUser);
          dbService.isEmailAllowed(parsed.email).then((isAllowed) => {
            if (isAllowed) {
              setCurrentUser(parsed);
            } else {
              localStorage.removeItem('smartfarm_current_user');
              sessionStorage.removeItem('smartfarm_current_user');
              setCurrentUser(null);
            }
          });
        } catch (err) {
          console.error('Failed to parse saved user session', err);
          localStorage.removeItem('smartfarm_current_user');
          sessionStorage.removeItem('smartfarm_current_user');
        }
      }
      setCheckingSession(false);
      return;
    }

    let mounted = true;

    const checkSessionAndFetchProfile = async () => {
      try {
        const { data: { session } } = await supabase!.auth.getSession();
        if (session && session.user && mounted) {
          const userSession = await fetchUserProfile(session.user);
          setCurrentUser(userSession);
        } else if (mounted) {
          setCurrentUser(null);
        }
      } catch (err) {
        console.error('Error checking session:', err);
      } finally {
        if (mounted) setCheckingSession(false);
      }
    };

    checkSessionAndFetchProfile();

    const { data: { subscription } } = supabase!.auth.onAuthStateChange(async (event, session) => {
      console.log('Supabase Auth Event:', event);
      if (event === 'PASSWORD_RECOVERY' && mounted) {
        setIsRecoveringPassword(true);
      }
      if (session && session.user && mounted) {
        const userSession = await fetchUserProfile(session.user);
        setCurrentUser(userSession);
      } else if (mounted) {
        setCurrentUser(null);
      }
      if (mounted) setCheckingSession(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleUserUpdate = (updatedUser: Partial<UserSession>) => {
    if (currentUser) {
      const newUser = { ...currentUser, ...updatedUser };
      setCurrentUser(newUser);
      if (!isSupabaseConfigured) {
        localStorage.setItem('smartfarm_current_user', JSON.stringify(newUser));
      }
    }
  };

  const handleLogin = (user: UserSession) => {
    setCurrentUser(user);
    if (!isSupabaseConfigured) {
      const remember = localStorage.getItem('smartfarm_remember_me') !== 'false';
      if (remember) {
        localStorage.setItem('smartfarm_current_user', JSON.stringify(user));
        sessionStorage.removeItem('smartfarm_current_user');
      } else {
        sessionStorage.setItem('smartfarm_current_user', JSON.stringify(user));
        localStorage.removeItem('smartfarm_current_user');
      }
    }
  };

  const handleLogout = async () => {
    if (isSupabaseConfigured) {
      try {
        await supabase!.auth.signOut();
      } catch (err) {
        console.error('Error signing out:', err);
      }
    }
    setCurrentUser(null);
    localStorage.removeItem('smartfarm_current_user');
    sessionStorage.removeItem('smartfarm_current_user');
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
      {isRecoveringPassword ? (
        <Login 
          onLogin={handleLogin} 
          initialView="reset-password"
          onPasswordResetComplete={async () => {
            setIsRecoveringPassword(false);
            if (isSupabaseConfigured) {
              await supabase!.auth.signOut();
            }
            setCurrentUser(null);
            localStorage.removeItem('smartfarm_current_user');
            sessionStorage.removeItem('smartfarm_current_user');
            
            // Clean up the URL hash so page refreshes don't re-trigger recovery mode
            if (window.location.hash) {
              window.history.replaceState(null, '', window.location.pathname + window.location.search);
            }
          }}
        />
      ) : currentUser === null ? (
        <Login onLogin={handleLogin} />
      ) : (
        <Dashboard user={currentUser} onLogout={handleLogout} onUserUpdate={handleUserUpdate} />
      )}
    </>
  );
}

export default App;
