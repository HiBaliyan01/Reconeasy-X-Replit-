# Project Overview

This project is a financial reconciliation dashboard application designed to streamline settlement processing, rate card management, and claims tracking. It facilitates comprehensive financial reconciliation for businesses by handling large volumes of transaction data, providing insights into payment discrepancies, and managing claims efficiently. The application aims to provide a robust, user-friendly platform for financial analysis and operational efficiency.

## Business Vision & Market Potential

The vision is to offer a cutting-edge financial reconciliation solution, initially migrated from Bolt to Replit. It aims to serve businesses needing precise financial oversight, particularly those dealing with complex marketplace settlements and returns. The market potential lies in automating and simplifying a critical, often manual, process, thereby reducing errors, saving time, and improving financial transparency for users.

## Key Capabilities

- Comprehensive rate card management with CSV upload.
- Full settlement processing including CSV upload, database storage, and reconciliation.
- Advanced claims management with detailed tracking, status updates, and attachment support.
- Orders and returns management with data import and reconciliation.
- Intuitive user interface with progress tracking and error handling.
- PostgreSQL database integration with a well-defined schema.
- Fully functional and tested API endpoints for all core operations.
- Secure authentication system with multi-factor authentication and rate limiting.

# User Preferences

- Focus on completing the migration efficiently.
- Mark progress items as completed in the tracker file.
- Maintain security best practices.
- Keep the application functional during migration.

# System Architecture

## Core Architecture & Design Patterns

The application adopts a client-server architecture with a clear separation of concerns. The backend is built with Express.js and TypeScript, providing RESTful API endpoints. The frontend is a React application styled with TailwindCSS, utilizing React Query for efficient data fetching and state management. The system is designed for modularity and scalability, ensuring components are reusable and maintainable.

## UI/UX Decisions

The design adheres to a professional, modern aesthetic with a focus on usability and clarity.
- **Color Scheme:** Integrates a consistent ReconEasy brand design system using specific CSS variables for primary (#26A69A), accent coral (#FF6F61), and subheader variant colors (payments: teal, returns: coral, settlements: amber, orders: blue, projected: purple, claims: indigo) with both light and dark mode support.
- **Components:** Utilizes a rich set of custom components like `Badge`, `SystemHealthBanner`, and professional table designs with rounded corners and shadows.
- **Layouts:** Features modern card-based layouts for detailed views (e.g., ClaimDetails) and professional table designs for data display (e.g., ClaimsTable).
- **Interactivity:** Incorporates interactive elements such as smart aging indicators, dropdowns, inline editing, and drag-and-drop file uploads.
- **Responsiveness:** Designed to be fully responsive, optimizing for both desktop and mobile viewing.
- **Theming:** Includes dark mode support and consistent application of brand-specific gradient classes.

## Technical Implementations & Feature Specifications

- **Backend:** Express.js server in TypeScript, initially supporting in-memory storage (upgradeable to PostgreSQL with Drizzle). Zod is used for robust request body validation.
- **Frontend:** React with TypeScript, TailwindCSS for utility-first styling, React Query for server state management, and Wouter for client-side routing. Chart.js is included for data visualization.
- **Database Schema:** Designed to manage `Rate Cards`, `Settlements`, `Alerts`, `Orders`, `Returns`, and `Claims` data with distinct fields for each entity.
- **CSV Processing:** Robust CSV upload functionality with validation, error handling, and bulk processing for rate cards, settlements, orders, and returns. Includes template downloads and auto-filling of dates.
- **Authentication:** Standalone Supabase-backed authentication system featuring login, registration with OTP verification, password setup, account lockout mechanisms, and rate limiting.
- **Claims Management:** Enterprise-grade standalone system with a main table (Payment/Return filtering), bulk status updates, inline editing, detailed claim pages (metadata, attachments, activity log), smart tooltips, and export options (Excel/PDF). Includes legacy URL redirect from /reconciliation/claims to /claims.
- **Reconciliation Logic:** Comprehensive reconciliation engine for returns, orders, rate cards, and settlements, with discrepancy detection and CSV export for audit trails.
- **Navigation:** Consolidated sidebar navigation with separated main sections: Dashboard, Analytics, Returns, Rate Cards, Reconciliation (Payments, Returns, Settlements, Orders, Projected Income), Claims (standalone), Integrations, and Settings. Claims moved from Reconciliation sub-tabs to standalone main navigation for better accessibility.

## System Design Choices

- **Data Flow:** Clear flow from CSV uploads, through API endpoints, to database storage and frontend display.
- **Error Handling:** Comprehensive error reporting and loading states integrated throughout the application.
- **Modularity:** Emphasis on modular component architecture for reusability and maintainability.
- **Security:** Implementation of security best practices including rate limiting, OTP verification, and secure token storage (encrypted).

# External Dependencies

- **PostgreSQL:** Primary database for persistent data storage.
- **Supabase:** Used specifically for robust authentication services (OTP, user management).
- **TailwindCSS:** Utility-first CSS framework for styling.
- **React Query:** For efficient data fetching, caching, and synchronization with server state.
- **Chart.js:** For data visualization components.
- **Wouter:** Lightweight router for React applications.
- **xlsx:** Library for reading and writing spreadsheet files (CSV, Excel).
- **html2pdf.js & jspdf-autotable:** Libraries for generating PDF reports from HTML tables.
- **Myntra Connect:** Integrated for OAuth flow and automatic data synchronization from Myntra marketplace.