import { useState, useEffect } from 'react';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { supabase, isSupabaseConfigured } from './db/supabaseClient';
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

  // Fetch user profile details from profiles table, falling back to user metadata
  const fetchUserProfile = async (supabaseUser: any): Promise<UserSession> => {
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
          email: supabaseUser.email || '',
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
      email: supabaseUser.email || '',
      role: metadataRole === 'admin' ? 'admin' : 'operator'
    };
  };

  // Check session on mount and subscribe to auth changes
  useEffect(() => {
    if (!isSupabaseConfigured) {
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
      localStorage.setItem('smartfarm_current_user', JSON.stringify(user));
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
        <Dashboard user={currentUser} onLogout={handleLogout} onUserUpdate={handleUserUpdate} />
      )}
    </>
  );
}

export default App;
