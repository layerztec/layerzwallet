import BigNumber from 'bignumber.js';

// Invalid input (empty or half-typed amounts, missing values) yields NaN instead of throwing.
// Import this before any other module that uses BigNumber.
BigNumber.config({ STRICT: false });
