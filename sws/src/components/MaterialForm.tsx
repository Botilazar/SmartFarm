import React, { useState, useRef } from 'react';
import { Camera, Upload, AlertCircle, X, Sprout } from 'lucide-react';
import type { Material } from '../db/dbService';
import { useTranslation } from '../context/LanguageContext';

interface MaterialFormProps {
  onSave: (material: Omit<Material, 'qr_code_url'>) => Promise<void>;
  onCancel: () => void;
  existingIds: string[];
  initialData?: Material | null;
}

export const MaterialForm: React.FC<MaterialFormProps> = ({ onSave, onCancel, existingIds, initialData = null }) => {
  const { t } = useTranslation();
  const [id, setId] = useState(initialData ? initialData.id : '');
  const [name, setName] = useState(initialData ? initialData.name : '');
  const [quantity, setQuantity] = useState<number>(initialData ? initialData.quantity : 0);
  const [maxQuantity, setMaxQuantity] = useState<number>(initialData ? initialData.max_quantity : 10);
  const [unit, setUnit] = useState(initialData ? initialData.unit : 'db');
  const [category, setCategory] = useState(initialData ? initialData.category : 'Permetszerek');
  const [location, setLocation] = useState(initialData ? initialData.location : 'A1-01-01');
  const [imageUrl, setImageUrl] = useState(initialData ? initialData.image_url : '');
  const [expirationDate, setExpirationDate] = useState(initialData ? (initialData.expiration_date || '') : '');

  // Camera capture states
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Validate form
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Suggest next ID based on category selection
  const handleCategoryChange = React.useCallback((cat: string) => {
    setCategory(cat);

    // Auto-suggest next ID based on category prefix
    if (!initialData) {
      const prefix = cat === 'Herbicit' ? 'HRB'
        : cat === 'Insecticit' ? 'INS'
          : cat === 'Fungicit' ? 'FNG'
            : cat === 'Biostimulátor' ? 'BIO'
              : cat === 'Szilárd műtrágya' ? 'MTS'
                : cat === 'Folyékony műtrágya' ? 'MTF'
                  : cat === 'Műtrágyák' ? 'MUT'
                    : cat === 'Permetszerek' ? 'PRM'
                      : cat === 'Vetőmagok' ? 'VET'
                        : cat === 'Tápok' ? 'TAP'
                          : cat === 'Adalékanyagok' ? 'ADL'
                            : 'EGY';

      // Find highest index in existing IDs for this prefix
      const pattern = new RegExp(`^${prefix}-(\\d+)$`);
      let maxNum = 0;

      for (const curId of existingIds) {
        const match = curId.match(pattern);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }

      const nextNum = String(maxNum + 1).padStart(3, '0');
      setId(`${prefix}-${nextNum}`);

      // Auto-adjust unit defaults
      if (cat === 'Herbicit' || cat === 'Insecticit' || cat === 'Fungicit' || cat === 'Biostimulátor' || cat === 'Folyékony műtrágya' || cat === 'Permetszerek' || cat === 'Adalékanyagok') {
        setUnit('l');
      } else if (cat === 'Szilárd műtrágya' || cat === 'Műtrágyák' || cat === 'Tápok' || cat === 'Vetőmagok') {
        setUnit('kg');
      } else {
        setUnit('db');
      }
    }
  }, [initialData, existingIds]);

  // Run on category select on mount to assign initial suggested ID
  React.useEffect(() => {
    if (!initialData) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      handleCategoryChange(category);
    }
  }, [initialData, category, handleCategoryChange]);

  // CAMERA SNAPSHOT MANAGEMENT
  const startCamera = async () => {
    setCameraError(null);
    setIsCameraActive(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Error starting photo camera:', err);
      setCameraError(t('mfErrorCamera'));
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        // Set canvas dimensions to match video stream
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Draw video frame to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Save base64 image URL
        const dataUrl = canvas.toDataURL('image/jpeg');
        setImageUrl(dataUrl);
        stopCamera();
      }
    }
  };

  // FILE UPLOAD MANAGEMENT
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validate ID format (e.g. PRM-001)
    const idRegex = /^[A-Z]{3}-\d{3}$/;
    if (!idRegex.test(id)) {
      setErrorMessage(t('mfErrorFormat'));
      return;
    }

    if (!initialData && existingIds.includes(id)) {
      setErrorMessage(`${t('mfErrorExists')}${id}`);
      return;
    }

    if (quantity < 0 || maxQuantity <= 0) {
      setErrorMessage(t('mfErrorQtyPositive'));
      return;
    }

    if (quantity > maxQuantity) {
      setErrorMessage(t('mfErrorQtyMax'));
      return;
    }

    if (isGep === '') {
      setErrorMessage(t('mfErrorGepRequired') || 'A GEP mező kitöltése kötelező!');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({
        id,
        name: name.trim(),
        quantity: Number(quantity),
        max_quantity: Number(maxQuantity),
        unit,
        category,
        location: location.toUpperCase(),
        image_url: imageUrl,
        expiration_date: expirationDate || undefined,
        is_gep: isGep === 'true',
      });
    } catch (err: unknown) {
      setErrorMessage((err as Error)?.message || t('mfErrorSave'));
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-header">
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sprout size={20} className="mobile-action-btn-icon" />
            <span>{initialData ? t('mfEditTitle') : t('mfNewTitle')}</span>
          </div>
          <button onClick={onCancel} aria-label={t('qrClose')}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ maxHeight: '70vh' }}>

            {errorMessage && (
              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  padding: '12px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--danger-bg)',
                  color: 'var(--danger)',
                  fontSize: '13px',
                  marginBottom: '20px',
                }}
              >
                <AlertCircle size={18} style={{ flexShrink: 0 }} />
                <div>{errorMessage}</div>
              </div>
            )}

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="catSelect">{t('colCategory')}</label>
                <select
                  id="catSelect"
                  className="form-select"
                  value={category}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                >
                  <option value="Herbicit">{t('cat_Herbicit')}</option>
                  <option value="Insecticit">{t('cat_Insecticit')}</option>
                  <option value="Fungicit">{t('cat_Fungicit')}</option>
                  <option value="Biostimulátor">{t('cat_Biostimulátor')}</option>
                  <option value="Műtrágyák">{t('cat_Műtrágyák')}</option>
                  <option value="Szilárd műtrágya">{t('cat_Szilárd műtrágya')}</option>
                  <option value="Folyékony műtrágya">{t('cat_Folyékony műtrágya')}</option>
                  <option value="Permetszerek">{t('cat_Permetszerek')}</option>
                  <option value="Vetőmagok">{t('cat_Vetőmagok')}</option>
                  <option value="Tápok">{t('cat_Tápok')}</option>
                  <option value="Adalékanyagok">{t('cat_Adalékanyagok')}</option>
                  <option value="Egyéb">{t('cat_Egyéb')}</option>
                </select>

                {(category === 'Műtrágyák' || category === 'Szilárd műtrágya' || category === 'Folyékony műtrágya') && (
                  <div style={{ marginTop: '10px', padding: '10px 12px', backgroundColor: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--primary)', marginBottom: '6px' }}>
                      {t('cat_MutragyaTipus')}
                    </label>
                    <div style={{ display: 'flex', gap: '16px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: (category === 'Szilárd műtrágya' || category === 'Műtrágyák') ? 600 : 400 }}>
                        <input
                          type="radio"
                          name="mutragyaFormType"
                          checked={category === 'Szilárd műtrágya' || category === 'Műtrágyák'}
                          onChange={() => handleCategoryChange('Szilárd műtrágya')}
                        />
                        <span>{t('cat_MutragyaSzilard')}</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: category === 'Folyékony műtrágya' ? 600 : 400 }}>
                        <input
                          type="radio"
                          name="mutragyaFormType"
                          checked={category === 'Folyékony műtrágya'}
                          onChange={() => handleCategoryChange('Folyékony műtrágya')}
                        />
                        <span>{t('cat_MutragyaFolyekony')}</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="mId">{t('mfLabelId')}</label>
                <input
                  id="mId"
                  type="text"
                  required
                  disabled={!!initialData}
                  style={{ opacity: initialData ? 0.7 : 1, cursor: initialData ? 'not-allowed' : 'text' }}
                  className="form-input-text"
                  placeholder={t('mfPlaceholderId')}
                  value={id}
                  onChange={(e) => setId(e.target.value.toUpperCase())}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="mName">{t('mfLabelName')}</label>
              <input
                id="mName"
                type="text"
                required
                className="form-input-text"
                placeholder={t('mfPlaceholderName')}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="mQty">{t('mfLabelStartQty')}</label>
                <input
                  id="mQty"
                  type="number"
                  required
                  min="0"
                  step="any"
                  className="form-input-text"
                  value={quantity === 0 ? '' : quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="mMaxQty">{t('mfLabelMaxCap')}</label>
                <input
                  id="mMaxQty"
                  type="number"
                  required
                  min="1"
                  step="any"
                  className="form-input-text"
                  value={maxQuantity}
                  onChange={(e) => setMaxQuantity(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="mUnit">{t('colUnit')}</label>
                <select
                  id="mUnit"
                  className="form-select"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                >
                  <option value="db">{t('mfUnitPcs')}</option>
                  <option value="kg">{t('mfUnitKg')}</option>
                  <option value="l">{t('mfUnitL')}</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="mLoc">{t('mfLabelLoc')}</label>
                <input
                  id="mLoc"
                  type="text"
                  required
                  className="form-input-text"
                  placeholder={t('mfPlaceholderLoc')}
                  value={location}
                  onChange={(e) => setLocation(e.target.value.toUpperCase())}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="mExpiration">{t('mfLabelExpiration')}</label>
                <input
                  id="mExpiration"
                  type="date"
                  className="form-input-text"
                  value={expirationDate}
                  onChange={(e) => setExpirationDate(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="mGep">GEP</label>
                <select
                  id="mGep"
                  className="form-select"
                  value={isGep}
                  onChange={(e) => setIsGep(e.target.value)}
                  required
                >
                  <option value="">-- Válassz... --</option>
                  <option value="true">Igen</option>
                  <option value="false">Nem</option>
                </select>
              </div>
            </div>

            {/* Photo Section */}
            <div className="form-group">
              <label className="form-label">{t('mfLabelImage')}</label>

              {isCameraActive ? (
                <div>
                  <div className="camera-preview-container">
                    <video ref={videoRef} autoPlay playsInline muted className="camera-video" />
                    <div className="camera-capture-overlay">
                      <button
                        type="button"
                        className="btn-primary"
                        style={{ borderRadius: '50%', width: '56px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        onClick={capturePhoto}
                        aria-label={t('mfBtnCapture')}
                      >
                        <Camera size={24} />
                      </button>
                    </div>
                  </div>
                  <button type="button" className="btn-secondary" onClick={stopCamera} style={{ width: '100%' }}>
                    {t('mfBtnCancelCapture')}
                  </button>
                </div>
              ) : imageUrl ? (
                <div>
                  <img src={imageUrl} alt={t('mfAltPreview')} className="captured-image-preview" />
                  <div className="captured-preview-actions">
                    <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={startCamera}>
                      <Camera size={16} />
                      <span>{t('mfBtnChangeImage')}</span>
                    </button>
                    <button type="button" className="btn-secondary" style={{ flex: 1, borderColor: '#ef4444', color: '#ef4444' }} onClick={() => setImageUrl('')}>
                      <span>{t('mfBtnDeleteImage')}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{
                      flex: 1,
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      height: '80px',
                      boxSizing: 'border-box'
                    }}
                    onClick={startCamera}
                  >
                    <Camera size={20} />
                    <span style={{ fontSize: '12px' }}>{t('mfBtnTakePhoto')}</span>
                  </button>

                  <label
                    className="btn-secondary"
                    style={{
                      flex: 1,
                      padding: '16px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      height: '80px',
                      boxSizing: 'border-box'
                    }}
                  >
                    <Upload size={20} />
                    <span style={{ fontSize: '12px' }}>{t('mfBtnUploadPhoto')}</span>
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handleFileUpload}
                    />
                  </label>
                </div>
              )}

              {cameraError && (
                <div style={{ color: 'var(--danger)', fontSize: '12px', marginTop: '6px' }}>
                  {cameraError}
                </div>
              )}
            </div>

            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onCancel} disabled={isSubmitting}>
              {t('cancel')}
            </button>
            <button type="submit" className="btn-primary" style={{ width: 'auto', paddingInline: '24px' }} disabled={isSubmitting}>
              {isSubmitting ? t('saving') : (initialData ? t('mfBtnSaveEdit') : t('mfBtnSaveNew'))}</button>
          </div>
        </form>
      </div>
    </div>
  );
};
