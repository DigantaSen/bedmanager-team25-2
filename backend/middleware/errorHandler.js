// backend/middleware/errorHandler.js
// Global error handler middleware

/**
 * @desc    Custom error class for operational errors
 */
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * @desc    Global error handler middleware
 * @param   err - Error object
 * @param   req - Request object
 * @param   res - Response object
 * @param   next - Next middleware
 */
const errorHandler = (err, req, res, next) => {
  // Default error values
  let error = { ...err };
  error.message = err.message;
  error.statusCode = err.statusCode || 500;

  // Log error to console in development
  if (process.env.NODE_ENV === 'development') {
    console.error('Error:', err);
  }

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = `Resource not found with id: ${err.value}`;
    error = new AppError(message, 404);
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = `Duplicate field value: ${field}. Please use another value`;
    error = new AppError(message, 409);
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(val => val.message);
    const message = `Invalid input data: ${messages.join(', ')}`;
    error = new AppError(message, 400);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token. Please log in again';
    error = new AppError(message, 401);
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Your token has expired. Please log in again';
    error = new AppError(message, 401);
  }

  // Send response
  res.status(error.statusCode).json({
    success: false,
    message: error.message || 'Server Error',
    ...(process.env.NODE_ENV === 'development' && {
      error: err,
      stack: err.stack
    })
  });
};

/**
 * @desc    Handle 404 - Not Found routes
 * @param   req - Request object
 * @param   res - Response object
 * @param   next - Next middleware
 */
const notFound = (req, res, next) => {
  const message = `Route not found: ${req.method} ${req.originalUrl}`;
  const error = new AppError(message, 404);
  next(error);
};

module.exports = {
  errorHandler,
  notFound,
  AppError
};
