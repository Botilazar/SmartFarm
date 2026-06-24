import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import type { Transaction } from '../db/dbService';

interface MovementsViewProps {
  transactions: Transaction[];
  isMobile?: boolean;
}

export const MovementsView: React.FC<MovementsViewProps> = ({
  transactions,
  isMobile = false
}) => {
  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h3 className="mobile-section-title">Minden mozgás</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {transactions.map((t) => (
            <div key={t.id} className="mobile-stock-card" style={{ padding: '12px' }}>
              <div className="mobile-stock-card-left">
                <div className={`movement-icon-wrapper ${t.type}`} style={{ width: '28px', height: '28px' }}>
                  {t.type === 'intake' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                </div>
                <div className="mobile-stock-info" style={{ maxWidth: '170px' }}>
                  <h4 style={{ fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.material_name}</h4>
                  <p style={{ fontSize: '10px' }}>{t.user_name} • {t.notes || 'Nincs megjegyzés'}</p>
                </div>
              </div>
              <div className="mobile-stock-card-right">
                <span className={`movement-qty ${t.type}`} style={{ fontSize: '12px' }}>
                  {t.quantity > 0 ? `+${t.quantity}` : t.quantity}
                </span>
                <span style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>
                  {new Date(t.timestamp).toLocaleDateString('hu-HU', { month: '2-digit', day: '2-digit' })} {new Date(t.timestamp).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))}
          {transactions.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
              Még nem történt készletmozgás.
            </div>
          )}
        </div>
      </div>
    );
  }

  // Desktop view
  return (
    <div className="details-card" style={{ width: '100%' }}>
      <div className="details-card-header">
        <div>
          <h2 className="details-card-title">Készletmozgások Naplója</h2>
          <p className="page-subtitle">Minden bevételezés és kiadás időrendi követése</p>
        </div>
      </div>

      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Dátum / Idő</th>
              <th>Azonosító</th>
              <th>Megnevezés</th>
              <th>Típus</th>
              <th>Mennyiség</th>
              <th>Felhasználó</th>
              <th>Megjegyzés</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => {
              const date = new Date(t.timestamp);
              const formattedDate = `${date.getFullYear()}. ${String(date.getMonth() + 1).padStart(2, '0')}. ${String(date.getDate()).padStart(2, '0')}. ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
              
              return (
                <tr key={t.id}>
                  <td style={{ color: 'var(--text-secondary)' }}>{formattedDate}</td>
                  <td><span className="material-id-badge">{t.material_id}</span></td>
                  <td style={{ fontWeight: 600 }}>{t.material_name}</td>
                  <td>
                    <span 
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                        backgroundColor: t.type === 'intake' ? 'var(--primary-light)' : 'var(--danger-bg)',
                        color: t.type === 'intake' ? 'var(--primary)' : 'var(--danger)'
                      }}
                    >
                      {t.type === 'intake' ? 'Bevétel' : 'Kivétel'}
                    </span>
                  </td>
                  <td style={{ fontWeight: 700, color: t.type === 'intake' ? 'var(--success)' : 'var(--danger)' }}>
                    {t.quantity > 0 ? `+${t.quantity}` : t.quantity}
                  </td>
                  <td>{t.user_name}</td>
                  <td style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>{t.notes || '—'}</td>
                </tr>
              );
            })}
            {transactions.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
                  Még nem történt készletmozgás.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
