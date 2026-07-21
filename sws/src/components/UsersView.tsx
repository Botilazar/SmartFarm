import React, { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, ArrowUpDown, Download } from 'lucide-react';
import type { UserProfile } from '../db/dbService';
import { useTranslation } from '../context/LanguageContext';

interface UsersViewProps {
  users: UserProfile[];
  onUpdateUserRole?: (userId: string, newRole: 'admin' | 'operator') => Promise<void>;
}

export const UsersView: React.FC<UsersViewProps> = ({ users, onUpdateUserRole }) => {
  const { t } = useTranslation();
  const [sortField, setSortField] = useState<'name' | 'email' | 'role' | null>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleExportCSV = () => {
    const headers = [
      t('usrColName') || 'Név',
      t('usrColEmail') || 'Email',
      t('usrColRole') || 'Szerepkör'
    ];

    const rows = sortedUsers.map(u => [
      u.name,
      u.email,
      u.role === 'admin' ? t('usrRoleAdmin') : t('usrRoleOperator')
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
              <th>{t('statStatus')}</th>
            </tr>
          </thead>
          <tbody>
            {sortedUsers.map((u) => (
              <tr key={u.id}>
                <td style={{ fontWeight: 600 }}>{u.name}</td>
                <td>{u.email}</td>
                <td>
                  <select
                    value={u.role}
                    onChange={(e) => {
                      if (onUpdateUserRole) {
                        onUpdateUserRole(u.id, e.target.value as 'admin' | 'operator');
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
                      cursor: 'pointer',
                      outline: 'none',
                    }}
                  >
                    <option value="operator">{t('usrRoleOperator')}</option>
                    <option value="admin">{t('usrRoleAdmin')}</option>
                  </select>
                </td>
                <td><span style={{ color: 'var(--success)', fontWeight: 600 }}>{t('usrStatusActive')}</span></td>
              </tr>
            ))}
            {sortedUsers.length === 0 && (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
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
