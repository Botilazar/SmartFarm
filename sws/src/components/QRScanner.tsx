import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, AlertCircle, Keyboard } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';

interface QRScannerProps {
  onScanSuccess: (materialId: string) => void;
  onClose: () => void;
}

export const QRScanner: React.FC<QRScannerProps> = ({ onScanSuccess, onClose }) => {
  const { t } = useTranslation();
  const [scanError, setScanError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [manualId, setManualId] = useState('');
  const [showManual, setShowManual] = useState(false);
  
  const qrInstanceRef = useRef<Html5Qrcode | null>(null);
  const readerId = 'qr-reader-container';

  const stopScanning = useCallback(async () => {
    if (qrInstanceRef.current && qrInstanceRef.current.isScanning) {
      try {
        await qrInstanceRef.current.stop();
      } catch (err) {
        console.error('Failed to stop scanning:', err);
      }
      qrInstanceRef.current = null;
    }
    setIsScanning(false);
  }, []);

  const startScanning = useCallback(async (cameraId: string) => {
    try {
      setScanError(null);
      await stopScanning();

      const html5QrCode = new Html5Qrcode(readerId);
      qrInstanceRef.current = html5QrCode;

      setIsScanning(true);
      await html5QrCode.start(
        cameraId,
        {
          fps: 10,
          qrbox: { width: 220, height: 220 },
        },
        (decodedText) => {
          try {
            const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            const context = new AudioCtx();
            const osc = context.createOscillator();
            const gain = context.createGain();
            osc.connect(gain);
            gain.connect(context.destination);
            osc.frequency.value = 880; // A5 pitch
            gain.gain.setValueAtTime(0.1, context.currentTime);
            osc.start();
            osc.stop(context.currentTime + 0.1);
          } catch {
            console.log('Audio feedback failed (no user gesture yet)');
          }

          stopScanning().then(() => {
            onScanSuccess(decodedText.trim());
          });
        },
        () => {
          // Silent callback for frame scanning errors (very frequent)
        }
      );
    } catch (err: unknown) {
      console.error('Camera start failed:', err);
      setScanError(t('qrErrorCameraStart'));
      setIsScanning(false);
    }
  }, [readerId, onScanSuccess, stopScanning, t]);

  // Request cameras on load
  useEffect(() => {
    const requestCameraPermissionAndGetDevices = async () => {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          stream.getTracks().forEach(track => track.stop());
        }
      } catch (err) {
        console.warn('Initial camera permission request failed or rejected:', err);
      }

      try {
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          setCameras(devices);
          const backCam = devices.find((d) => {
            const label = d.label.toLowerCase();
            return (
              label.includes('back') || 
              label.includes('environment') || 
              label.includes('rear') ||
              label.includes('hátsó') ||
              label.includes('hátlap') ||
              label.includes('hátulsó') ||
              label.includes('kamera 1') ||
              label.includes('camera 1')
            );
          });
          setSelectedCameraId(backCam ? backCam.id : devices[devices.length - 1].id);
        } else {
          setScanError(t('qrErrorNoCamera'));
          setShowManual(true);
        }
      } catch (err) {
        console.error('Error getting cameras:', err);
        if (!window.isSecureContext) {
          setScanError(t('qrErrorSecureContext'));
        } else {
          setScanError(t('qrErrorScanFailed'));
        }
        setShowManual(true);
      }
    };

    requestCameraPermissionAndGetDevices();

    return () => {
      stopScanning();
    };
  }, [stopScanning, t]);

  // Automatically start scanning when camera selected
  useEffect(() => {
    if (selectedCameraId && !showManual) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      startScanning(selectedCameraId);
    }
  }, [selectedCameraId, showManual, startScanning]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualId.trim()) {
      onScanSuccess(manualId.trim());
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: '400px' }}>
        <div className="modal-header">
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Camera size={20} className="mobile-action-btn-icon" />
            <span>{t('qrScanTitle')}</span>
          </div>
          <button onClick={onClose} aria-label={t('qrClose')}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {!showManual && (
            <>
              {cameras.length > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label htmlFor="cameraSelect" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>{t('qrCameraLabel')}</label>
                  <select
                    id="cameraSelect"
                    className="form-select"
                    style={{ flex: 1, padding: '6px 10px', fontSize: '12px' }}
                    value={selectedCameraId}
                    onChange={(e) => setSelectedCameraId(e.target.value)}
                  >
                    {cameras.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label || `${t('qrCameraFallback')} ${cameras.indexOf(c) + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="qr-reader-target" style={{ minHeight: '250px' }}>
                <div id={readerId} style={{ width: '100%', height: '100%', minHeight: '240px' }} />
                {isScanning && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      border: '2px dashed #10b981',
                      borderRadius: '8px',
                      width: '200px',
                      height: '200px',
                      pointerEvents: 'none',
                      animation: 'pulse 2s infinite',
                    }}
                  />
                )}
              </div>
            </>
          )}

          {showManual && (
            <form onSubmit={handleManualSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="manualId">{t('qrManualLabel')}</label>
                <div className="input-icon-wrapper">
                  <Keyboard className="input-icon" size={18} />
                  <input
                    id="manualId"
                    type="text"
                    required
                    className="input-with-icon"
                    placeholder="PRM-001"
                    value={manualId}
                    onChange={(e) => setManualId(e.target.value.toUpperCase())}
                  />
                </div>
              </div>
              <button type="submit" className="btn-primary">
                {t('qrManualBtn')}
              </button>
            </form>
          )}

          {scanError && (
            <div
              style={{
                display: 'flex',
                gap: '8px',
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: 'var(--danger-bg)',
                color: 'var(--danger)',
                fontSize: '12px',
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <div>{scanError}</div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button
              type="button"
              className="view-all-link"
              onClick={() => {
                if (showManual) {
                  setShowManual(false);
                  if (selectedCameraId) startScanning(selectedCameraId);
                } else {
                  stopScanning();
                  setShowManual(true);
                }
              }}
            >
              {showManual ? (
                <>
                  <Camera size={14} />
                  <span>{t('qrBackToCamera')}</span>
                </>
              ) : (
                <>
                  <Keyboard size={14} />
                  <span>{t('qrTypeManual')}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
