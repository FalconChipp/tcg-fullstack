// Dev-only logging — no-ops in production so debug noise never reaches users.
// Usage: import { devLog, devWarn, devError } from "@/utils/devLog";

const isDev = process.env.NODE_ENV !== "production";

/* eslint-disable no-console */
export const devLog   = isDev ? console.log.bind(console)   : () => {};
export const devWarn  = isDev ? console.warn.bind(console)  : () => {};
export const devError = isDev ? console.error.bind(console) : () => {};
/* eslint-enable no-console */
