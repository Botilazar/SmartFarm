import React, { useState } from 'react';
import { supabase, isSupabaseConfigured } from '../db/supabaseClient';
import { Camera, Save, User, RefreshCw, AlertCircle, Check } from 'lucide-react';

interface SettingsViewProps {
  isMock: boolean;
  user: { id: string; name: string; email: string; role: 'admin' | 'operator'; avatar_url?: string };
  onUserUpdate?: (updatedUser: Partial<{ id: string; name: string; email: string; role: 'admin' | 'operator'; avatar_url?: string }>) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ isMock, user, onUserUpdate }) => {
  const [name, setName] = useState(user.name);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(user.avatar_url || null);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setStatusMessage({ type: 'error', text: 'Csak képformátumú fájl tölthető fel!' });
        return;
      }
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setStatusMessage({ type: 'error', text: 'A fájl mérete nem haladhatja meg az 5MB-ot!' });
        return;
      }

      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setStatusMessage(null);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setStatusMessage({ type: 'error', text: 'A név megadása kötelező!' });
      return;
    }

    setLoading(true);
    setStatusMessage(null);

    try {
      let finalAvatarUrl = user.avatar_url || '';

      if (selectedFile) {
        if (!isMock && isSupabaseConfigured) {
          // Upload to Supabase Storage
          const fileExt = selectedFile.name.split('.').pop();
          const fileName = `${user.id}-${Date.now()}.${fileExt}`;
          const filePath = `${fileName}`;

          const { error: uploadError } = await supabase!.storage
            .from('avatars')
            .upload(filePath, selectedFile, {
              cacheControl: '3600',
              upsert: true
            });

          if (uploadError) {
            throw new Error(`Sikertelen képfeltöltés: ${uploadError.message}`);
          }

          // Get public URL
          const { data } = supabase!.storage.from('avatars').getPublicUrl(filePath);
          if (!data?.publicUrl) {
            throw new Error('Sikertelen nyilvános kép URL lekérés.');
          }
          finalAvatarUrl = data.publicUrl;
        } else {
          // Local Storage base64 mock
          await new Promise<void>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
              finalAvatarUrl = event.target?.result as string;
              resolve();
            };
            reader.onerror = () => reject(new Error('Sikertelen helyi fájlolvasás'));
            reader.readAsDataURL(selectedFile);
          });
        }
      }

      // Update database profile
      if (!isMock && isSupabaseConfigured) {
        const { error: updateError } = await supabase!
          .from('profiles')
          .update({
            name: name,
            avatar_url: finalAvatarUrl
          })
          .eq('id', user.id);

        if (updateError) {
          throw new Error(`Profil mentési hiba: ${updateError.message}`);
        }
      }

      // Update local state in React Context / App
      if (onUserUpdate) {
        onUserUpdate({
          name: name,
          avatar_url: finalAvatarUrl
        });
      }

      setStatusMessage({ type: 'success', text: 'Profil sikeresen elmentve!' });
      setSelectedFile(null);
    } catch (error: any) {
      console.error('Error saving profile:', error);
      setStatusMessage({ type: 'error', text: error.message || 'Sikertelen mentés.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="details-card" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <h2 className="details-card-title" style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <User size={22} style={{ color: 'var(--primary)' }} />
        Profil beállítások
      </h2>

      {statusMessage && (
        <div 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '10px', 
            padding: '12px 16px', 
            borderRadius: '8px', 
            marginBottom: '20px',
            fontSize: '14px',
            fontWeight: 500,
            backgroundColor: statusMessage.type === 'success' ? 'var(--primary-light)' : 'var(--danger-bg)',
            color: statusMessage.type === 'success' ? 'var(--primary)' : 'var(--danger)',
            border: `1px solid ${statusMessage.type === 'success' ? 'rgba(0, 104, 55, 0.2)' : 'rgba(235, 87, 87, 0.2)'}`
          }}
        >
          {statusMessage.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Profile Picture Section */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ position: 'relative', width: '100px', height: '100px' }}>
            <img
              src={previewUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'U')}&background=006837&color=fff&size=128`}
              alt="Profilkép"
              style={{
                width: '100px',
                height: '100px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: '3px solid var(--primary)',
                boxShadow: 'var(--shadow-sm)'
              }}
            />
            <label 
              htmlFor="avatar-upload"
              style={{
                position: 'absolute',
                bottom: '0',
                right: '0',
                backgroundColor: 'var(--primary)',
                color: 'white',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: 'var(--shadow-md)',
                transition: 'transform 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
              title="Profilkép kiválasztása"
            >
              <Camera size={16} />
              <input 
                id="avatar-upload"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
            </label>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Kattints a kamera ikonra a profilkép módosításához.
          </span>
        </div>

        {/* Inputs */}
        <div className="form-group">
          <label className="form-label" htmlFor="pName">Név</label>
          <input
            id="pName"
            type="text"
            required
            className="form-input-text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Teljes név"
          />
        </div>

        <div className="form-row" style={{ display: 'flex', gap: '16px' }}>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label" htmlFor="pEmail">Email cím (nem módosítható)</label>
            <input
              id="pEmail"
              type="email"
              disabled
              className="form-input-text"
              value={user.email}
              style={{ backgroundColor: 'var(--bg-app)', color: 'var(--text-secondary)', cursor: 'not-allowed' }}
            />
          </div>

          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label" htmlFor="pRole">Szerepkör (adminisztrációs)</label>
            <input
              id="pRole"
              type="text"
              disabled
              className="form-input-text"
              value={user.role === 'admin' ? 'Raktárvezető' : 'Raktári dolgozó'}
              style={{ backgroundColor: 'var(--bg-app)', color: 'var(--text-secondary)', cursor: 'not-allowed' }}
            />
          </div>
        </div>

        {/* Connection status display */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '8px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border)', fontSize: '13px' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Környezet:</span>
          <span 
            style={{ 
              fontSize: '12px', 
              fontWeight: 600, 
              padding: '2px 8px', 
              borderRadius: '12px', 
              backgroundColor: isMock ? 'var(--danger-bg)' : 'var(--primary-light)', 
              color: isMock ? 'var(--danger)' : 'var(--primary)' 
            }}
          >
            {isMock ? 'LocalStorage (Demó Mód)' : 'Supabase (Felhő Adatbázis)'}
          </span>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
          <button 
            type="submit" 
            className="btn-primary" 
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '140px', justifyContent: 'center' }}
          >
            {loading ? (
              <>
                <RefreshCw size={16} className="spin-animation" style={{ animation: 'spin 1s linear infinite' }} />
                <span>Mentés...</span>
              </>
            ) : (
              <>
                <Save size={16} />
                <span>Mentés</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Add CSS keyframes for rotation if not already in App.css */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
