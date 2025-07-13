const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const authService = require('../services/auth.service');
const { requireAuth } = require('../middleware/auth.middleware');
const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts, please try again later'
});

const validateRegistration = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('confirmPassword').custom((value, { req }) => value === req.body.password)
    .withMessage('Passwords do not match'),
  body('name').trim().notEmpty()
];

const validateLogin = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
];

router.post('/register', validateRegistration, async (req, res) => {
  console.log('Registration request body:', req.body);
  console.log('Password length:', req.body.password?.length);
  console.log('Passwords match:', req.body.password === req.body.confirmPassword);
  
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('Validation errors:', errors.array());
    const errorHtml = `
      <div class="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded">
        ${errors.array().map(err => `${err.path}: ${err.msg}`).join('<br>')}
      </div>
    `;
    res.setHeader('Content-Type', 'text/html');
    return res.status(400).send(errorHtml);
  }
  
  try {
    const { email, password, name } = req.body;
    const user = await authService.register(email, password, name);
    
    const successHtml = `
      <div class="bg-green-900 border border-green-700 text-green-200 px-4 py-3 rounded">
        Account created successfully! Redirecting to login...
      </div>
    `;
    res.setHeader('Content-Type', 'text/html');
    res.send(successHtml);
  } catch (error) {
    const errorHtml = `
      <div class="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded">
        ${error.message}
      </div>
    `;
    res.setHeader('Content-Type', 'text/html');
    res.status(400).send(errorHtml);
  }
});

router.post('/login', loginLimiter, validateLogin, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorHtml = `
      <div class="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded">
        Invalid email or password
      </div>
    `;
    res.setHeader('Content-Type', 'text/html');
    return res.status(400).send(errorHtml);
  }
  
  try {
    const { email, password } = req.body;
    const { sessionId, user } = await authService.login(email, password);
    
    res.cookie('sessionId', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000
    });
    
    const successHtml = `
      <div class="bg-green-900 border border-green-700 text-green-200 px-4 py-3 rounded">
        Login successful! Redirecting...
      </div>
    `;
    
    res.send(successHtml);
  } catch (error) {
    const errorHtml = `
      <div class="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded">
        ${error.message}
      </div>
    `;
    res.setHeader('Content-Type', 'text/html');
    res.status(401).send(errorHtml);
  }
});

router.post('/logout', requireAuth, async (req, res) => {
  try {
    await authService.logout(req.sessionId);
    res.clearCookie('sessionId');
    
    if (req.headers['hx-request']) {
      res.setHeader('HX-Redirect', '/auth/login');
      res.send('');
    } else {
      res.redirect('/auth/login');
    }
  } catch (error) {
    res.status(500).json({ error: 'Logout failed' });
  }
});

router.get('/check', async (req, res) => {
  const sessionId = req.cookies?.sessionId;
  if (!sessionId) {
    return res.json({ authenticated: false });
  }
  
  try {
    const user = await authService.validateSession(sessionId);
    res.json({ 
      authenticated: !!user, 
      user: user ? { 
        id: user.id, 
        email: user.email, 
        name: user.name,
        created_at: user.created_at 
      } : null 
    });
  } catch (error) {
    res.json({ authenticated: false });
  }
});

module.exports = router;