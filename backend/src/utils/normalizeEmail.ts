/** Canonical form for storing/comparing emails — prevents silent lookup
 * misses caused by case differences (e.g. signup with "Foo@Bar.com",
 * later login/reset attempted with "foo@bar.com"). Always normalize on
 * write (before storing) AND on read (before querying by email). */
export const normalizeEmail = (email: string) => email.trim().toLowerCase();