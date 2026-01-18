import fs from 'fs';
import path from 'path';

import cors from 'cors';
import express from 'express';
import yaml from 'js-yaml';
import puppeteer, { Browser, HTTPRequest } from 'puppeteer';
import { z } from 'zod';

const app = express();
const port = 3001;

const isDist = __dirname.endsWith('dist');
const DATA_FILE = isDist
  ? path.join(__dirname, '..', 'teas.yaml')
  : path.join(__dirname, 'teas.yaml');

app.use(cors());
app.use(express.json());

const CaffeineLevelSchema = z.enum(['Low', 'Medium', 'High']);
const TeaTypeSchema = z.enum(['Green', 'Black', 'PuEr', 'Yellow', 'White', 'Oolong']);

const TeaSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: TeaTypeSchema,
  image: z.string(),
  steepTimes: z.array(z.number()),
  caffeine: z.string(),
  caffeineLevel: CaffeineLevelSchema,
  website: z.string()
});

type Tea = z.infer<typeof TeaSchema>;

// Normalize tea type to canonical form (handles variations like "pu-er", "Pu-Er", etc.)
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
  if (!fs.existsSync(DATA_FILE)) {
    return [];
  }
  const fileContents = fs.readFileSync(DATA_FILE, 'utf8');
  // Validate data read from file
  try {
     const data = yaml.load(fileContents);
     return z.array(TeaSchema).parse(data);
  } catch (error) {
     console.error("Failed to parse teas.yaml:", error);
     return [];
  }
};

const writeTeas = (teas: Tea[]) => {
  const yamlStr = yaml.dump(teas);
  fs.writeFileSync(DATA_FILE, yamlStr, 'utf8');
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
      console.log('Browser disconnected');
      browserInstance = null;
    });
  }
  return browserInstance;
};

app.post('/api/teas/import', async (req, res) => {
  const { url } = req.body;
  if (!url) {
    res.status(400).json({ error: 'URL is required' });
    return;
  }

  let page;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();
    
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

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 8000 });
    } catch (e) {
      console.log('Navigation timeout or error, proceeding to scrape...');
    }

    // Give extra time for dynamic content to render
    await new Promise(resolve => setTimeout(resolve, 1000));

    const data = await page.evaluate(() => {
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
      const validTypes = ['Green', 'Black', 'PuEr', 'Yellow', 'White', 'Oolong'];

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
                matches.forEach(m => {
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

      // 5. Caffeine Content
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

      return { name, type, image, steepTimes, caffeine, caffeineLevel, website: window.location.href };
      } catch (e) {
        return { name: 'Error', type: '', image: '', steepTimes: [], caffeine: String(e), caffeineLevel: 'Low', website: window.location.href };
      }
    });

    await page.close(); // Only close the page, not the browser

    // Log debug info
    if ('debug' in data && data.debug) {
      console.log('DEBUG STEEP TIMES:');
      (data.debug as string[]).forEach((line: string) => console.log('  ', line));
    }

    // Normalize tea type to canonical form before sending to frontend
    const normalizedResponse = {
      ...data,
      type: normalizeTeaType(data.type)
    };

    res.json(normalizedResponse);

  } catch (error: any) {
    if (page) await page.close();
    console.error('Scraping error:', error);
    res.status(500).json({ error: 'Failed to scrape URL', details: error.message });
  }
});

app.get('/api/teas', (req, res) => {
  try {
    const teas = readTeas();
    res.json(teas);
  } catch {
    res.status(500).json({ error: 'Failed to read teas' });
  }
});

app.post('/api/teas', (req, res) => {
  try {
    const teas = readTeas();

    // Normalize tea type before validation
    const normalizedData = {
      ...req.body,
      type: normalizeTeaType(req.body.type)
    };

    // Validate request body
    const newTeaData = TeaSchema.omit({ id: true }).parse(normalizedData);

    const newTea: Tea = { ...newTeaData, id: Date.now().toString() };
    teas.push(newTea);
    writeTeas(teas);
    res.status(201).json(newTea);
  } catch (error) {
    if (error instanceof z.ZodError) {
       res.status(400).json({ error: 'Invalid tea data', details: error.issues });
    } else {
       res.status(500).json({ error: 'Failed to save tea' });
    }
  }
});

app.delete('/api/teas/:id', (req, res) => {
  try {
    const teas = readTeas();
    const filteredTeas = teas.filter(t => t.id !== req.params.id);
    writeTeas(filteredTeas);
    res.status(204).send();
  } catch {
    res.status(500).json({ error: 'Failed to delete tea' });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  // Pre-load the browser
  getBrowser()
    .then(() => console.log('Browser instance pre-loaded'))
    .catch(err => console.error('Failed to pre-load browser:', err));
});
