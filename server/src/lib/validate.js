import { z } from 'zod';

export { z };

export function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const issue = result.error.issues[0];
      const field = issue?.path?.join('.') || '';
      return res.status(400).json({
        error: issue?.message || 'داده ورودی نامعتبر است.',
        field,
        issues: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    req[source] = result.data;
    next();
  };
}

export const faMessages = {
  required: 'این فیلد الزامی است.',
  email: 'ایمیل معتبر نیست.',
  min: (n) => `حداقل ${n} کاراکتر وارد کنید.`,
  max: (n) => `حداکثر ${n} کاراکتر مجاز است.`,
};

export const str = (min = 1, max = 500) =>
  z.string({ required_error: faMessages.required, invalid_type_error: faMessages.required })
    .trim()
    .min(min, faMessages.min(min))
    .max(max, faMessages.max(max));

export const optStr = (max = 500) => z.string().trim().max(max, faMessages.max(max)).optional().nullable().transform((v) => (v === undefined || v === null || v === '' ? null : v));

export const idParam = z.object({ id: z.coerce.number().int().positive() });

export const boolish = z.union([z.boolean(), z.string(), z.number()]).transform((v) => v === true || v === 'true' || v === '1' || v === 1);

export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
