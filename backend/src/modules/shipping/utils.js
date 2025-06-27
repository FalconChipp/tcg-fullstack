export function calculateTotalCost(rate) {
  const parsed = parseFloat(rate);
  if (Number.isNaN(parsed)) return 0;
  return parsed + 0.05; // includes EasyPost fee
}
