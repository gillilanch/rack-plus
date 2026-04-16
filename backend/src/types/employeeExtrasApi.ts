import { z } from 'zod';

export const employeeExtraBodySchema = z.object({
  name: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(1, 'Name is required.').max(200, 'Name is too long.')),
});
