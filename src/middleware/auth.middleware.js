const bcrypt = require('bcrypt');
const { db } = require('../database/db');

const requireAuth = async (req, res, next) => {
  const sessionId = req.cookies?.sessionId;
  
  if (!sessionId) {
    if (req.headers['hx-request']) {
      res.setHeader('HX-Redirect', '/auth/login');
      return res.status(401).json({ error: 'Authentication required' });
    }
    return res.redirect('/auth/login');
  }
  
  try {
    const session = await db('sessions')
      .join('users', 'sessions.user_id', 'users.id')
      .where('sessions.id', sessionId)
      .where('sessions.expires_at', '>', new Date())
      .select('users.*', 'sessions.id as session_id')
      .first();
    
    if (!session) {
      res.clearCookie('sessionId');
      if (req.headers['hx-request']) {
        res.setHeader('HX-Redirect', '/auth/login');
        return res.status(401).json({ error: 'Session expired' });
      }
      return res.redirect('/auth/login');
    }
    
    req.user = {
      id: session.id,
      email: session.email,
      name: session.name
    };
    req.sessionId = session.session_id;
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication error' });
  }
};

const optionalAuth = async (req, res, next) => {
  const sessionId = req.cookies?.sessionId;
  
  if (!sessionId) {
    return next();
  }
  
  try {
    const session = await db('sessions')
      .join('users', 'sessions.user_id', 'users.id')
      .where('sessions.id', sessionId)
      .where('sessions.expires_at', '>', new Date())
      .select('users.*')
      .first();
    
    if (session) {
      req.user = {
        id: session.id,
        email: session.email,
        name: session.name,
        created_at: session.created_at
      };
    }
  } catch (error) {
    console.error('Optional auth error:', error);
  }
  
  next();
};

module.exports = {
  requireAuth,
  optionalAuth
};