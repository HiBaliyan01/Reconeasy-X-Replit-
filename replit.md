# Project Overview

This is a financial reconciliation dashboard application that was migrated from Bolt to Replit environment.

## Migration Status

✅ **COMPLETED** - Successfully migrated from Bolt to Replit environment with comprehensive settlement upload functionality.

The project now includes:
- Complete rate card management with CSV upload
- Full settlement processing with CSV upload, database storage, and reconciliation
- Modern UI with progress tracking and error handling
- PostgreSQL database integration with proper schema
- All API endpoints functional and tested

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
- Fixed settlement data display to show real API data with SettlementTable component
- Fixed rate card active status calculation with proper date filtering logic
- Fixed filter dropdowns to update dynamically with new rate card uploads  
- Enhanced RateCardUploader with modern UI design matching Settlement uploader
- Fixed QueryClient setup by wrapping App with QueryClientProvider
- Added proper null checks and data structure handling for API vs mock data compatibility
- Resolved all React Query errors and toLocaleString() undefined property issues
- Implemented comprehensive settlement upload system with CSV processing, database storage, and modern UI
- Created settlement CSV upload API with validation, error handling, and bulk processing
- Added enhanced database schema with new fields for CSV upload functionality
- Built modern SettlementUploader component with progress tracking and error reporting
- Integrated template CSV download functionality for user guidance
- Auto-fill missing dates with today's date feature implemented
- **ROUTING SYSTEM OVERHAUL**: Replaced legacy wouter routing with React Router DOM
- Implemented ReconEasy routing template with enhanced sidebar navigation
- Added Lucide React icons to all sidebar navigation items
- Created dark sidebar theme with green accent colors for active states
- Simplified routing structure with clean page organization
- Integrated existing Rate Cards and Settlements components into new routing
- Created Coming Soon pages for all new navigation items
- Updated cn utility function for better type safety
- Maintained ThemeProvider integration throughout new routing system

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