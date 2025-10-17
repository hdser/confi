const crypto = require('crypto-js');

class EncryptionUtils {
  static generateNonce() {
    return crypto.lib.WordArray.random(16).toString();
  }

  static hashData(data) {
    return crypto.SHA256(JSON.stringify(data)).toString();
  }

  static encryptData(data, key) {
    const encrypted = crypto.AES.encrypt(JSON.stringify(data), key);
    return encrypted.toString();
  }

  static decryptData(encryptedData, key) {
    const decrypted = crypto.AES.decrypt(encryptedData, key);
    return JSON.parse(decrypted.toString(crypto.enc.Utf8));
  }

  static generateKeyPair() {
    // For demonstration - in production use proper key generation
    return {
      privateKey: crypto.lib.WordArray.random(32).toString(),
      publicKey: crypto.lib.WordArray.random(32).toString()
    };
  }
}

module.exports = EncryptionUtils;