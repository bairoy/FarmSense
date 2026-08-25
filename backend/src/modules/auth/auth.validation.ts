import { z } from "zod";

/**
 * Signup and login input.
 *
 * `email` is validated as an address rather than a bare string. Supabase will
 * reject a malformed one anyway, but it does so from inside `createUser`, which
 * surfaces to the farmer as a generic 500 rather than "that is not a valid
 * email address". Catching it at the boundary is the difference between a
 * usable error and a mystery.
 *
 * The password floor is deliberately only a length. Composition rules (a digit,
 * a symbol, a capital) push people towards `Password1!` and are worse than
 * length alone; Supabase enforces its own project-level policy on top of this.
 */
// Trim and lowercase BEFORE validating, not after. Chaining `.trim()` onto
// `z.email()` runs the check first, so " a@b.co " - what a phone keyboard
// produces when it autocompletes with a trailing space - would be rejected as
// malformed instead of cleaned up.
const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address"));

export const signupSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  email,
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const loginSchema = z.object({
  email,
  // No length floor on login: an old account may predate any rule we add, and
  // rejecting it here would report a validation error where the real answer is
  // "those credentials are wrong".
  password: z.string().min(1, "Password is required"),
});
