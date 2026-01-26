# Personal Authentication Design

## Overview

Add simple authentication to lock down the tea app for personal use. Single-user system with username/password login, JWT tokens for session management.

## Authentication Flow

1. Server reads `ADMIN_USERNAME` and `ADMIN_PASSWORD_HASH` from environment variables
2. User visits app → Frontend checks for stored JWT token
3. No valid token → Show login screen
4. User enters credentials → POST `/api/auth/login`
5. Server verifies password against bcrypt hash
6. Valid → Returns JWT token (30-day expiry)
7. Frontend stores token in `localStorage`, includes in all API requests via `Authorization: Bearer <token>` header
8. Server middleware validates JWT on every protected route

## Backend Changes

### New Dependencies
- `bcrypt` - Password hash verification
- `jsonwebtoken` - JWT creation and validation

### New Files
- `server/auth.ts` - Auth middleware and login handler

### New Endpoint
- `POST /api/auth/login` - Accepts `{ username, password }`, returns `{ token }` or 401

### Auth Middleware
- Checks `Authorization: Bearer <token>` header on all `/api/*` routes except `/api/auth/login`
- Validates JWT signature and expiry
- Returns 401 if invalid or missing

### Environment Variables
```
ADMIN_USERNAME=yourname
ADMIN_PASSWORD_HASH=$2b$10$...
JWT_SECRET=random-secret-string
```

## Frontend Changes

### New Components
- `LoginPage.tsx` - Username/password form with login button
- `AuthContext.tsx` - Stores auth state, provides `login()` and `logout()`

### App Flow
- `App.tsx` wraps content in `<AuthProvider>`
- Not authenticated → render `<LoginPage />`
- Authenticated → render tea dashboard

### API Client Changes
- Axios interceptor adds auth token to all requests
- On 401 response, clear token and redirect to login

### Token Storage
- Store JWT in `localStorage` under key `auth_token`
- On app load, check if token exists and not expired
- Logout clears the token

### UI
- Add logout button in header/settings area

## Security

- Passwords stored as bcrypt hash only (in env var, not in code)
- JWT signed with `JWT_SECRET`
- Generic error message on login failure ("Invalid username or password")
- Missing env vars → Server exits on startup

## Not Included (YAGNI)

- No password reset flow (control env vars directly)
- No "remember me" option (always 30 days)
- No refresh tokens (re-login after expiry)
- No rate limiting (personal use)
- No multi-user support
- No OAuth/social login
