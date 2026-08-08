"use strict";

const { createCorrelationId, sanitizeValue } = require("./diagnosticsLogger");

function serializeError(error, defaults = {}) {
  const source = error && typeof error === "object" ? error : {};
  return {
    code: String(source.code || defaults.code || "UNEXPECTED_ERROR"),
    category: String(source.category || defaults.category || "internal"),
    message: String(source.message || error || defaults.message || "Unexpected error"),
    retryable: Boolean(source.retryable ?? defaults.retryable),
    correlationId: String(
      source.correlationId || defaults.correlationId || createCorrelationId("error"),
    ),
    ...(source.details || defaults.details
      ? { details: sanitizeValue(source.details || defaults.details) }
      : {}),
  };
}

function success(data) {
  return { ok: true, data };
}

function failure(error, defaults) {
  return { ok: false, error: serializeError(error, defaults) };
}

module.exports = { failure, serializeError, success };
