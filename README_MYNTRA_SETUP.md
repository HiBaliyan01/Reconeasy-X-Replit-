# Myntra Connect Integration Setup

## Overview
The Myntra Connect integration allows automatic synchronization of settlement data from Myntra seller accounts directly into the reconciliation dashboard.

## Prerequisites

1. **Myntra Seller Account**: Active Myntra seller account with API access
2. **Myntra Developer Credentials**: Client ID and Client Secret from Myntra Developer Portal
3. **Environment Variables**: Properly configured environment variables

## Setup Instructions

### 1. Environment Configuration

Create or update your `.env` file with the following variables:

```ini
# Myntra Integration
MYNTRA_CLIENT_ID=your_myntra_client_id
MYNTRA_CLIENT_SECRET=your_myntra_client_secret
MYNTRA_REDIRECT_URI=http://localhost:5000/api/integrations/myntra/callback
MYNTRA_BASE_URL=https://api.myntra.com/v1
MYNTRA_AUTH_URL=https://auth.myntra.com/oauth/authorize

# Encryption Key (Must be exactly 32 characters long)
ENCRYPTION_KEY=your32charsecurekeygoeshere!
```

### 2. Database Migration

Ensure the database schema includes the marketplace field:

```bash
npm run db:push
```

### 3. Test the Integration

1. Navigate to the **Integrations** page in the dashboard
2. Click **Connect Myntra** on the Myntra integration card
3. You'll be redirected to Myntra's OAuth authorization page
4. Grant permissions to your application
5. You'll be redirected back with connection status

### 4. Sync Settlement Data

Once connected, use the **Sync Data** button to pull recent settlements:

- Automatically fetches last 30 days of settlement data
- Transforms Myntra data format to internal schema
- Stores data with proper marketplace tagging
- Updates the settlements table for reconciliation

## API Endpoints

### Authentication
- `GET /api/integrations/myntra/connect` - Initiate OAuth flow
- `GET /api/integrations/myntra/callback` - Handle OAuth callback
- `GET /api/integrations/myntra/status` - Check connection status
- `POST /api/integrations/myntra/disconnect` - Disconnect integration

### Data Sync
- `POST /api/integrations/myntra/sync` - Sync settlements from Myntra

## Features

### Automatic Data Transformation
The integration automatically maps Myntra's settlement data fields to the internal schema:

- `order_id` → Order identification
- `settlement_amount` → Actual settlement amount
- `commission` → Marketplace commission
- `shipping_fee` → Logistics costs
- `gst` → Tax amounts
- `marketplace` → Set to "Myntra"

### Security
- OAuth 2.0 authentication flow
- Encrypted token storage using AES-256-GCM
- Secure token refresh handling
- Automatic token expiration management

### Error Handling
- Connection status monitoring
- Automatic disconnection on token expiry
- Comprehensive error logging
- User-friendly error messages

## Troubleshooting

### Common Issues

1. **Invalid Encryption Key**
   - Ensure ENCRYPTION_KEY is exactly 32 characters long
   - Use only alphanumeric characters

2. **OAuth Redirect Mismatch**
   - Verify MYNTRA_REDIRECT_URI matches registered callback URL
   - Check for trailing slashes and protocol (http/https)

3. **API Connection Failed**
   - Verify Myntra API credentials are correct
   - Check if Myntra API endpoints are accessible
   - Ensure proper permissions are granted in Myntra Developer Portal

4. **Sync Errors**
   - Check if settlement data format has changed
   - Verify API rate limits are not exceeded
   - Review server logs for detailed error information

## Production Deployment

For production deployment:

1. Update `MYNTRA_REDIRECT_URI` to your production domain
2. Use production Myntra API credentials
3. Ensure HTTPS is enabled for OAuth security
4. Set up proper logging and monitoring
5. Configure database connection for production environment

## User Management

Currently uses placeholder user ID (`default-user`). To implement proper user management:

1. Replace placeholder userId in `/api/integrations/myntra/store.ts`
2. Implement session/authentication middleware
3. Update all integration routes to use authenticated user ID
4. Add user-specific token storage and retrieval

## Future Enhancements

- Amazon Seller Central integration
- Flipkart Seller Hub integration  
- Real-time webhook support for instant data sync
- Advanced filtering and date range selection
- Bulk export functionality
- Integration health monitoring dashboard