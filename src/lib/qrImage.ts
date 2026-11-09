/**
 * A UPI link as a QR code image, as a data: URL: embedded in the bill image so it cannot taint the
 * canvas. Always black modules on white (never theme colours), error correction M, 2-module quiet
 * zone, about 360 px. The qrcode package loads on first use, not at startup.
 */
export async function upiQrDataUrl(uri: string): Promise<string> {
  const { default: QRCode } = await import('qrcode')
  return QRCode.toDataURL(uri, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 360,
    color: { dark: '#000000', light: '#ffffff' },
  })
}
