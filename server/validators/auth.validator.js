import z from "zod"

// auth.validator.js: extract and export the rule
export const passwordRule = z
  .string()
  .min(8, 'Password kam se kam 8 characters ka ho')
  .regex(/[0-9]/, 'Password mein ek number zaroor ho');

// then inside registerSchema: password: passwordRule


export const registerSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2, 'Name should be of minimum 2 characters'),
    email: z.string().trim().toLowerCase().email('Enter Valid email'),
    password: passwordRule
  }),
});


export const loginSchema = z.object({
  body: z.object({
    email: z.string().trim().toLowerCase().email(),
    password: z.string().min(1, 'Password is required'),
  }),
});

