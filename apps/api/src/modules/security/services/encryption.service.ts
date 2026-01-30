import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export interface EncryptedData {
  iv: string;
  data: string;
  authTag: string;
}

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32; // 256 bits

  constructor(private readonly configService: ConfigService) {}

  private getEncryptionKey(): Buffer {
    const key = this.configService.get<string>('ENCRYPTION_KEY');
    if (!key) {
      // In development, use a default key (NOT FOR PRODUCTION)
      this.logger.warn('Using default encryption key. Set ENCRYPTION_KEY in production!');
      return crypto.scryptSync('default-dev-key', 'salt', this.keyLength);
    }

    // Derive key from the provided key using scrypt
    return crypto.scryptSync(key, 'pg-admin-salt', this.keyLength);
  }

  /**
   * Encrypt data using AES-256-GCM
   */
  encrypt(plaintext: string): string {
    const key = this.getEncryptionKey();
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv(this.algorithm, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    const result: EncryptedData = {
      iv: iv.toString('hex'),
      data: encrypted,
      authTag: authTag.toString('hex'),
    };

    return Buffer.from(JSON.stringify(result)).toString('base64');
  }

  /**
   * Decrypt data using AES-256-GCM
   */
  decrypt(encryptedString: string): string {
    try {
      const key = this.getEncryptionKey();
      const decoded = JSON.parse(
        Buffer.from(encryptedString, 'base64').toString('utf8'),
      ) as EncryptedData;

      const iv = Buffer.from(decoded.iv, 'hex');
      const authTag = Buffer.from(decoded.authTag, 'hex');

      const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(decoded.data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      this.logger.error('Decryption failed:', error.message);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Encrypt an object (serializes to JSON first)
   */
  encryptObject<T>(obj: T): string {
    return this.encrypt(JSON.stringify(obj));
  }

  /**
   * Decrypt to an object
   */
  decryptObject<T>(encryptedString: string): T {
    const decrypted = this.decrypt(encryptedString);
    return JSON.parse(decrypted) as T;
  }

  /**
   * Hash a password or sensitive string (one-way)
   */
  hash(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
  }

  /**
   * Generate a secure random token
   */
  generateToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate a secure random password
   */
  generatePassword(length: number = 16): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    const randomBytes = crypto.randomBytes(length);

    for (let i = 0; i < length; i++) {
      password += chars[randomBytes[i] % chars.length];
    }

    return password;
  }
}
