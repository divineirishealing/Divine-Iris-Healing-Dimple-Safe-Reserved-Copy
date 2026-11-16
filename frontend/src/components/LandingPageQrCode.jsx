import React, { useCallback, useId, useMemo, useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';

/**
 * QR for a public landing URL (posters / second device — not a UPI collect QR).
 */
export default function LandingPageQrCode({
  url,
  title = 'Scan to open booking page',
  size = 168,
  className = '',
  downloadName = 'booking-qr',
  showDownload = true,
}) {
  const canvasWrapRef = useRef(null);
  const labelId = useId();
  const safeUrl = (url || '').trim();

  const qrValue = useMemo(() => {
    if (!safeUrl) return '';
    try {
      return new URL(safeUrl).href;
    } catch {
      return safeUrl;
    }
  }, [safeUrl]);

  const handleDownload = useCallback(() => {
    const canvas = canvasWrapRef.current?.querySelector('canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `${downloadName}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }, [downloadName]);

  if (!qrValue) return null;

  return (
    <div
      className={`flex flex-col items-center gap-3 ${className}`}
      data-testid="landing-page-qr"
      aria-labelledby={labelId}
    >
      <p id={labelId} className="text-xs text-gray-600 text-center max-w-xs">
        {title}
      </p>
      <div
        ref={canvasWrapRef}
        className="rounded-xl border border-[#eadfca] bg-white p-3 shadow-sm"
      >
        <QRCodeCanvas
          value={qrValue}
          size={size}
          level="M"
          includeMargin={false}
          bgColor="#ffffff"
          fgColor="#1c1230"
        />
      </div>
      <p className="text-[10px] text-gray-400 break-all text-center max-w-[220px] font-mono">{qrValue}</p>
      {showDownload && (
        <button
          type="button"
          onClick={handleDownload}
          className="text-xs font-semibold text-[#6d2d91] underline underline-offset-2"
          data-testid="landing-qr-download"
        >
          Download QR image
        </button>
      )}
    </div>
  );
}