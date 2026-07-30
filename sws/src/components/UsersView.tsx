import React, { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, ArrowUpDown, Download } from 'lucide-react';
import type { UserProfile } from '../db/dbService';
import { useTranslation } from '../context/LanguageContext';

interface UsersViewProps {
  users: UserProfile[];
  currentUserEmail?: string;
  onUpdateUserProfile?: (userId: string, updates: Partial<UserProfile>) => Promise<void>;
}

export const UsersView: React.FC<UsersViewProps> = ({ users, currentUserEmail, onUpdateUserProfile }) => {
  const { t } = useTranslation();
  const [sortField, setSortField] = useState<'name' | 'email' | 'role' | null>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleExportCSV = () => {
    const headers = [
      t('usrColName') || 'Név',
      t('usrColEmail') || 'Email',
      t('usrColRole') || 'Szerepkör',
      'GEP'
    ];

    const rows = sortedUsers.map(u => [
      u.name,
      u.email,
      u.role === 'admin' ? t('usrRoleAdmin') : t('usrRoleOperator'),
      u.is_gep ? 'Igen' : 'Nem'
    ]);

    const csvContent = "\uFEFF" + [
      headers.join(';'),
      ...rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(';'))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `smartfarm_felhasznalok_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSort = (field: 'name' | 'email' | 'role') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const renderSortIcon = (field: 'name' | 'email' | 'role') => {
    if (sortField !== field) {
      return <ArrowUpDown size={12} style={{ opacity: 0.4, marginLeft: '6px' }} />;
    }
    return sortDirection === 'asc' ? (
      <ChevronUp size={12} style={{ color: 'var(--primary)', marginLeft: '6px' }} />
    ) : (
      <ChevronDown size={12} style={{ color: 'var(--primary)', marginLeft: '6px' }} />
    );
  };

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const sortedUsers = useMemo(() => {
    if (!sortField) return users;
    return [...users].sort((a, b) => {
      let valA = '';
      let valB = '';
      if (sortField === 'name') {
        valA = a.name || '';
        valB = b.name || '';
      } else if (sortField === 'email') {
        valA = a.email || '';
        valB = b.email || '';
      } else if (sortField === 'role') {
        valA = a.role || '';
        valB = b.role || '';
      }
      
      const strA = valA.toLowerCase();
      const strB = valB.toLowerCase();
      if (strA < strB) return sortDirection === 'asc' ? -1 : 1;
      if (strA > strB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [users, sortField, sortDirection]);

  return (
    <div className="details-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 className="details-card-title" style={{ margin: 0 }}>{t('usrTitle')}</h2>
        <button
          type="button"
          className="btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', width: 'auto', height: '32px', fontSize: '12px' }}
          onClick={handleExportCSV}
        >
          <Download size={14} />
          <span>{t('btnExportCSV')}</span>
        </button>
      </div>
      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th className="sortable" onClick={() => handleSort('name')}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {t('usrColName')}
                  {renderSortIcon('name')}
                </div>
              </th>
              <th className="sortable" onClick={() => handleSort('email')}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {t('usrColEmail')}
                  {renderSortIcon('email')}
                </div>
              </th>
              <th className="sortable" onClick={() => handleSort('role')}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {t('usrColRole')}
                  {renderSortIcon('role')}
                </div>
              </th>
              <th>GEP</th>
              <th>{t('statStatus')}</th>
            </tr>
          </thead>
          <tbody>
            {sortedUsers.map((u) => {
              const isSelf = Boolean(currentUserEmail && u.email?.toLowerCase() === currentUserEmail.toLowerCase());
              return (
                <tr key={u.id}>
                  <td style={{ fontWeight: 600 }}>
                    {u.name}
                    {isSelf && (
                      <span style={{ fontSize: '11px', color: 'var(--primary)', marginLeft: '8px', fontWeight: 500 }}>
                        (Saját fiók)
                      </span>
                    )}
                  </td>
                  <td>{u.email}</td>
                  <td>
                    <select
                      value={u.role}
                      disabled={isSelf}
                      title={isSelf ? 'Saját jogosultságodat biztonsági okokból nem módosíthatod' : undefined}
                      onChange={(e) => {
                        if (onUpdateUserProfile && !isSelf) {
                          onUpdateUserProfile(u.id, { role: e.target.value as 'admin' | 'operator' });
                        }
                      }}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border)',
                        fontSize: '13px',
                        backgroundColor: 'transparent',
                        fontWeight: u.role === 'admin' ? '600' : 'normal',
                        color: u.role === 'admin' ? 'var(--primary)' : 'var(--text-primary)',
                        cursor: isSelf ? 'not-allowed' : 'pointer',
                        opacity: isSelf ? 0.6 : 1,
                        outline: 'none',
                      }}
                    >
                      <option value="operator">{t('usrRoleOperator')}</option>
                      <option value="admin">{t('usrRoleAdmin')}</option>
                    </select>
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={!!u.is_gep}
                      disabled={false}
                      onChange={(e) => {
                        if (onUpdateUserProfile) {
                          onUpdateUserProfile(u.id, { is_gep: e.target.checked });
                        }
                      }}
                      style={{
                        width: '16px',
                        height: '16px',
                        cursor: 'pointer',
                        opacity: 1,
                        accentColor: 'var(--primary)',
                      }}
                    />
                  </td>
                  <td><span style={{ color: 'var(--success)', fontWeight: 600 }}>{t('usrStatusActive')}</span></td>
                </tr>
              );
            })}
            {sortedUsers.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
                  {t('usrNoUsers')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
