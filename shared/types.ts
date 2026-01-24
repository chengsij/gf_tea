import { z } from 'zod';
import { TEA_TYPES, CAFFEINE_LEVELS, BREWING_METHODS } from './constants';

// Strict schema for tea type enum
export const TeaTypeSchema = z.enum(TEA_TYPES);
export type TeaType = z.infer<typeof TeaTypeSchema>;

// Strict schema for caffeine level enum
export const CaffeineLevelSchema = z.enum(CAFFEINE_LEVELS);
export type CaffeineLevel = z.infer<typeof CaffeineLevelSchema>;

// Schema for brewing methods
export const BrewingMethodSchema = z.enum(BREWING_METHODS);
export type BrewingMethod = z.infer<typeof BrewingMethodSchema>;

// Complete tea object schema - strict validation
export const TeaSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: TeaTypeSchema,
  image: z.string(),
  steepTimes: z.array(z.number()),
  caffeine: z.string(),
  caffeineLevel: CaffeineLevelSchema,
  website: z.string(),
  brewingTemperature: z.string(),
  teaWeight: z.string(),
  rating: z.number().min(1).max(10).nullable().optional(),
  timesConsumed: z.number().int().min(0).default(0),
  lastConsumedDate: z.number().nullable().default(null)
});

export type Tea = z.infer<typeof TeaSchema>;

// Schema for creating new teas (allows subset of required fields initially)
export const CreateTeaSchema = z.object({
  name: z.string(),
  type: TeaTypeSchema,
  image: z.string(),
  steepTimes: z.array(z.number()),
  caffeine: z.string().optional().default(''),
  caffeineLevel: CaffeineLevelSchema.optional().default('Low'),
  website: z.string().optional().default(''),
  brewingTemperature: z.string().optional().default(''),
  teaWeight: z.string().optional().default(''),
  rating: z.number().min(1).max(10).nullable().optional(),
  timesConsumed: z.number().int().min(0).optional().default(0),
  lastConsumedDate: z.number().nullable().optional().default(null)
});

// For stricter TypeScript compatibility with exactOptionalPropertyTypes
// We define CreateTea to explicitly make these fields optional (with ?)
export type CreateTea = Omit<z.infer<typeof CreateTeaSchema>, 'timesConsumed' | 'lastConsumedDate'> & {
  timesConsumed?: number;
  lastConsumedDate?: number | null;
};
