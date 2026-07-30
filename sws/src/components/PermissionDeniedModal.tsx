import React from 'react';
import { X, ShieldAlert } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';

interface PermissionDeniedModalProps {
  materialName: string;
  materialId: string;
  onClose: () => void;
}

export const PermissionDeniedModal: React.FC<PermissionDeniedModalProps> = ({
  materialName,
  materialId,
  onClose
}) => {
  const { t } = useTranslation();

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div className="modal-card" style={{ maxWidth: '400px' }}>
        <div className="modal-header" style={{ borderColor: 'var(--danger-bg)' }}>
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--danger)' }}>
            <ShieldAlert size={20} />
            <span>{t('matGepNoPermissionTitle') || 'Nincs jogosultság'}</span>
          </div>
          <button onClick={onClose} aria-label={t('qrClose') || 'Bezárás'}>
            <X size={20} />
          </button>
        </div>
        
        <div className="modal-body" style={{ padding: '20px 24px' }}>
          <p style={{ fontSize: '14px', lineHeight: 1.5, color: 'var(--text-primary)' }}>
            {(t('matGepNoPermissionBody') || 'A(z) "{name}" ({id}) termék GEP-es és nincs jogosultságod hozzá!')
              .replace('{name}', materialName)
              .replace('{id}', materialId)}
          </p>
        </div>

        <div className="modal-footer" style={{ justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn-primary"
            style={{
              backgroundColor: 'var(--danger)',
              borderColor: 'var(--danger)',
              color: 'white',
              width: 'auto',
              paddingInline: '24px'
            }}
            onClick={onClose}
          >
            {t('ok') || 'Rendben'}
          </button>
        </div>
      </div>
    </div>
  );
};
