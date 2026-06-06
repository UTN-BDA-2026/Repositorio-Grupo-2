'use strict';

const crypto = require('crypto');
const fs = require('fs');

const CHECKSUM_PREFIX = 'sha256:';

function computeFileChecksum(filePath) {
  const hash = crypto.createHash('sha256');
  const data = fs.readFileSync(filePath);
  hash.update(data);
  return `${CHECKSUM_PREFIX}${hash.digest('hex')}`;
}

function computeStreamChecksum(readStream) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    readStream.on('data', (chunk) => hash.update(chunk));
    readStream.on('end', () => resolve(`${CHECKSUM_PREFIX}${hash.digest('hex')}`));
    readStream.on('error', reject);
  });
}

function verifyChecksum(filePath, expectedChecksum) {
  if (!expectedChecksum || !expectedChecksum.startsWith(CHECKSUM_PREFIX)) {
    return {
      valid: false,
      reason: 'Checksum ausente o con formato inválido en el manifiesto',
    };
  }

  const actual = computeFileChecksum(filePath);
  if (actual !== expectedChecksum) {
    return {
      valid: false,
      reason: 'El checksum del archivo no coincide con el manifiesto',
      expected: expectedChecksum,
      actual,
    };
  }

  return { valid: true, checksum: actual };
}

module.exports = {
  CHECKSUM_PREFIX,
  computeFileChecksum,
  computeStreamChecksum,
  verifyChecksum,
};
