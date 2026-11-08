export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = 'ERROR',
  ) {
    super(message);
  }
}

export const badRequest = (msg: string) => new AppError(400, msg, 'BAD_REQUEST');
export const unauthorized = (msg = 'Please sign in again') => new AppError(401, msg, 'UNAUTHORIZED');
export const forbidden = (msg = 'You do not have access to this') => new AppError(403, msg, 'FORBIDDEN');
export const notFound = (what = 'Resource') => new AppError(404, `${what} not found`, 'NOT_FOUND');
export const conflict = (msg: string) => new AppError(409, msg, 'CONFLICT');
