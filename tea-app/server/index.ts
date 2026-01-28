import fs from 'fs';
import path from 'path';

import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import yaml from 'js-yaml';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { z } from 'zod';

// Import logger and shared types
import logger from './logger';
import { TeaSchema, CreateTeaSchema } from '../shared/types';
import type { Tea } from '../shared/types';
import { login, requireAuth, validateAuthConfig } from './auth';

// Load environment variables
dotenv.config();

logger.debug('Index.ts loaded and initializing Express server');

const app = express();
const port = parseInt(process.env.PORT || '3001', 10);

// Global uncaught exception handler
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', error);
  process.exit(1);
});

const isDist = __dirname.includes('/dist/');
const DATA_FILE = process.env.DATA_FILE_PATH || (isDist
  ? path.join(__dirname, '..', '..', '..', 'teas.yaml')
  : path.join(__dirname, 'teas.yaml'));
logger.info(`DATA_FILE: ${DATA_FILE}`)

// Configure CORS with whitelisted origins
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(origin => origin.trim()) || ['http://localhost:5173'];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'DELETE', 'PATCH', 'PUT', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'authorization']
}));
app.use(express.json());

// HTTP request logging middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  const slowRequestThreshold = parseInt(process.env.SLOW_REQUEST_MS || '1000', 10);
  let logged = false;

  const logRequest = () => {
    if (logged) return; // Prevent duplicate logs
    logged = true;

    const duration = Date.now() - startTime;
    const logMessage = `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`;

    try {
      if (duration > slowRequestThreshold) {
        logger.warn(`${logMessage} (slow request)`);
      } else {
        logger.info(logMessage);
      }
    } catch (logError) {
      logger.error('Failed to write log entry', logError instanceof Error ? logError : new Error(String(logError)));
    }
  };

  res.on('finish', logRequest);
  res.on('close', logRequest);

  next();
});

// Debug logging middleware - DETAILED
app.use((req, res, next) => {
  logger.debug(`Incoming request: ${req.method} ${req.path}`, {
    originalUrl: req.originalUrl,
    params: req.params,
    body: req.body
  });
  next();
});

// Auth routes (must be before requireAuth middleware)
app.post('/api/auth/login', login);

// Protect all other API routes
app.use('/api', requireAuth);

// Normalize tea type to canonical form (handles variations like "pu-er", "Pu-Er", etc.)
// Helper function to check if a hostname is a private/local IP address
const isPrivateIP = (hostname: string): boolean => {
  // IPv4 private ranges
  const ipv4Patterns = [
    /^127\./,                        // 127.0.0.0/8 (localhost)
    /^10\./,                         // 10.0.0.0/8
    /^172\.(1[6-9]|2[0-9]|3[01])\./, // 172.16.0.0/12
    /^192\.168\./,                   // 192.168.0.0/16
    /^169\.254\./,                   // 169.254.0.0/16 (link-local)
  ];

  // Check for localhost and loopback aliases
  if (hostname === 'localhost' || hostname === 'localhost.localdomain') {
    return true;
  }

  // Check IPv4 patterns
  for (const pattern of ipv4Patterns) {
    if (pattern.test(hostname)) {
      return true;
    }
  }

  // IPv6 loopback and private ranges
  if (hostname === '::1' || hostname === '::' || hostname.startsWith('fc') || hostname.startsWith('fd')) {
    return true;
  }

  return false;
};

// Helper function to validate the URL for SSRF attacks
const validateURLForSSRF = (url: string): { valid: boolean; error?: string } => {
  // Check for empty URL
  if (!url || typeof url !== 'string' || url.trim() === '') {
    return { valid: false, error: 'URL cannot be empty' };
  }

  try {
    const parsed = new URL(url);

    // Check protocol - only allow http and https
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: 'Only HTTP/HTTPS URLs are allowed' };
    }

    // Check for empty hostname
    if (!parsed.hostname) {
      return { valid: false, error: 'Invalid URL format: missing hostname' };
    }

    // Check for private/local IP addresses
    if (isPrivateIP(parsed.hostname)) {
      return { valid: false, error: 'Cannot scrape private/local URLs' };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: 'Invalid URL format' };
  }
};

const normalizeTeaType = (type: string): string => {
  const normalized = type.toLowerCase().trim();

  if (normalized === 'green') return 'Green';
  if (normalized === 'black') return 'Black';
  if (normalized === 'puer' || normalized === 'pu-er' || normalized === 'pu-erh') return 'PuEr';
  if (normalized === 'yellow') return 'Yellow';
  if (normalized === 'white') return 'White';
  if (normalized === 'oolong') return 'Oolong';

  // Return as-is if not recognized (will fail validation with helpful error message)
  return type;
};

const readTeas = (): Tea[] => {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      logger.debug(`Data file not found at ${DATA_FILE}, returning empty collection`);
      return [];
    }

    const fileContents = fs.readFileSync(DATA_FILE, 'utf8');

    // Validate data read from file
    const data = yaml.load(fileContents);
    return z.array(TeaSchema).parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error(`Failed to read teas.yaml - validation error in file format`, new Error(JSON.stringify(error.issues)));
    } else {
      logger.error(`Failed to read teas.yaml - ${error instanceof Error ? error.message : String(error)}`);
    }
    throw new Error('Failed to read tea collection from file');
  }
};

const writeTeas = (teas: Tea[]): boolean => {
  try {
    const yamlStr = yaml.dump(teas);

    // Check if directory exists
    const dirPath = path.dirname(DATA_FILE);
    if (!fs.existsSync(dirPath)) {
      try {
        fs.mkdirSync(dirPath, { recursive: true });
        logger.debug(`Created directory: ${dirPath}`);
      } catch (mkdirError) {
        logger.error(`Failed to write teas.yaml - Failed to create directory ${dirPath}: ${mkdirError instanceof Error ? mkdirError.message : String(mkdirError)}`);
        throw new Error('Failed to create data directory');
      }
    }

    // Attempt to write file
    fs.writeFileSync(DATA_FILE, yamlStr, 'utf8');
    logger.debug(`Successfully saved ${teas.length} teas to ${DATA_FILE}`);
    return true;
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('EACCES')) {
        logger.error('Failed to write teas.yaml - Permission denied: Unable to write to data file');
        throw new Error('Permission denied: Unable to write to data file');
      } else if (error.message.includes('ENOSPC')) {
        logger.error('Failed to write teas.yaml - Disk full: Unable to save tea data');
        throw new Error('Disk full: Unable to save tea data');
      }
    }
    logger.error(`Failed to write teas.yaml - ${error instanceof Error ? error.message : String(error)}`);
    throw new Error('Failed to save tea collection to file');
  }
};



app.post('/api/teas/import', async (req, res) => {
  logger.info('=== IMPORT ENDPOINT HIT (Axios/Cheerio) ===');
  const { url } = req.body;
  const scrapingStartTime = Date.now();

  // Validate URL for SSRF attacks
  const urlValidation = validateURLForSSRF(url);
  if (!urlValidation.valid) {
    logger.warn(`Scraping failed - ${url}: SSRF validation failed - ${urlValidation.error}`);
    res.status(400).json({ error: urlValidation.error });
    return;
  }

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'PostmanRuntime/7.39.1',
        'Accept': '*/*',
        'Cache-Control': 'no-cache',
        'Postman-Token': '7259037a-7c85-4205-9cbe-d76d2d2f0f8e',
        'Host': 'www.teavivre.com',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive'
      },
      timeout: 30000
    });

    const $ = cheerio.load(response.data);

    // Remove scripts and styles for cleaner text extraction
    $('script').remove();
    $('style').remove();

    // 1. Name
    const name = $('h1.page-title').text().trim() || $('h1').first().text().trim() || '';

    // 2. Image
    let image = $('meta[property="og:image"]').attr('content') || '';
    if (!image) {
      image = $('.gallery-placeholder__image').attr('src') || '';
    }

    // Prepare body text for searching (remove reviews section logic)
    let bodyText = $('body').text();
    const reviewPatterns = [
      /customers?\s+who\s+viewed/i,
      /customer\s+reviews?/i,
      /related\s+products?/i,
      /you\s+may\s+also\s+like/i,
      /recently\s+viewed/i
    ];

    let cutoffIndex = bodyText.length;
    for (const pattern of reviewPatterns) {
      const match = bodyText.search(pattern);
      if (match !== -1 && match < cutoffIndex) {
        cutoffIndex = match;
      }
    }
    bodyText = bodyText.substring(0, cutoffIndex);

    // 3. Type
    let type = '';
    const validTypes = ['Green', 'Black', 'PuEr', 'Yellow', 'White', 'Oolong'] as const;

    $('.info-title').each((_, el) => {
      if ($(el).text().includes('Categories')) {
        const containerText = $(el).parent().text();
        validTypes.forEach(t => {
          if (containerText.includes(t)) type = t;
        });
        if (!type && (containerText.includes('pu-er') || containerText.includes('Pu-Er') || containerText.includes('Pu-er'))) {
          type = 'PuEr';
        }
      }
    });

    if (!type) {
      for (const t of validTypes) {
        if (bodyText.includes(t) && name.includes(t)) {
          type = t;
          break;
        }
      }
      if (!type && (bodyText.includes('pu-er') || bodyText.includes('Pu-Er')) && name.includes('pu')) {
        type = 'PuEr';
      }
    }

    // 4. Steep Times
    const steepTimes: number[] = [];
    let brewingTable: any = null;

    $('.product-description-title').each((_: number, el: any) => {
      const text = $(el).text();
      if (text.includes('Recommend') && text.includes('Brew')) {
        let sibling = $(el).next();
        while (sibling.length) {
          if (sibling.is('table')) {
            brewingTable = sibling;
            return false; // break loop
          }
          sibling = sibling.next();
        }
      }
    });

    if (brewingTable) {
      brewingTable.find('td').each((_: number, el: any) => {
        const tdText = $(el).text();
        if (tdText.toLowerCase().includes('steeps')) {
          const colonIndex = tdText.toLowerCase().indexOf('steeps:');
          if (colonIndex !== -1) {
            const afterColon = tdText.substring(colonIndex + 7);
            const firstLine = afterColon.split('\n')[0].trim();
            const numberSequence = firstLine.replace(/^[a-z]+\s*,\s*/i, '');
            const matches = numberSequence.match(/(\d+)\s*s/gi);

            if (matches) {
              matches.forEach((m: string) => {
                const num = parseInt(m.match(/\d+/)![0]);
                if (!isNaN(num) && num >= 3 && num <= 999) {
                  steepTimes.push(num);
                }
              });
            }
          }
          return false; // break loop after finding steeps
        }
      });
    }

    steepTimes.sort((a, b) => a - b);

    // 5. Brewing Temperature and Tea Weight
    let brewingTemperature = '';
    let teaWeight = '';

    if (brewingTable) {
      const tds = brewingTable.find('td');
      let gongfuColumnOffset = -1;

      tds.each((i: number, el: any) => {
        if ($(el).text().toLowerCase().includes('chinese gongfu')) {
          gongfuColumnOffset = i % 2;
          return false;
        }
      });

      if (gongfuColumnOffset === 1) {
        tds.each((i: number, el: any) => {
          const tdText = $(el).text().trim();
          if (i % 2 === gongfuColumnOffset) {
            if (tdText.match(/\d+\s*℉\s*\/\s*\d+\s*℃/)) {
              brewingTemperature = tdText;
            }
            if (tdText.match(/\d+\s*g\s*(?:tea)?/i)) {
              teaWeight = tdText;
            }
          }
        });
      }
    }

    // 6. Caffeine Content
    let caffeine = '';
    // Search full page text for caffeine information
      const caffeinePatterns = [
        // Pattern 1: "Low/Medium/High caffeine" with optional description in parentheses
        /((?:low|medium|high|very low|very high)\s+caffeine[^.\n]*(?:\([^)]*\))?)/i,
        // Pattern 2: "Caffeine:" or "Caffeine content:" followed by descriptive text
        /caffeine(?:\s+content)?[:\s]*([^\n]*?(?:low|medium|high|less|more|very|\d+\s*mg|about|approx)(?:[^\n]*?)?)(?=\n|$|[.!?])/i,
        // Pattern 3: mg-based patterns
        /(\d+\s*-?\s*\d*\s*mg.*?caffeine|caffeine[:\s]*\d+\s*-?\s*\d*\s*mg)/i,
        // Pattern 4: Just look for any line containing caffeine
        /caffeine[^.\n]*/i
    ];

    for (const pattern of caffeinePatterns) {
      const match = bodyText.match(pattern);
      if (match) {
        let found = match[0] || match[1] || '';
        found = found.replace(/\s+/g, ' ').trim();
        found = found.replace(/^caffeine\s+/i, '').trim();
        if (found.length > 0 && found.length < 200) {
          caffeine = found;
          break;
        }
      }
    }

    const caffeineLevel = (() => {
      const text = caffeine.toLowerCase();
      
        // Check for "less than X%" pattern first (treat upper bound as the threshold)
        const lessMatch = text.match(/less\s+than\s+(\d+)\s*%/);
      if (lessMatch) {
        const percentage = parseInt(lessMatch[1]);
        if (percentage <= 10) return 'Low';
        if (percentage <= 25) return 'Medium';
        return 'High';
      }
      
        // Check for "about X%" or plain "X%" pattern
        const percentMatch = text.match(/about\s+(\d+)\s*%|(\d+)\s*%/);
      if (percentMatch) {
        const percentage = parseInt(percentMatch[1] || percentMatch[2]);
        if (percentage < 10) return 'Low';
        if (percentage < 25) return 'Medium';
        return 'High';
      }
      // Fallback to keyword matching
      if (text.includes('high')) return 'High';
      if (text.includes('low')) return 'Low';
      if (text.includes('medium') || text.includes('moderate')) return 'Medium';
      // Default to Low if no clear indicator
        return 'Low';
    })();

    if (!name || name === 'Error') {
      logger.warn(`Scraping failed - ${url}: Scraping returned no valid name`);
      res.status(400).json({ error: 'Could not extract tea information. Please try entering it manually.' });
      return;
    }

    const normalizedResponse = {
      name,
      type: normalizeTeaType(type),
      image,
      steepTimes,
      caffeine,
      caffeineLevel,
      website: url,
      brewingTemperature,
      teaWeight
    };

    const scrapingDuration = Date.now() - scrapingStartTime;
    logger.info(`Successfully scraped tea data from ${url}: ${name} (${scrapingDuration}ms)`);
    res.json(normalizedResponse);

  } catch (error) {
    logger.error(`Scraping failed - ${url}: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ error: 'Failed to scrape URL', details: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.get('/api/teas', (req, res) => {
  try {
    const teas = readTeas();
    logger.info(`Retrieved ${teas.length} teas from collection`);
    res.json(teas);
  } catch (error) {
    logger.error(`Failed to read teas.yaml - ${error instanceof Error ? error.message : String(error)}`);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ error: 'Failed to read tea collection', details: errorMessage });
  }
});

app.post('/api/teas', (req, res) => {
  try {
    // Validate request body first
    if (!req.body) {
      res.status(400).json({ error: 'Request body is required' });
      return;
    }

    let teas;
    try {
      teas = readTeas();
    } catch (readError) {
      logger.error(`Failed to read teas.yaml - ${readError instanceof Error ? readError.message : String(readError)}`);
      res.status(500).json({ error: 'Failed to read existing tea collection', details: readError instanceof Error ? readError.message : 'Unknown error' });
      return;
    }

    // Normalize tea type before validation
    const normalizedData = {
      ...req.body,
      type: normalizeTeaType(req.body.type)
    };

    // Validate request body
    let newTeaData;
    try {
      const createTeaData = CreateTeaSchema.parse(normalizedData);
      // Add required fields with their defaults
      newTeaData = {
        ...createTeaData,
        timesConsumed: createTeaData.timesConsumed ?? 0,
        lastConsumedDate: createTeaData.lastConsumedDate ?? null
      };
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        logger.warn(`Tea validation failed - Tea data validation failed: ${JSON.stringify(validationError.issues)}`);
        res.status(400).json({ error: 'Invalid tea data', details: validationError.issues });
      } else {
        logger.error(`Tea validation failed - ${validationError instanceof Error ? validationError.message : String(validationError)}`);
        res.status(400).json({ error: 'Failed to validate tea data', details: validationError instanceof Error ? validationError.message : 'Unknown validation error' });
      }
      return;
    }

    const newTea: Tea = { ...newTeaData, id: Date.now().toString() };
    teas.push(newTea);

    try {
      writeTeas(teas);
      logger.info(`Tea created - id: ${newTea.id}, name: "${newTea.name}"`);
      res.status(201).json(newTea);
    } catch (writeError) {
      logger.error(`Failed to write teas.yaml - ${writeError instanceof Error ? writeError.message : String(writeError)}`);
      res.status(500).json({ error: 'Failed to save tea', details: writeError instanceof Error ? writeError.message : 'Unknown error' });
    }
  } catch (error) {
    logger.error(`Unexpected error in POST /api/teas: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ error: 'An unexpected error occurred while saving tea', details: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.get('/api/teas/export', (req, res) => {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      logger.warn('Export failed - Data file not found');
      res.status(404).json({ error: 'Tea data file not found' });
      return;
    }

    res.setHeader('Content-Type', 'text/yaml');
    res.setHeader('Content-Disposition', 'attachment; filename=teas.yaml');
    
    const fileStream = fs.createReadStream(DATA_FILE);
    fileStream.pipe(res);
    logger.info('Exported teas.yaml');
  } catch (error) {
    logger.error(`Export failed - ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ error: 'Failed to export tea data' });
  }
});

app.delete('/api/teas/:id', (req, res) => {
  try {
    const teaId = req.params.id;

    if (!teaId) {
      res.status(400).json({ error: 'Tea ID is required' });
      return;
    }

    let teas;
    try {
      teas = readTeas();
    } catch (readError) {
      logger.error(`Failed to read teas.yaml - ${readError instanceof Error ? readError.message : String(readError)}`);
      res.status(500).json({ error: 'Failed to read tea collection', details: readError instanceof Error ? readError.message : 'Unknown error' });
      return;
    }

    const teaToDelete = teas.find(t => t.id === teaId);
    if (!teaToDelete) {
      logger.warn(`Delete failed - tea not found: id ${teaId}`);
      res.status(404).json({ error: 'Tea not found' });
      return;
    }

    const filteredTeas = teas.filter(t => t.id !== teaId);

    try {
      writeTeas(filteredTeas);
      logger.info(`Tea deleted - id: ${teaId}`);
      res.status(204).send();
    } catch (writeError) {
      logger.error(`Failed to write teas.yaml - ${writeError instanceof Error ? writeError.message : String(writeError)}`);
      res.status(500).json({ error: 'Failed to delete tea', details: writeError instanceof Error ? writeError.message : 'Unknown error' });
    }
  } catch (error) {
    logger.error(`Unexpected error in DELETE /api/teas/:id: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ error: 'An unexpected error occurred while deleting tea', details: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Simple PATCH test route
app.patch('/api/test-patch', (req, res) => {
  logger.debug('TEST PATCH route hit');
  res.json({ message: 'PATCH works', body: req.body });
});

app.patch('/api/teas/:id', (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({ error: 'Tea ID is required' });
      return;
    }

    if (!req.body || Object.keys(req.body).length === 0) {
      res.status(400).json({ error: 'Request body is required with at least one field to update' });
      return;
    }

    let teas;
    try {
      teas = readTeas();
    } catch (readError) {
      logger.error(`Failed to read teas.yaml - ${readError instanceof Error ? readError.message : String(readError)}`);
      res.status(500).json({ error: 'Failed to read tea collection', details: readError instanceof Error ? readError.message : 'Unknown error' });
      return;
    }

    const teaIndex = teas.findIndex(t => t.id === id);
    if (teaIndex === -1) {
      logger.warn(`Attempted to update non-existent tea with ID: ${id}`);
      res.status(404).json({ error: 'Tea not found' });
      return;
    }

    // Validate rating if provided
    if ('rating' in req.body) {
      const rating = req.body.rating;
      if (rating !== null && rating !== undefined) {
        if (typeof rating !== 'number') {
          res.status(400).json({ error: 'Invalid rating value', details: 'Rating must be a number or null' });
          return;
        }
        if (rating < 1 || rating > 10) {
          res.status(400).json({ error: 'Invalid rating value', details: 'Rating must be between 1 and 10' });
          return;
        }
      }
    }

    const existingTea = teas[teaIndex];
    const updatedTea: Tea = {
      ...existingTea,
      ...req.body
    };

    // Validate the updated tea against schema
    let validatedTea;
    try {
      validatedTea = TeaSchema.parse(updatedTea);
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        logger.warn(`Tea validation failed - id: ${id} - ${JSON.stringify(validationError.issues)}`);
        res.status(400).json({ error: 'Invalid tea data', details: validationError.issues });
      } else {
        logger.error(`Tea validation failed - id: ${id} - ${validationError instanceof Error ? validationError.message : String(validationError)}`);
        res.status(400).json({ error: 'Failed to validate tea data', details: validationError instanceof Error ? validationError.message : 'Unknown validation error' });
      }
      return;
    }

    teas[teaIndex] = validatedTea;

    try {
      writeTeas(teas);
      logger.info(`Tea updated - id: ${id}, name: "${validatedTea.name}"`);
      res.status(200).json(validatedTea);
    } catch (writeError) {
      logger.error(`Failed to write teas.yaml - ${writeError instanceof Error ? writeError.message : String(writeError)}`);
      res.status(500).json({ error: 'Failed to save tea', details: writeError instanceof Error ? writeError.message : 'Unknown error' });
    }
  } catch (error) {
    logger.error(`Unexpected error in PATCH /api/teas/:id: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ error: 'An unexpected error occurred while updating tea', details: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.put('/api/teas/:id/lastConsumed', (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({ error: 'Tea ID is required' });
      return;
    }

    let teas;
    try {
      teas = readTeas();
    } catch (readError) {
      logger.error(`Failed to read teas.yaml - ${readError instanceof Error ? readError.message : String(readError)}`);
      res.status(500).json({ error: 'Failed to read tea collection', details: readError instanceof Error ? readError.message : 'Unknown error' });
      return;
    }

    const teaIndex = teas.findIndex(t => t.id === id);
    if (teaIndex === -1) {
      logger.warn(`Consumption failed - tea not found: id ${id}`);
      res.status(404).json({ error: 'Tea not found' });
      return;
    }

    const existingTea = teas[teaIndex];
    const updatedTea: Tea = {
      ...existingTea,
      timesConsumed: (existingTea.timesConsumed || 0) + 1,
      lastConsumedDate: Date.now()
    };

    // Validate the updated tea against schema
    let validatedTea;
    try {
      validatedTea = TeaSchema.parse(updatedTea);
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        logger.warn(`Tea validation failed - id: ${id} - ${JSON.stringify(validationError.issues)}`);
        res.status(400).json({ error: 'Invalid tea data', details: validationError.issues });
      } else {
        logger.error(`Tea validation failed - id: ${id} - ${validationError instanceof Error ? validationError.message : String(validationError)}`);
        res.status(400).json({ error: 'Failed to validate tea data', details: validationError instanceof Error ? validationError.message : 'Unknown validation error' });
      }
      return;
    }

    teas[teaIndex] = validatedTea;

    try {
      writeTeas(teas);
      logger.info(`Tea consumed - id: ${id} (count: ${validatedTea.timesConsumed})`);
      res.status(200).json(validatedTea);
    } catch (writeError) {
      logger.error(`Failed to write teas.yaml - ${writeError instanceof Error ? writeError.message : String(writeError)}`);
      res.status(500).json({ error: 'Failed to save tea', details: writeError instanceof Error ? writeError.message : 'Unknown error' });
    }
  } catch (error) {
    logger.error(`Unexpected error in PUT /api/teas/:id/lastConsumed: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ error: 'An unexpected error occurred while updating tea consumption', details: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Serve static files from React build (for production)
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(process.cwd(), 'dist');
  app.use(express.static(distPath));

  // React Router - serve index.html for all non-API routes
  // Using app.use instead of app.get('*') for Express 5 compatibility
  app.use((req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Catch-all route for debugging unmatched requests (Express 5 syntax)
// Temporarily disabled due to path-to-regexp compatibility issue
// app.use('/api/{*splat}', (req, _res, next) => {
//   console.log('[DEBUG] !!! UNMATCHED ROUTE !!!');
//   console.log(`  Method: ${req.method}`);
//   console.log(`  Path: ${req.path}`);
//   console.log(`  URL: ${req.url}`);
//   console.log('  This request did NOT match any registered route.');
//   next();
// });

// Helper function to list all registered routes
const listRoutes = () => {
  const routes: { method: string; path: string }[] = [];

  // Get routes from Express app._router
  if (app._router && app._router.stack) {
    app._router.stack.forEach((middleware: any) => {
      if (middleware.route) {
        // Routes registered directly on the app
        const methods = Object.keys(middleware.route.methods)
          .filter(method => middleware.route.methods[method])
          .map(m => m.toUpperCase());
        methods.forEach(method => {
          routes.push({ method, path: middleware.route.path });
        });
      }
    });
  }

  logger.debug('Registered Express routes', { routes });
};

app.listen(port, '0.0.0.0', async () => {
  const nodeEnv = process.env.NODE_ENV || 'development';
  logger.info(`Tea Timer Server starting on port ${port} (${nodeEnv} mode)`);

  // List all registered routes for debugging
  listRoutes();

  // Validate auth configuration
  validateAuthConfig();

  // Load teas at startup
  try {
    const teas = readTeas();
    logger.info(`Loaded ${teas.length} teas from teas.yaml`);
  } catch (error) {
    logger.error('Failed to load teas at startup:', error instanceof Error ? error.message : String(error));
  }
});
