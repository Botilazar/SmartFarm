import React from 'react';
import type { Material } from '../db/dbService';

interface QrCodesViewProps {
  materials: Material[];
  onPrintQrClick: (m: Material) => void;
}

export const QrCodesView: React.FC<QrCodesViewProps> = ({
  materials,
  onPrintQrClick
}) => {
  return (
    <div className="details-card" style={{ width: '100%' }}>
      <div className="details-card-header">
        <div>
          <h2 className="details-card-title">QR-Kódok Generálása és Nyomtatása</h2>
          <p className="page-subtitle">Válassz ki egy anyagot a hozzá tartozó QR-kód letöltéséhez vagy nyomtatásához</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '20px' }}>
        {materials.map((m) => (
          <div 
            key={m.id} 
            className="qr-print-card"
            style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
            onClick={() => onPrintQrClick(m)}
          >
            {m.qr_code_url ? (
              <img src={m.qr_code_url} alt={m.name} className="qr-image" style={{ width: '110px', height: '110px' }} />
            ) : (
              <div style={{ width: '110px', height: '110px', backgroundColor: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                QR generálása...
              </div>
            )}
            <span className="qr-print-id" style={{ fontSize: '13px' }}>{m.id}</span>
            <span className="qr-print-name" style={{ fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>{m.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
