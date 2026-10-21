export function isValidEmail(email: string): boolean
export function passwordProblem(password: string): string | null
export function buildOwnerSql(input: { id: string; email: string; hash: string }): string
