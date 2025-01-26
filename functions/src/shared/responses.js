// shared/responses.js
/**
 * Formats a successful response.
 * @param {any} data - The data to be returned.
 * @param {string} [message] - Optional message.
 * @returns {object} - Formatted response object.
 */
function formatSuccessResponse(data, message = 'Success') {
    return {
        status: 'success',
        message,
        data
    };
}

/**
 * Formats an error response.
 * @param {string} message - The error message.
 * @param {number} [statusCode=500] - The HTTP status code.
 * @param {any} [details] - Optional error details.
 * @returns {object} - Formatted error response object.
 */
function formatErrorResponse(message, statusCode = 500, details = null) {
    return {
        status: 'error',
        statusCode,
        message,
        details
    };
}

module.exports = {
    formatSuccessResponse,
    formatErrorResponse
};