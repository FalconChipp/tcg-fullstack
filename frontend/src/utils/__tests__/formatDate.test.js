import { formatDate, formatRelativeTime } from '../formatDate';

jest.mock('../devLog', () => ({
  devWarn: jest.fn(),
  devError: jest.fn(),
}));

describe('formatDate', () => {
  test('returns "Unknown" for null input', () => {
    expect(formatDate(null)).toBe('Unknown');
  });

  test('returns "Unknown" for empty string', () => {
    expect(formatDate('')).toBe('Unknown');
  });

  test('returns "Unknown" for undefined', () => {
    expect(formatDate(undefined)).toBe('Unknown');
  });

  test('returns "Invalid Date" for a garbage string', () => {
    expect(formatDate('not-a-date')).toBe('Invalid Date');
  });

  test('formats a valid ISO date string', () => {
    const result = formatDate('2024-01-15T00:00:00.000Z');
    expect(result).toMatch(/Jan/i);
    expect(result).toMatch(/2024/);
    expect(result).toMatch(/15/);
  });

  test('does not include time by default', () => {
    const result = formatDate('2024-06-01T14:30:00.000Z');
    expect(result).not.toMatch(/:/);
  });

  test('includes time when includeTime is true', () => {
    const result = formatDate('2024-06-01T14:30:00.000Z', { includeTime: true });
    expect(result).toMatch(/:/);
  });
});

describe('formatRelativeTime', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('returns "Unknown" for null', () => {
    expect(formatRelativeTime(null)).toBe('Unknown');
  });

  test('returns "Unknown" for empty string', () => {
    expect(formatRelativeTime('')).toBe('Unknown');
  });

  test('returns "Invalid Date" for garbage input', () => {
    expect(formatRelativeTime('bad')).toBe('Invalid Date');
  });

  test('returns "just now" for recent timestamps', () => {
    const now = new Date('2024-06-01T12:00:00.000Z');
    jest.setSystemTime(now);
    const thirtySecondsAgo = new Date(now.getTime() - 30_000).toISOString();
    expect(formatRelativeTime(thirtySecondsAgo)).toBe('just now');
  });

  test('returns minutes ago', () => {
    const now = new Date('2024-06-01T12:00:00.000Z');
    jest.setSystemTime(now);
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
    expect(formatRelativeTime(fiveMinutesAgo)).toBe('5 minutes ago');
  });

  test('returns "1 minute ago" (singular)', () => {
    const now = new Date('2024-06-01T12:00:00.000Z');
    jest.setSystemTime(now);
    const oneMinuteAgo = new Date(now.getTime() - 90 * 1000).toISOString();
    expect(formatRelativeTime(oneMinuteAgo)).toBe('1 minute ago');
  });

  test('returns hours ago', () => {
    const now = new Date('2024-06-01T12:00:00.000Z');
    jest.setSystemTime(now);
    const twoHoursAgo = new Date(now.getTime() - 2 * 3600 * 1000).toISOString();
    expect(formatRelativeTime(twoHoursAgo)).toBe('2 hours ago');
  });

  test('returns "1 hour ago" (singular)', () => {
    const now = new Date('2024-06-01T12:00:00.000Z');
    jest.setSystemTime(now);
    const oneHourAgo = new Date(now.getTime() - 3700 * 1000).toISOString();
    expect(formatRelativeTime(oneHourAgo)).toBe('1 hour ago');
  });

  test('returns days ago', () => {
    const now = new Date('2024-06-01T12:00:00.000Z');
    jest.setSystemTime(now);
    const threeDaysAgo = new Date(now.getTime() - 3 * 86400 * 1000).toISOString();
    expect(formatRelativeTime(threeDaysAgo)).toBe('3 days ago');
  });

  test('returns weeks ago', () => {
    const now = new Date('2024-06-01T12:00:00.000Z');
    jest.setSystemTime(now);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 86400 * 1000).toISOString();
    expect(formatRelativeTime(twoWeeksAgo)).toBe('2 weeks ago');
  });

  test('returns months ago', () => {
    const now = new Date('2024-06-01T12:00:00.000Z');
    jest.setSystemTime(now);
    const twoMonthsAgo = new Date(now.getTime() - 60 * 86400 * 1000).toISOString();
    expect(formatRelativeTime(twoMonthsAgo)).toBe('2 months ago');
  });

  test('returns years ago', () => {
    const now = new Date('2024-06-01T12:00:00.000Z');
    jest.setSystemTime(now);
    const twoYearsAgo = new Date(now.getTime() - 730 * 86400 * 1000).toISOString();
    expect(formatRelativeTime(twoYearsAgo)).toBe('2 years ago');
  });
});
