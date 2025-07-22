import { Request, Response } from 'express';
import { myntraTokenStore } from './store';

// Myntra OAuth configuration
const MYNTRA_CONFIG = {
  clientId: process.env.MYNTRA_CLIENT_ID || 'your-myntra-client-id',
  clientSecret: process.env.MYNTRA_CLIENT_SECRET || 'your-myntra-client-secret',
  redirectUri: process.env.MYNTRA_REDIRECT_URI || 'http://localhost:5000/api/integrations/myntra/callback',
  baseUrl: process.env.MYNTRA_BASE_URL || 'https://api.myntra.com',
  authUrl: process.env.MYNTRA_AUTH_URL || 'https://auth.myntra.com/oauth/authorize'
};

export class MyntraAuthService {
  /**
   * Generate authorization URL for Myntra OAuth
   */
  generateAuthUrl(userId: string): string {
    const state = Buffer.from(JSON.stringify({ userId, timestamp: Date.now() })).toString('base64');
    
    const params = new URLSearchParams({
      client_id: MYNTRA_CONFIG.clientId,
      response_type: 'code',
      redirect_uri: MYNTRA_CONFIG.redirectUri,
      scope: 'read:orders read:settlements write:data',
      state: state
    });

    return `${MYNTRA_CONFIG.authUrl}?${params.toString()}`;
  }

  /**
   * Handle OAuth callback and exchange code for access token
   */
  async handleCallback(req: Request, res: Response): Promise<void> {
    try {
      const { code, state, error } = req.query;

      if (error) {
        throw new Error(`OAuth error: ${error}`);
      }

      if (!code || !state) {
        throw new Error('Missing authorization code or state parameter');
      }

      // Decode and validate state
      const stateData = JSON.parse(Buffer.from(state as string, 'base64').toString());
      const { userId } = stateData;

      if (!userId) {
        throw new Error('Invalid state parameter');
      }

      // Exchange code for access token
      const tokenResponse = await this.exchangeCodeForToken(code as string);
      
      // Save token
      await myntraTokenStore.saveToken(
        userId,
        tokenResponse.access_token,
        tokenResponse.refresh_token,
        tokenResponse.expires_in
      );

      // Redirect back to dashboard with success
      res.redirect(`/integrations?connected=myntra&status=success`);
      
    } catch (error) {
      console.error('Myntra OAuth callback error:', error);
      res.redirect(`/integrations?connected=myntra&status=error&message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`);
    }
  }

  /**
   * Exchange authorization code for access token
   */
  private async exchangeCodeForToken(code: string): Promise<any> {
    const tokenEndpoint = `${MYNTRA_CONFIG.baseUrl}/oauth/token`;
    
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: MYNTRA_CONFIG.clientId,
      client_secret: MYNTRA_CONFIG.clientSecret,
      code: code,
      redirect_uri: MYNTRA_CONFIG.redirectUri
    });

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: params.toString()
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Token exchange failed: ${errorData.error_description || errorData.error || 'Unknown error'}`);
    }

    return await response.json();
  }

  /**
   * Check if user has valid Myntra connection
   */
  async isConnected(userId: string): Promise<boolean> {
    return await myntraTokenStore.hasValidToken(userId);
  }

  /**
   * Disconnect Myntra integration
   */
  async disconnect(userId: string): Promise<void> {
    await myntraTokenStore.deleteToken(userId);
  }

  /**
   * Get access token for API calls
   */
  async getAccessToken(userId: string): Promise<string | null> {
    const token = await myntraTokenStore.getToken(userId);
    return token?.accessToken || null;
  }
}

export const myntraAuthService = new MyntraAuthService();