import React from 'react';
import { X, Archive, AlertCircle } from 'lucide-react';
import { dbService } from '../db/dbService';
import type { Material } from '../db/dbService';
import { useTranslation } from '../context/LanguageContext';

interface DeactivateConfirmModalProps {
  material: Material;
  onClose: () => void;
  onDeactivateSuccess: () => void;
}

export const DeactivateConfirmModal: React.FC<DeactivateConfirmModalProps> = ({
  material,
  onClose,
  onDeactivateSuccess
}) => {
  const { t } = useTranslation();

  const handleDeactivate = async () => {
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
        is_inactive: true
      });
      onDeactivateSuccess();
    } catch (err: unknown) {
      alert((err as Error)?.message || t('authErrorGeneral') || 'Inaktiválás sikertelen.');
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: '400px' }}>
        <div className="modal-header" style={{ borderColor: 'rgba(245, 158, 11, 0.2)' }}>
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--warning)' }}>
            <Archive size={20} />
            <span>{t('matDeactivateTitle') || 'Anyag inaktiválása'}</span>
          </div>
          <button onClick={onClose} aria-label={t('qrClose') || 'Bezárás'}>
            <X size={20} />
          </button>
        </div>
        
        <div className="modal-body" style={{ padding: '20px 24px' }}>
          <p style={{ fontSize: '14px', lineHeight: 1.5, color: 'var(--text-primary)' }}>
            {(t('matDeactivateConfirm') || 'Biztosan inaktívvá szeretnéd tenni a(z) {name} anyagot? Nem lehet majd bevételezni vagy kivenni.')
              .replace('{name}', material.name)}
          </p>
          <div 
            style={{
              marginTop: '16px',
              padding: '12px',
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid var(--warning)',
              color: 'var(--warning)',
              borderRadius: '6px',
              fontSize: '12px',
              display: 'flex',
              gap: '8px',
              alignItems: 'center'
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{t('matDeactivateWarning') || 'Inaktív állapotban az anyag nem bevételezhető és nem adható ki, és a QR-kódjának beolvasása is blokkolva lesz.'}</span>
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
              backgroundColor: 'var(--warning)',
              borderColor: 'var(--warning)',
              color: 'white',
              width: 'auto',
              paddingInline: '20px'
            }}
            onClick={handleDeactivate}
          >
            {t('matDeactivateBtn') || 'Inaktiválás megerősítése'}
          </button>
        </div>
      </div>
    </div>
  );
};
