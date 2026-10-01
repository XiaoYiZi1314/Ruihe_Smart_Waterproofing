function isValidId(value) {
  return (typeof value === 'string' || typeof value === 'number') &&
    /^[1-9]\d*$/.test(String(value)) && Number.isSafeInteger(Number(value));
}

module.exports = { isValidId };
