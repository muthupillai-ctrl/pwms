import Joi from 'joi';

export const registerSchema = Joi.object({
  email: Joi.string().email().lowercase().trim().required(),
  password: Joi.string()
    .min(8)
    .max(72)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
    .required()
    .messages({
      'string.pattern.base':
        'Password must contain uppercase, lowercase, number and special character (@$!%*?&)',
    }),
  fullName: Joi.string().min(2).max(100).trim().required(),
  phone: Joi.string()
    .pattern(/^\+?[1-9]\d{9,14}$/)
    .optional()
    .messages({ 'string.pattern.base': 'Invalid phone number format' }),
});

export const loginSchema = Joi.object({
  email: Joi.string().email().lowercase().trim().required(),
  password: Joi.string().required(),
});

export const refreshSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

export const logoutSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

export const mfaVerifySchema = Joi.object({
  token: Joi.string().length(6).pattern(/^\d+$/).required().messages({
    'string.length': 'TOTP token must be exactly 6 digits',
    'string.pattern.base': 'TOTP token must be numeric',
  }),
});

export const mfaConfirmSchema = Joi.object({
  token: Joi.string().length(6).pattern(/^\d+$/).required(),
});

export const mfaDisableSchema = Joi.object({
  password: Joi.string().required(),
});

export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string()
    .min(8)
    .max(72)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
    .required(),
});

export const initiateRegisterSchema = Joi.object({
  email: Joi.string().email().lowercase().trim().required(),
  password: Joi.string()
    .min(8)
    .max(72)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
    .required()
    .messages({
      'string.pattern.base':
        'Password must contain uppercase, lowercase, number and special character (@$!%*?&)',
    }),
  fullName: Joi.string().min(2).max(100).trim().required(),
  phone: Joi.string()
    .pattern(/^\+?[1-9]\d{9,14}$/)
    .optional()
    .messages({ 'string.pattern.base': 'Invalid phone number format' }),
});

export const verifyRegisterOtpSchema = Joi.object({
  email: Joi.string().email().lowercase().trim().required(),
  otp:   Joi.string().length(6).pattern(/^\d+$/).required().messages({
    'string.length':       'OTP must be 6 digits',
    'string.pattern.base': 'OTP must be numeric',
  }),
});
