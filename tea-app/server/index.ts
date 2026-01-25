import fs from 'fs';
import path from 'path';

import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import yaml from 'js-yaml';
import puppeteer, { Browser, HTTPRequest } from 'puppeteer';
import { z } from 'zod';

// Import logger and shared types
import logger from './logger';
import { TeaSchema, CreateTeaSchema } from '../../shared/types';
import type { Tea } from '../../shared/types';

// Load environment variables
dotenv.config();

logger.debug('Index.ts loaded and initializing Express server');

const app = express();
const port = 3001;

// Global uncaught exception handler
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', error);
  process.exit(1);
});

const isDist = __dirname.endsWith('dist');
const DATA_FILE = isDist
  ? path.join(__dirname, '..', 'teas.yaml')
  : path.join(__dirname, 'teas.yaml');

// Configure CORS with whitelisted origins
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(origin => origin.trim()) || ['http://localhost:5173'];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'DELETE', 'PATCH', 'PUT'],
  allowedHeaders: ['Content-Type']
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

// Singleton browser instance
let browserInstance: Browser | null = null;

const getBrowser = async () => {
  if (!browserInstance) {
    browserInstance = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    browserInstance.on('disconnected', () => {
      logger.info('Puppeteer browser disconnected unexpectedly');
      browserInstance = null;
    });
  }
  return browserInstance;
};

app.post('/api/teas/import', async (req, res) => {
  const { url } = req.body;
  const scrapingStartTime = Date.now();

  // Validate URL for SSRF attacks
  const urlValidation = validateURLForSSRF(url);
  if (!urlValidation.valid) {
    logger.warn(`Puppeteer scraping failed - ${url}: SSRF validation failed - ${urlValidation.error}`);
    res.status(400).json({ error: urlValidation.error });
    return;
  }

  let page;
  try {
    let browser;
    try {
      browser = await getBrowser();
    } catch (browserError) {
      logger.error(`Puppeteer scraping failed - ${url}: Failed to launch browser - ${browserError instanceof Error ? browserError.message : String(browserError)}`);
      res.status(500).json({ error: 'Failed to initialize browser. Please try again later.' });
      return;
    }

    // Check if browser is connected
    if (!browser || browser.process() === null) {
      logger.error(`Puppeteer scraping failed - ${url}: Browser instance is not connected`);
      browserInstance = null;
      res.status(500).json({ error: 'Browser connection lost. Please try again.' });
      return;
    }

    try {
      page = await browser.newPage();
    } catch (pageError) {
      logger.error(`Puppeteer scraping failed - ${url}: Failed to create new page - ${pageError instanceof Error ? pageError.message : String(pageError)}`);
      res.status(500).json({ error: 'Failed to create browser page. Please try again.' });
      return;
    }
    
    // Optimize: Block unnecessary resources (but allow scripts so page renders properly)
    await page.setRequestInterception(true);
    page.on('request', (req: HTTPRequest) => {
      const resourceType = req.resourceType();
      // Block images, stylesheets, fonts, media to speed up loading
      // Allow scripts and xhr so dynamic content can load
      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.setUserAgent({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    });

    // Navigate to URL with error handling
    let navigationSuccess = false;
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 8000 });
      navigationSuccess = true;
      logger.debug(`Successfully navigated to ${url}`);
    } catch (navigationError) {
      logger.warn(`Puppeteer scraping failed - ${url}: Navigation timed out or failed, attempting to scrape available content - ${navigationError instanceof Error ? navigationError.message : String(navigationError)}`);
      // Continue anyway - some pages may be scrapeable even if they timeout
      navigationSuccess = false;
    }

    if (!navigationSuccess) {
      try {
        // If networkidle2 failed, try with a shorter timeout
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 5000 });
        logger.debug(`Succeeded with domcontentloaded for ${url}`);
      } catch (fallbackError) {
        logger.error(`Puppeteer scraping failed - ${url}: Failed to load page at all - ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`);
        await page.close();
        res.status(400).json({ error: 'Failed to load the URL. Please verify the URL is valid and accessible.' });
        return;
      }
    }

    // Give extra time for dynamic content to render
    await new Promise(resolve => setTimeout(resolve, 1000));

    let data;
    try {
      data = await page.evaluate(() => {
      try {
        // Remove customer reviews section from all processing
        let bodyText = document.body.innerText;

        // Find where reviews section starts and truncate there
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

        // 1. Name
      const name = document.querySelector('h1.page-title')?.textContent?.trim() || document.querySelector('h1')?.textContent?.trim() || '';

      // 2. Image
      let image = document.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';
      if (!image) {
        // Since we block images, we can still get the src attribute from the DOM
        image = document.querySelector('.gallery-placeholder__image')?.getAttribute('src') || '';
      }

      // 3. Type
      let type = '';
      const validTypes = ['Green', 'Black', 'PuEr', 'Yellow', 'White', 'Oolong'] as const;

      const infoTitles = document.querySelectorAll('.info-title');
      infoTitles.forEach(el => {
          if (el.textContent?.includes('Categories')) {
              const containerText = el.parentElement?.textContent || '';
              // Check for standard type names
              validTypes.forEach(t => {
                  if (containerText.includes(t)) {
                      type = t;
                  }
              });
              // Check for pu-er variant if not found
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
           // Check for pu-er variant if not found
           if (!type && (bodyText.includes('pu-er') || bodyText.includes('Pu-Er')) && name.includes('pu')) {
               type = 'PuEr';
           }
      }

      // 4. Steep Times
      const steepTimes: number[] = [];

      // Find the "Recommend Brewing Method" title div and get the table after it
      const titleDivs = document.querySelectorAll('.product-description-title');
      let brewingTable: Element | null = null;

      for (const div of titleDivs) {
        if (div.textContent?.includes('Recommend') && div.textContent?.includes('Brew')) {
          // Find the table that follows this div
          let sibling = div.nextElementSibling;
          while (sibling) {
            if (sibling.tagName === 'TABLE') {
              brewingTable = sibling;
              break;
            }
            sibling = sibling.nextElementSibling;
          }
          break;
        }
      }

      if (brewingTable) {
        // Find the TD element that contains "steeps" keyword
        const tds = brewingTable.querySelectorAll('td');

        for (const td of tds) {
          const tdText = td.innerText;

          // Only process TDs that contain "steeps"
          if (tdText.toLowerCase().includes('steeps')) {
            // Find the colon after "steeps"
            const colonIndex = tdText.toLowerCase().indexOf('steeps:');
            if (colonIndex !== -1) {
              const afterColon = tdText.substring(colonIndex + 7);

              // Extract only the number sequence part, skipping "rinse" and other words
              // Take only the first line after "steeps:", trim it, and remove leading words
              const firstLine = afterColon.split('\n')[0].trim();
              // Remove leading words like "rinse" followed by comma
              const numberSequence = firstLine.replace(/^[a-z]+\s*,\s*/i, '');

              // Extract numbers followed by 's' directly
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
            break; // Only process the first TD with "steeps"
          }
        }
      }

      // Sort by value
      steepTimes.sort((a, b) => a - b);

      // 5. Brewing Temperature and Tea Weight (for Chinese Gongfu Method)
      let brewingTemperature = '';
      let teaWeight = '';

      if (brewingTable) {
        const tds = brewingTable.querySelectorAll('td');

        // Find the index of "Chinese Gongfu Method" to determine column offset
        let gongfuColumnOffset = -1;
        for (let i = 0; i < tds.length; i++) {
          if (tds[i].innerText.toLowerCase().includes('chinese gongfu')) {
            gongfuColumnOffset = i % 2; // 0 for first column, 1 for second column
            break;
          }
        }

        // If gongfu method found in second column (offset 1), extract its temperature and weight
        if (gongfuColumnOffset === 1) {
          // Temperature is typically 2 rows after method header (in the temperature row)
          // Weight is 1 row after temperature (in the weight row)
          for (let i = 0; i < tds.length; i++) {
            const tdText = tds[i].innerText.trim();

            // Look for temperature patterns (with both Fahrenheit and Celsius)
            if (i % 2 === gongfuColumnOffset && tdText.match(/\d+\s*℉\s*\/\s*\d+\s*℃/)) {
              brewingTemperature = tdText;
            }

            // Look for tea weight patterns in gongfu column
            if (i % 2 === gongfuColumnOffset && tdText.match(/\d+\s*g\s*(?:tea)?/i)) {
              teaWeight = tdText;
            }
          }
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
              // Clean up the text
              found = found.replace(/\s+/g, ' ').trim();
              // Remove leading "caffeine" word if present to avoid duplication
              found = found.replace(/^caffeine\s+/i, '').trim();
              // Limit length
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

      return { name, type, image, steepTimes, caffeine, caffeineLevel, website: window.location.href, brewingTemperature, teaWeight };
      } catch (e) {
        return { name: 'Error', type: '', image: '', steepTimes: [], caffeine: String(e), caffeineLevel: 'Low', website: window.location.href, brewingTemperature: '', teaWeight: '' };
      }
    });
    } catch (evaluateError) {
      logger.error(`Puppeteer scraping failed - ${url}: Failed to evaluate page content - ${evaluateError instanceof Error ? evaluateError.message : String(evaluateError)}`);
      await page.close();
      res.status(400).json({ error: 'Failed to extract tea information from the page. The website may not be supported.' });
      return;
    }

    // Check if scraping returned valid data
    if (!data || !data.name || data.name === 'Error') {
      await page.close();
      logger.warn(`Puppeteer scraping failed - ${url}: Scraping returned no valid data`);
      res.status(400).json({ error: 'Could not extract tea information from the URL. Please try a different URL or enter the information manually.' });
      return;
    }

    await page.close(); // Only close the page, not the browser

    // Log debug info
    if ('debug' in data && data.debug) {
      logger.debug('Debug steep times extracted from page', { debugInfo: data.debug });
    }

    // Normalize tea type to canonical form before sending to frontend
    const normalizedResponse = {
      ...data,
      type: normalizeTeaType(data.type)
    };

    // Calculate scraping duration and check for slow scrapes
    const scrapingDuration = Date.now() - scrapingStartTime;
    if (scrapingDuration > 3000) {
      logger.warn(`Slow Puppeteer scrape - ${scrapingDuration}ms for ${url}`);
    } else {
      logger.info(`Successfully scraped tea data from ${url}: ${normalizedResponse.name} (${scrapingDuration}ms)`);
    }
    res.json(normalizedResponse);

  } catch (error: any) {
    if (page) {
      try {
        await page.close();
      } catch (closeError) {
        logger.error(`Puppeteer scraping failed - ${url}: Failed to close page - ${closeError instanceof Error ? closeError.message : String(closeError)}`);
      }
    }
    logger.error(`Puppeteer scraping failed - ${url}: ${error instanceof Error ? error.message : String(error)}`);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred during scraping';
    res.status(500).json({ error: 'Failed to scrape URL', details: errorMessage });
  }
});

app.get('/api/teas', (req, res) => {
  try {
    const teas = readTeas();
    logger.debug(`Retrieved ${teas.length} teas from collection`);
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
  const distPath = path.join(__dirname, '..', '..', 'dist');
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

app.listen(port, '0.0.0.0', () => {
  const nodeEnv = process.env.NODE_ENV || 'development';
  logger.info(`Tea Timer Server starting on port ${port} (${nodeEnv} mode)`);

  // List all registered routes for debugging
  listRoutes();

  // Pre-load the browser
  getBrowser()
    .then(() => logger.info('Puppeteer browser initialized'))
    .catch(err => logger.error('Failed to pre-load browser:', err));

  // Load teas at startup
  try {
    const teas = readTeas();
    logger.info(`Loaded ${teas.length} teas from teas.yaml`);
  } catch (error) {
    logger.error('Failed to load teas at startup:', error instanceof Error ? error.message : String(error));
  }
});
