/* Writes public/qr.svg: a QR code for the portal address in src/lib/theme.ts (SITE).
   Run after changing SITE: node tools/build_qr.js */
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');

const theme = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'theme.ts'), 'utf8');
const site = theme.match(/export const SITE = '([^']+)'/)[1];
QRCode.toString('https://' + site + '/', {type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: {dark: '#0d2b45', light: '#ffffff'}}).then((svg) => {
  fs.writeFileSync(path.join(__dirname, '..', 'public', 'qr.svg'), svg);
  console.log('qr for https://' + site + '/');
});
