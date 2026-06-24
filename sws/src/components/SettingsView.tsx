import React from 'react';
import { RefreshCw } from 'lucide-react';

interface SettingsViewProps {
  isMock: boolean;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ isMock }) => {
  return (
    <div className="details-card" style={{ maxWidth: '600px' }}>
      <h2 className="details-card-title" style={{ marginBottom: '16px' }}>Rendszerbeállítások</h2>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', padding: '10px 14px', borderRadius: '8px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border)' }}>
        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Aktív adatbázis kapcsolat:</span>
        <span 
          style={{ 
            fontSize: '12px', 
            fontWeight: 600, 
            padding: '4px 10px', 
            borderRadius: '12px', 
            backgroundColor: isMock ? 'var(--danger-bg)' : 'var(--primary-light)', 
            color: isMock ? 'var(--danger)' : 'var(--primary)' 
          }}
        >
          {isMock ? 'LocalStorage (Demó Mód)' : 'Supabase (Felhő Adatbázis)'}
        </span>
      </div>

      <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>Supabase Csatlakozás (Környezeti változók helyett)</h3>
      
      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
        Ha a Supabase-t szeretnéd használni a helyi böngészőtárhely helyett, kérünk hozd létre a <code>.env.local</code> fájlt a projekt főkönyvtárában a következő kulcsokkal:
      </p>

      <div style={{ backgroundColor: '#1e293b', color: 'white', padding: '16px', borderRadius: '8px', fontFamily: 'monospace', fontSize: '13px', marginBottom: '20px' }}>
        <div>VITE_SUPABASE_URL=https://sajat-projekt-azonosito.supabase.co</div>
        <div>VITE_SUPABASE_ANON_KEY=sajat-anon-kulcs</div>
      </div>

      <div style={{ display: 'flex', gap: '10px' }}>
        <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
          <RefreshCw size={16} style={{ marginRight: '6px' }} />
          Rendszer Újratöltése
        </button>
      </div>
    </div>
  );
};
