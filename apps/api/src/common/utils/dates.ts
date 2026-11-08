const DAY = 24 * 60 * 60 * 1000;

export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);

export const daysUntil = (d: Date, from = new Date()) =>
  Math.ceil((d.getTime() - from.getTime()) / DAY);
