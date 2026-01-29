import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import logger from './logger';

// Environment variable validation
const getAuthConfig = () => {
  const username = process.env.ADMIN_USERNAME;
  const passwordHash = process.env.ADMIN_PASSWORD_HASH;
  const jwtSecret = process.env.JWT_SECRET;

  if (!username || !passwordHash || !jwtSecret) {
    const missing = [];
    if (!username) missing.push('ADMIN_USERNAME');
    if (!passwordHash) missing.push('ADMIN_PASSWORD_HASH');
    if (!jwtSecret) missing.push('JWT_SECRET');
    throw new Error(`Missing required auth environment variables: ${missing.join(', ')}`);
  }

  return { username, passwordHash, jwtSecret };
};

// JWT token expiry (30 days in seconds)
const TOKEN_EXPIRY = 30 * 24 * 60 * 60;

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: { username: string };
    }
  }
}

// Login handler
export const login = async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: 'Username and password are required' });
    return;
  }

  try {
    const config = getAuthConfig();

    // Check username
    if (username !== config.username) {
      logger.warn(`Failed login attempt for username: ${username}`);
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    // Check password
    const passwordValid = await bcrypt.compare(password, config.passwordHash);
    if (!passwordValid) {
      logger.warn(`Failed login attempt - invalid password for username: ${username}`);
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    // Generate JWT
    const token = jwt.sign(
      { username: config.username },
      config.jwtSecret,
      { expiresIn: TOKEN_EXPIRY }
    );

    logger.info(`Successful login for username: ${username}`);
    res.json({ token });
  } catch (error) {
    logger.error('Login error:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Auth middleware
export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authorization token required' });
    return;
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix

  try {
    const config = getAuthConfig();
    const decoded = jwt.verify(token, config.jwtSecret) as { username: string };
    req.user = { username: decoded.username };
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'Token expired' });
    } else if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ error: 'Invalid token' });
    } else {
      logger.error('Auth middleware error:', error instanceof Error ? error.message : String(error));
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};

// Validate auth config on startup
export const validateAuthConfig = (): void => {
  try {
    getAuthConfig();
    logger.info('Auth configuration validated');
  } catch (error) {
    logger.error('Auth configuration error:', error);
    process.exit(1);
  }
};
