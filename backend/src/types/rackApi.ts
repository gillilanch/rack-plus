import { z } from 'zod';

const portDirection = z.enum(['input', 'output', 'both']);

export const portSchema = z.object({
  type: z.string(),
  direction: portDirection,
  label: z.string().optional(),
  count: z.number().int().positive().optional(),
});

export const rackConnectionSchema = z.object({
  id: z.string(),
  fromDeviceId: z.string(),
  fromPort: portSchema,
  toDeviceId: z.string(),
  toPort: portSchema,
  cableType: z.string(),
  estimatedLength: z.number(),
  adapters: z.array(z.string()).optional(),
  minCableLengthInches: z.number().optional(),
  extraSlackInches: z.number().optional(),
  cableStyle: z.enum(['suggested', 'manual']).optional(),
  routeFromEdge: z.enum(['left', 'right']).optional(),
  routeToEdge: z.enum(['left', 'right']).optional(),
  routeFromYRatio: z.number().min(0).max(1).optional(),
  routeToYRatio: z.number().min(0).max(1).optional(),
});

export const rackDeviceSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  heightInU: z.number().int().positive(),
  rackPosition: z.number().int().min(0).optional(),
  physicalHeightInches: z.number().optional(),
  ports: z.array(portSchema),
});

const inchesPerRUSchema = z.number().positive().max(48);

/** Body for POST /api/racks (no rack id yet). */
export const createRackBodySchema = z.object({
  name: z.string().min(1),
  totalHeight: z.number().int().positive(),
  inchesPerRU: inchesPerRUSchema.optional().default(1.75),
  rackWidthInches: z.number().positive().max(120).optional().default(19),
  slackAllowance: z.number(),
  devices: z.array(rackDeviceSchema),
  connections: z.array(rackConnectionSchema),
});

/** Body for PUT /api/racks/:id */
export const updateRackBodySchema = z.object({
  name: z.string().min(1),
  totalHeight: z.number().int().positive(),
  inchesPerRU: inchesPerRUSchema.optional().default(1.75),
  rackWidthInches: z.number().positive().max(120).optional().default(19),
  slackAllowance: z.number(),
  devices: z.array(rackDeviceSchema),
  connections: z.array(rackConnectionSchema),
});

export type CreateRackBody = z.infer<typeof createRackBodySchema>;
export type UpdateRackBody = z.infer<typeof updateRackBodySchema>;
