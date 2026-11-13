/**
 * MediCare POS - Offline License Key Generator
 * Usage: node scripts/generate-license.js <HARDWARE_ID>
 */
const crypto = require('crypto');

const hardwareId = process.argv[2];

if (!hardwareId || !hardwareId.trim()) {
  console.log('\n======================================================');
  console.log('       MEDICARE POS - LICENSE KEY GENERATOR');
  console.log('======================================================');
  console.log('Usage  : node scripts/generate-license.js <HARDWARE_ID>');
  console.log('Example: node scripts/generate-license.js 3A8F...C91\n');
  process.exit(1);
}

const cleanHwId = hardwareId.trim().toUpperCase();
const licenseKey = crypto.createHash('sha256').update(cleanHwId + 'MEDICARE_POS_SECRET').digest('hex').toUpperCase();

console.log('\n======================================================');
console.log('       MEDICARE POS - CLIENT LICENSE KEY');
console.log('======================================================');
console.log(`Terminal Hardware ID : ${cleanHwId}`);
console.log(`Generated License Key: ${licenseKey}`);
console.log('======================================================');
console.log('Give this 64-character License Key to the client to activate.');
console.log('======================================================\n');
