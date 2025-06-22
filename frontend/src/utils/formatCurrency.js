export const formatCurrency = (
  amount,
  currency = 'GBP',
  locale = 'en-GB'
) => {
  if (amount === null || amount === undefined) return '';
  amount = parseFloat(amount);
  if (isNaN(amount)) return '';

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};
