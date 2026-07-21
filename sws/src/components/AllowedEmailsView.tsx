import React, { useState, useMemo, useEffect } from 'react';
import {
  Search, ShieldCheck, CheckCircle2, Trash2, Plus, Download, Mail, User, AlertCircle, X
} from 'lucide-react';
import { dbService } from '../db/dbService';
import type { AllowedEmail } from '../db/dbService';
import { useTranslation } from '../context/LanguageContext';

interface AllowedEmailsViewProps {
  currentUserEmail?: string;
  onEmailsUpdated?: () => void;
}

export const AllowedEmailsView: React.FC<AllowedEmailsViewProps> = ({ currentUserEmail, onEmailsUpdated }) => {
  const { t, language } = useTranslation();
  const [emails, setEmails] = useState<AllowedEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal state for adding a new allowed email
  const [showAddModal, setShowAddModal] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [addName, setAddName] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [addLoading, setAddLoading] = useState(false);

  // Load allowed emails
  const loadEmails = async () => {
    setLoading(true);
    try {
      const data = await dbService.getAllowedEmails();
      setEmails(data);
    } catch (err) {
      console.error('Failed to load allowed emails:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmails();
  }, []);

  const handleDelete = async (item: AllowedEmail) => {
    if (currentUserEmail && item.email.toLowerCase() === currentUserEmail.toLowerCase()) {
      alert('Saját fiókod regisztrációs engedélyét biztonsági okokból nem vonhatod vissza!');
      return;
    }

    if (window.confirm(`Biztosan vissza szeretnéd vonni a(z) ${item.email} regisztrációs engedélyét?`)) {
      try {
        await dbService.deleteAllowedEmail(item.id);
        await loadEmails();
        if (onEmailsUpdated) onEmailsUpdated();
      } catch (err) {
        console.error('Failed to delete allowed email:', err);
      }
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);

    if (!addEmail.trim()) {
      setAddError('Kérjük, add meg az e-mail címet!');
      return;
    }

    setAddLoading(true);
    try {
      await dbService.addAllowedEmail(addEmail.trim(), addName.trim() || undefined);
      setAddEmail('');
      setAddName('');
      setShowAddModal(false);
      await loadEmails();
      if (onEmailsUpdated) onEmailsUpdated();
    } catch (err: any) {
      setAddError(err.message || 'Hiba történt az e-mail engedélyezése során.');
    } finally {
      setAddLoading(false);
    }
  };

  const filteredEmails = useMemo(() => {
    return emails.filter(item => {
      return (
        (item.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.email.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
  }, [emails, searchQuery]);

  const handleExportCSV = () => {
    const headers = ['Email', 'Név / Megjegyzés', 'Engedélyezés dátuma'];
    const rows = filteredEmails.map(item => [
      item.email,
      item.name || '',
      new Date(item.created_at).toLocaleString('hu-HU')
    ]);

    const csvContent = "\uFEFF" + [
      headers.join(';'),
      ...rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(';'))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `smartfarm_engedelyezett_emailek_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatDate = (isoStr: string) => {
    const d = new Date(isoStr);
    return d.toLocaleString(language === 'hu' ? 'hu-HU' : language === 'de' ? 'de-DE' : 'en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Header Card */}
      <div className="details-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <ShieldCheck size={26} color="var(--primary)" />
              <h2 className="details-card-title" style={{ margin: 0 }}>Engedélyezett e-mailek</h2>
            </div>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
              A raktári alkalmazásba regisztrálásra és belépésre jogosult e-mail címek (Raktárvezetői felület).
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleExportCSV}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', fontSize: '13px', height: '38px', width: 'auto' }}
            >
              <Download size={15} />
              <span>CSV Export</span>
            </button>

            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setAddError(null);
                setShowAddModal(true);
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '13px', height: '38px', width: 'auto' }}
            >
              <Plus size={16} />
              <span>Új e-mail engedélyezése</span>
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', flexWrap: 'wrap', gap: '14px' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>
            Összesen <strong>{filteredEmails.length}</strong> engedélyezett e-mail cím
          </div>

          <div className="search-bar-wrapper" style={{ maxWidth: '280px', margin: 0 }}>
            <Search className="input-icon" size={18} />
            <input
              type="text"
              placeholder="Keresés név vagy e-mail..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="details-card" style={{ padding: '0', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            Töltés...
          </div>
        ) : (
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>NÉV / MEGJEGYZÉS</th>
                  <th>ENGEDÉLYEZETT EMAIL CÍM</th>
                  <th>ENGEDÉLYEZVE DÁTUM</th>
                  <th>STÁTUSZ</th>
                  <th style={{ textAlign: 'right' }}>MŰVELETEK</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmails.map((item) => {
                  const isSelf = currentUserEmail && item.email.toLowerCase() === currentUserEmail.toLowerCase();
                  return (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 600 }}>
                        {item.name || 'Engedélyezett Felhasználó'}
                        {isSelf && (
                          <span style={{ fontSize: '11px', color: 'var(--primary)', marginLeft: '8px', fontWeight: 500 }}>
                            (Saját fiók)
                          </span>
                        )}
                      </td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <Mail size={14} style={{ color: 'var(--text-secondary)' }} />
                          {item.email}
                        </span>
                      </td>
                      <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                        {formatDate(item.created_at)}
                      </td>
                      <td>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 10px',
                            borderRadius: '12px',
                            backgroundColor: 'var(--success-bg)',
                            color: 'var(--success)',
                            fontSize: '12px',
                            fontWeight: 600
                          }}
                        >
                          <CheckCircle2 size={12} />
                          Engedélyezve
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          disabled={isSelf}
                          onClick={() => !isSelf && handleDelete(item)}
                          title={isSelf ? 'Saját fiókod regisztrációs engedélyét biztonsági okokból nem vonhatod vissza' : 'Engedély visszavonása'}
                          style={{
                            padding: '6px 12px',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border)',
                            backgroundColor: 'transparent',
                            color: isSelf ? 'var(--text-secondary)' : 'var(--danger)',
                            opacity: isSelf ? 0.5 : 1,
                            fontSize: '12px',
                            fontWeight: 500,
                            cursor: isSelf ? 'not-allowed' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <Trash2 size={14} />
                          <span>Visszavonás</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {filteredEmails.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-secondary)' }}>
                      Nincs megjeleníthető engedélyezett e-mail cím a megadott keresési feltételek alapján.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manual Add Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={20} style={{ color: 'var(--primary)' }} />
                <span>Új e-mail engedélyezése</span>
              </div>
              <button onClick={() => setShowAddModal(false)} type="button" aria-label="Bezárás">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddSubmit}>
              <div className="modal-body">
                <p style={{ marginTop: 0, marginBottom: '16px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Add meg a felvenni kívánt e-mail címet! A felhasználó ezzel az e-mail címmel tud majd regisztrálni és belépni a SmartFarm alkalmazásba.
                </p>

                {addError && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 12px',
                      backgroundColor: 'var(--danger-bg)',
                      color: 'var(--danger)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '13px',
                      marginBottom: '16px'
                    }}
                  >
                    <AlertCircle size={16} style={{ flexShrink: 0 }} />
                    <span>{addError}</span>
                  </div>
                )}

                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label">E-mail cím *</label>
                  <div className="input-icon-wrapper">
                    <Mail className="input-icon" size={18} />
                    <input
                      type="email"
                      required
                      className="input-with-icon"
                      placeholder="dolgozo@ceg.hu"
                      value={addEmail}
                      onChange={(e) => setAddEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '0' }}>
                  <label className="form-label">Név / Megjegyzés (Opcionális)</label>
                  <div className="input-icon-wrapper">
                    <User className="input-icon" size={18} />
                    <input
                      type="text"
                      className="input-with-icon"
                      placeholder="pl. Nagy Péter (Gépkezelő)"
                      value={addName}
                      onChange={(e) => setAddName(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowAddModal(false)}
                >
                  Mégse
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={addLoading}
                >
                  {addLoading ? 'Hozzáadás...' : 'Engedélyezés'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

