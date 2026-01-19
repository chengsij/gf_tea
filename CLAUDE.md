# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Tea Timer App** - A full-stack React + Express application for managing a tea collection and tracking steep times with audio-notified countdown timers. The app stores tea data in a YAML file (no database) and includes URL scraping capabilities for importing tea information.

## Claude Orchestration Mode

**IMPORTANT**: Claude Code should operate in orchestration mode:
- **Current model (orchestrator)**: Acts as orchestrator for planning, decision-making, coordination, and high-level architecture
- **Haiku subagents**: Always used for code implementation, file operations, bash commands, and routine development tasks
- Always indicate which model performed each task using prefixes like `[Model Name - Orchestrator]` or `[Haiku Agent]`

## Development Commands

All commands should be run from `/tea-app` directory.

### Building & Running

```bash
npm run dev          # Start Vite dev server (http://localhost:5173) + backend
npm run build        # Build frontend (TypeScript + Vite) and prepare for production
npm run lint         # Run ESLint to check for style/type issues
npm run preview      # Preview production build locally
```

### Backend Server

The Express server runs on port 3001 and must be started alongside the frontend dev server:

```bash
cd tea-app && npm run dev  # Starts both frontend (Vite) and backend
```

The backend loads a Puppeteer browser instance on startup for URL scraping.

## Architecture Overview

### Frontend Stack
- **React 19.2.0** with TypeScript for UI
- **Vite** for bundling and dev server
- **Axios** for type-safe API calls
- **Zod** for runtime schema validation
- **Context API** for global timer state management (`TimerContext`)
- **Lucide React** for icons

### Backend Stack
- **Express 5.2.1** REST API
- **TypeScript** with ts-node execution
- **Puppeteer 24.35.0** for URL scraping (browser pre-loaded at startup)
- **js-yaml** for reading/writing `teas.yaml`
- **Zod** for validation (shared schemas with frontend)

### Data Model

```typescript
// Defined in src/types.ts
Tea {
  id: string;                 // Unique identifier (Date.now().toString())
  name: string;               // Tea name
  type: string;               // Tea type (Green, Black, Oolong, etc.)
  image: string;              // Image URL
  steepTimes: number[];       // Array of steep times in seconds
}
```

Data is persisted in `server/teas.yaml` (YAML file, no database).

## Application Architecture

### Data Flow

**Creating/Reading Teas:**
```
React Form → POST /api/teas (axios) → Express validates (Zod)
→ Writes to teas.yaml → Returns Tea object to frontend
```

**Timer System:**
```
User clicks steep time → TimerContext.startTimer(seconds, teaName)
→ useEffect countdown loop (1000ms intervals)
→ When timer reaches 0 → plays Web Audio notification → clears state
```

**URL Scraping:**
```
User enters URL → POST /api/teas/import { url }
→ Puppeteer evaluates DOM (extracts name, type, image, steepTimes)
→ Returns pre-filled form data to frontend
```

### Key Files

**Frontend:**
- `src/App.tsx` - Main React component (dashboard, tea grid, form, timer overlay)
- `src/TimerContext.tsx` - Global state management for countdown timer
- `src/api.ts` - Axios client with type-safe endpoints
- `src/types.ts` - Zod schemas for Tea validation
- `src/App.css` - Responsive UI styles

**Backend:**
- `server/index.ts` - Express REST API (CRUD endpoints + Puppeteer scraping)
- `server/teas.yaml` - Data persistence file

### API Endpoints

```
GET    /api/teas              # Fetch all teas
POST   /api/teas              # Create new tea
DELETE /api/teas/:id          # Delete tea by ID
POST   /api/teas/import       # Scrape tea data from URL
```

All responses validated with Zod schemas.

## Critical Design Patterns

1. **Global State (Context API)** - `TimerContext` provides `timeLeft`, `activeTeaName`, `startTimer()`, `stopTimer()` available anywhere via `useTimer()` hook
2. **Type Safety** - Zod schemas validated on both frontend (API responses) and backend (CRUD operations)
3. **Resource Pooling** - Single Puppeteer browser instance pre-loaded at startup (reused for all scraping requests)
4. **File-Based Persistence** - No database; `server/teas.yaml` is the single source of truth
5. **Monorepo Structure** - Frontend and backend in same npm package, shared TypeScript config

## Common Development Tasks

### Adding a New Tea Property
1. Update `TeaSchema` in `src/types.ts` (add Zod validation)
2. Update `server/index.ts` POST endpoint to handle the new field
3. Update `App.tsx` form to include input for the new field
4. The YAML file and API responses will automatically include it

### Debugging Timer Issues
- Check `TimerContext.tsx` for interval logic
- Verify `startTimer()` is called with correct parameters (seconds, teaName)
- Check browser console for Web Audio API errors (notification sounds)
- Timer state persists in Context; use `useTimer()` hook to access anywhere

### Debugging API Calls
- Check network tab in DevTools (frontend requests to http://localhost:3001/api)
- Backend server logs to console; check for Zod validation errors
- Verify `server/teas.yaml` exists and is valid YAML

### Testing URL Scraping
- POST to `/api/teas/import` with `{ "url": "https://example.com" }`
- Puppeteer looks for:
  - Name: `h1.page-title` or `h1` elements
  - Type: matches against enum ['1', 'Black', 'PuEr', 'Yellow', 'White', 'Oolong']
  - Image: `og:image` meta tag
  - Steep Times: regex `/(\d+)s/g` (finds "10s", "15s" etc. in page text)

## Performance Considerations

- **Puppeteer**: Blocks image, CSS, and media requests to speed up scraping
- **Vite**: Hot Module Replacement (HMR) for fast frontend iteration
- **Context API**: Suitable for this app's simple state needs; Redux would be overkill
- **YAML File**: Simple but synchronous I/O; fine for small tea collections

## File Paths

- Data file: `server/teas.yaml`
- Dev server: http://localhost:5173
- API base: http://localhost:3001/api
- Vite config: `vite.config.ts` (minimal, just React plugin)
