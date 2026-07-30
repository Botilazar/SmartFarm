import React from 'react';
import { X, ArchiveRestore, AlertCircle } from 'lucide-react';
import { dbService } from '../db/dbService';
import type { Material } from '../db/dbService';
import { useTranslation } from '../context/LanguageContext';

interface RestoreConfirmModalProps {
  material: Material;
  onClose: () => void;
  onRestoreSuccess: () => void;
}

export const RestoreConfirmModal: React.FC<RestoreConfirmModalProps> = ({
  material,
  onClose,
  onRestoreSuccess
}) => {
  const { t } = useTranslation();

  const handleRestore = async () => {
    try {
      await dbService.updateMaterial(material.id, {
        name: material.name,
        quantity: material.quantity,
        max_quantity: material.max_quantity,
        unit: material.unit,
        category: material.category,
        location: material.location,
        image_url: material.image_url,
        expiration_date: material.expiration_date,
        is_inactive: false
      });
      onRestoreSuccess();
    } catch (err: unknown) {
      alert((err as Error)?.message || t('authErrorGeneral') || 'Visszaállítás sikertelen.');
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: '400px' }}>
        <div className="modal-header" style={{ borderColor: 'var(--primary-light)' }}>
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)' }}>
            <ArchiveRestore size={20} />
            <span>{t('matRestoreTitle') || 'Anyag visszaállítása'}</span>
          </div>
          <button onClick={onClose} aria-label={t('qrClose') || 'Bezárás'}>
            <X size={20} />
          </button>
        </div>
        
        <div className="modal-body" style={{ padding: '20px 24px' }}>
          <p style={{ fontSize: '14px', lineHeight: 1.5, color: 'var(--text-primary)' }}>
            {(t('matRestoreConfirm') || 'Biztosan vissza szeretnéd állítani a(z) {name} anyagot az aktívak közé?')
              .replace('{name}', material.name)}
          </p>
          <div 
            style={{
              marginTop: '16px',
              padding: '12px',
              backgroundColor: 'var(--primary-light)',
              border: '1px solid var(--primary)',
              color: 'var(--primary)',
              borderRadius: '6px',
              fontSize: '12px',
              display: 'flex',
              gap: '8px',
              alignItems: 'center'
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{t('matRestoreWarning') || 'A visszaállítás után az anyag újra bevételezhető és kiadható lesz, valamint a QR-kód beolvasása is működni fog.'}</span>
          </div>
        </div>

        <div className="modal-footer">
          <button 
            type="button" 
            className="btn-secondary" 
            onClick={onClose}
          >
            {t('cancel') || 'Mégsem'}
          </button>
          <button
            type="button"
            className="btn-primary"
            style={{
              backgroundColor: 'var(--primary)',
              borderColor: 'var(--primary)',
              color: 'white',
              width: 'auto',
              paddingInline: '20px'
            }}
            onClick={handleRestore}
          >
            {t('matRestoreBtn') || 'Visszaállítás megerősítése'}
          </button>
        </div>
      </div>
    </div>
  );
};
