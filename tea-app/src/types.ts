import { z } from 'zod';

export const CaffeineLevelSchema = z.enum(['Low', 'Medium', 'High']);
export type CaffeineLevel = z.infer<typeof CaffeineLevelSchema>;

export const TeaSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  image: z.string(),
  steepTimes: z.array(z.number()),
  caffeine: z.string(),
  caffeineLevel: CaffeineLevelSchema,
  website: z.string(),
  brewingTemperature: z.string(),
  teaWeight: z.string()
});

export type Tea = z.infer<typeof TeaSchema>;
