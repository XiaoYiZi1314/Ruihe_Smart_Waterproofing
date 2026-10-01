function isDefinitiveLoadError(error) {
  return !!error && (error.type === 'session' || [400, 401, 403, 404].includes(error.statusCode));
}

module.exports = { isDefinitiveLoadError };
