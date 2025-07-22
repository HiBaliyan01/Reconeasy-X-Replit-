import crypto from 'crypto';

interface MyntraToken {
  userId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  createdAt: Date;
}

class MyntraTokenStore {
  private tokens: Map<string, MyntraToken> = new Map();

  async saveToken(userId: string, accessToken: string, refreshToken?: string, expiresIn?: number): Promise<void> {
    const expiresAt = new Date();
    if (expiresIn) {
      expiresAt.setSeconds(expiresAt.getSeconds() + expiresIn);
    } else {
      // Default to 1 hour if no expiry provided
      expiresAt.setHours(expiresAt.getHours() + 1);
    }

    const token: MyntraToken = {
      userId,
      accessToken,
      refreshToken,
      expiresAt,
      createdAt: new Date()
    };

    this.tokens.set(userId, token);
  }

  async getToken(userId: string): Promise<MyntraToken | null> {
    const token = this.tokens.get(userId);
    if (!token) return null;

    // Check if token is expired
    if (token.expiresAt < new Date()) {
      this.tokens.delete(userId);
      return null;
    }

    return token;
  }

  async deleteToken(userId: string): Promise<void> {
    this.tokens.delete(userId);
  }

  async hasValidToken(userId: string): Promise<boolean> {
    const token = await this.getToken(userId);
    return token !== null;
  }
}

// Encryption helper for secure token storage
export class TokenEncryption {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32;

  constructor(private encryptionKey: string) {
    if (encryptionKey.length !== this.keyLength) {
      throw new Error(`Encryption key must be exactly ${this.keyLength} characters long`);
    }
  }

  encrypt(text: string): { encrypted: string; iv: string; authTag: string } {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(this.algorithm, this.encryptionKey);
    cipher.setAAD(Buffer.from('myntra-token', 'utf8'));

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }

  decrypt(encryptedData: { encrypted: string; iv: string; authTag: string }): string {
    const decipher = crypto.createDecipher(this.algorithm, this.encryptionKey);
    decipher.setAAD(Buffer.from('myntra-token', 'utf8'));
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));

    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}

export const myntraTokenStore = new MyntraTokenStore();