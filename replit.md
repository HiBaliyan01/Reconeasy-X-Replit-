# Project Overview

This is a financial reconciliation dashboard application that was migrated from Bolt to Replit environment.

## Migration Status

The project is currently being migrated from using Supabase to Replit's integrated PostgreSQL database with in-memory storage initially.

## Recent Changes

### July 18, 2025
- Migrated from Bolt to Replit environment
- Replaced Supabase client with internal API routes
- Implemented server-side storage interface for rate cards, settlements, and alerts
- Added sample data for testing
- Created API endpoints for all CRUD operations
- Ported Supabase Edge Function to server route `/api/predict-reco`
- Implemented CSV upload functionality for rate cards with bulk import
- Added SettlementUploader component with progress bar and error logging
- Created bulk settlement upload API with automatic reconciliation prediction
- Auto-fill today's date for missing date fields in CSV uploads

## Project Architecture

### Backend
- Express.js server with TypeScript
- In-memory storage initially (can be upgraded to PostgreSQL with Drizzle)
- RESTful API endpoints for all data operations
- Zod validation for request bodies

### Frontend
- React with TypeScript
- TailwindCSS for styling
- React Query for data fetching
- Chart.js for data visualization
- Wouter for routing

### Database Schema
- Rate Cards: Platform fee configurations
- Settlements: Payment reconciliation records
- Alerts: System notifications
- Users: Authentication (placeholder)

## API Endpoints

- `GET /api/rate-cards` - Fetch all rate cards
- `POST /api/rate-cards` - Create new rate card
- `PUT /api/rate-cards/:id` - Update rate card
- `DELETE /api/rate-cards/:id` - Delete rate card
- `GET /api/settlements` - Fetch settlements
- `POST /api/settlements` - Create settlement
- `GET /api/alerts` - Fetch alerts
- `POST /api/alerts` - Create alert
- `POST /api/predict-reco` - Reconciliation prediction

## User Preferences

- Focus on completing the migration efficiently
- Mark progress items as completed in the tracker file
- Maintain security best practices
- Keep the application functional during migration