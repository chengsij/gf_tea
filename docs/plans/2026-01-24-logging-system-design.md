# Production Logging System Design

**Date:** January 24, 2026
**Feature:** Winston-based logging for backend production monitoring
**Scope:** Backend only (Express server)

---

## Overview

Add comprehensive production logging to the tea timer Express backend using Winston. This will provide visibility into API operations, errors, and performance on the Raspberry Pi deployment.

## Goals

- **Operational visibility:** Monitor API requests, YAML operations, and Puppeteer scraping
- **Error tracking:** Capture failures with full context and stack traces
- **Performance monitoring:** Identify slow requests and operations
- **Storage management:** Automatic log rotation to prevent SD card filling
- **Debugging support:** Historical logs for troubleshooting production issues

## Architecture

### Winston Configuration

Two transports for comprehensive logging:

1. **Console transport** - stdout/stderr for systemd journal capture
2. **Daily rotating file transport** - persistent logs with automatic cleanup

### Log Files Structure

```
tea-app/logs/
  ├── combined-2026-01-24.log    # INFO and above (all operations)
  ├── error-2026-01-24.log       # ERROR only (failures)
  └── .gitignore                 # Exclude logs from git
```

### Rotation Policy

- **Daily rotation:** New file created each day (date-based naming)
- **Retention:** 7 days maximum (configurable via environment)
- **Size limit:** 20MB per file (automatically compresses older files)
- **Purpose:** Prevent Pi SD card from filling up

### Log Levels

| Level | Color | Use Cases |
|-------|-------|-----------|
| ERROR | Red | API failures, YAML I/O errors, Puppeteer crashes, uncaught exceptions |
| WARN | Yellow | Validation failures, missing resources (404), slow requests (>1000ms) |
| INFO | Green | Server startup, API requests with status/duration, YAML operations, tea CRUD |
| DEBUG | Gray | Disabled in production (enable for troubleshooting) |

### Dependencies

- `winston` - Core logging library
- `winston-daily-rotate-file` - Automatic file rotation with cleanup

---

## HTTP Request Logging

### Access Log Format

Every API request logged in Apache/Nginx style:

```
[2026-01-24 10:23:45] INFO: GET /api/teas 200 45ms
[2026-01-24 10:24:12] INFO: POST /api/teas 201 123ms
[2026-01-24 10:25:03] INFO: DELETE /api/teas/1737654321 404 12ms
[2026-01-24 10:26:47] WARN: GET /api/teas 200 1245ms (slow request)
```

### Implementation

- Express middleware wrapping all API routes
- Logs after response completes (captures final status and timing)
- Automatically flags requests >1000ms as WARN level

### What Gets Logged

✅ **Included:**
- All `/api/*` endpoints (GET, POST, PUT, DELETE)
- HTTP method, path, status code
- Response time in milliseconds
- Slow request warnings (>1000ms)

❌ **Excluded:**
- Request bodies (too verbose)
- Response bodies (except errors)
- Static file requests (`/`, `/assets/*`) - too noisy
- Health check endpoint (if added) - would spam logs

---

## Error & Operational Logging

### Error Logging (ERROR level)

Full context for debugging production issues:

```
[2026-01-24 10:30:15] ERROR: Failed to read teas.yaml - ENOENT: no such file or directory
  Stack: Error: ENOENT: no such file or directory, open 'server/teas.yaml'
    at Object.openSync (node:fs:601:3)
    ...

[2026-01-24 10:31:42] ERROR: Tea validation failed - id: 123
  Validation error: Invalid type - expected string, received number (field: type)
```

**What Gets Logged as ERROR:**
- YAML file read/write failures (with stack trace)
- Zod validation errors (with field details and tea ID)
- Puppeteer scraping failures (with URL and error message)
- Uncaught exceptions (with full stack trace)
- 500-level API responses (with request details)

### Operational Events (INFO level)

Key application lifecycle events:

```
[2026-01-24 10:00:00] INFO: Tea Timer Server starting on port 3001 (production mode)
[2026-01-24 10:00:02] INFO: Puppeteer browser initialized
[2026-01-24 10:00:03] INFO: Loaded 12 teas from teas.yaml
[2026-01-24 15:30:12] INFO: Tea created - id: 1737728412, name: "Dragon Well Green Tea"
[2026-01-24 16:45:23] INFO: Tea deleted - id: 1737654321
[2026-01-24 17:20:10] INFO: Tea consumed - id: 1737728412 (count: 3)
```

### Warning Events (WARN level)

Non-critical issues that need attention:

```
[2026-01-24 11:15:30] WARN: Delete failed - tea not found: id 999999
[2026-01-24 12:30:45] WARN: Slow Puppeteer scrape - 3500ms for https://example.com
```

---

## Implementation Details

### Logger Instance (`server/logger.ts`)

Centralized Winston logger configuration:

```typescript
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, stack }) =>
      stack
        ? `[${timestamp}] ${level.toUpperCase()}: ${message}\n${stack}`
        : `[${timestamp}] ${level.toUpperCase()}: ${message}`
    )
  ),
  transports: [
    new winston.transports.Console(),
    new DailyRotateFile({
      filename: 'logs/combined-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '7d',
      maxSize: '20m'
    }),
    new DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      level: 'error',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '7d',
      maxSize: '20m'
    })
  ]
});

export default logger;
```

### Integration Points

1. **Request logging middleware**
   - Add before route handlers in `server/index.ts`
   - Capture request start time, log after response completes
   - Calculate response time (end - start)

2. **Replace console.log statements**
   - Replace existing `console.log` with `logger.info`
   - Replace existing `console.error` with `logger.error`
   - Search codebase for all console usage

3. **Error boundaries**
   - Wrap route handlers to catch and log exceptions
   - Include request context (method, path, body for errors)
   - Return appropriate error responses to client

4. **Startup logging**
   - Log server start with port and mode (dev/production)
   - Log Puppeteer browser initialization
   - Log count of teas loaded from YAML

### Environment Configuration

- **Production:** `LOG_LEVEL=info` (default)
- **Troubleshooting:** `LOG_LEVEL=debug` (via systemd override or .env)
- **Logs directory:** Created automatically by winston on first write

---

## Files to Modify

### New Files
- `tea-app/server/logger.ts` - Winston logger instance
- `tea-app/logs/.gitignore` - Exclude log files from git

### Modified Files
- `tea-app/server/index.ts` - Add logging middleware, replace console statements
- `tea-app/server/package.json` - Add winston dependencies
- `tea-app/.gitignore` - Add `logs/` directory

---

## Testing Plan

### Manual Testing

1. **Start server** - Verify startup logs appear
2. **API requests** - Check access logs for GET/POST/PUT/DELETE
3. **Create tea** - Verify creation logged with ID and name
4. **Delete tea** - Verify deletion logged
5. **Mark consumed** - Verify consumption increment logged
6. **Trigger errors** - Delete non-existent tea, verify WARN log
7. **Slow request** - Add artificial delay, verify >1000ms warning
8. **File rotation** - Verify logs/combined-YYYY-MM-DD.log created

### systemd Integration

1. **Check journal** - Verify console logs appear: `sudo journalctl -u tea-app -f`
2. **Check log files** - Verify `logs/` directory populated
3. **Test rotation** - Change system date, verify new file created
4. **Test retention** - Verify old files deleted after 7 days

---

## Deployment Notes

### systemd Service

No changes required to `tea-app.service` - Winston console transport automatically captured by systemd journal.

### Log Directory Permissions

Ensure `logs/` directory is writable by the `pi` user (systemd service runs as `User=pi`).

### Monitoring Commands

```bash
# Live tail all logs
sudo journalctl -u tea-app -f

# View log files
tail -f ~/gf_tea/tea-app/logs/combined-$(date +%Y-%m-%d).log

# View errors only
tail -f ~/gf_tea/tea-app/logs/error-$(date +%Y-%m-%d).log

# Check log disk usage
du -sh ~/gf_tea/tea-app/logs/
```

### Troubleshooting

If logs aren't appearing:
1. Check `LOG_LEVEL` environment variable
2. Verify `logs/` directory exists and is writable
3. Check for Winston initialization errors in systemd journal
4. Verify winston packages installed: `npm list winston`

---

## Future Enhancements

### Potential Additions (Out of Scope)

- **Structured JSON logging** - For log aggregation tools (Loki, Elasticsearch)
- **Request ID tracking** - Trace requests across logs
- **Performance metrics** - Track average response times per endpoint
- **Remote logging** - Send logs to cloud service (Papertrail, Logtail)
- **Frontend logging** - Capture client-side errors and send to backend
- **Log analysis dashboard** - Parse logs and generate usage reports

---

## Success Criteria

✅ All API requests logged with method, path, status, timing
✅ Errors logged with full stack traces and context
✅ Logs written to both console (systemd) and rotating files
✅ Log files automatically rotate daily and clean up after 7 days
✅ No impact on API performance (<5ms overhead per request)
✅ Logs readable and actionable for debugging production issues
✅ Pi deployment continues working with logging enabled
