// middleware.js
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });
const { formatSuccessResponse, formatErrorResponse } = require('./shared/responses');

// Authentication middleware
const authenticateRequest = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json(formatErrorResponse('Unauthorized: No token provided', 401));
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    return next();
  } catch (error) {
    console.error('Error verifying token:', error);
    return res.status(401).json(formatErrorResponse('Unauthorized: Invalid token', 401));
  }
};

// Role-based authorization middleware
const authorize = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json(formatErrorResponse('Unauthorized: No user found', 401));
    }
    const userRole = req.user.role;
    if (roles.includes(userRole)) {
      return next();
    } else {
      return res.status(403).json(formatErrorResponse('Forbidden: Insufficient permissions', 403));
    }
  };
};

// Secure endpoint wrapper
const createSecureEndpoint = (handler, allowedRoles) => {
  return (req, res) => {
    cors(req, res, async () => {
      try {
        await authenticateRequest(req, res, async () => {
          if (allowedRoles && allowedRoles.length > 0) {
            await authorize(allowedRoles)(req, res, async () => {
              const result = await handler(req, res);
              if (result && !res.headersSent) {
                res.json(formatSuccessResponse(result));
              }
            });
          } else {
            const result = await handler(req, res);
            if (result && !res.headersSent) {
              res.json(formatSuccessResponse(result));
            }
          }
        });
      } catch (error) {
        if (!res.headersSent) {
          console.error('Endpoint error:', error);
          res.status(error.statusCode || 500).json(formatErrorResponse(error.message, error.statusCode || 500));
        }
      }
    });
  };
};

module.exports = {
  authenticateRequest,
  authorize,
  createSecureEndpoint
};