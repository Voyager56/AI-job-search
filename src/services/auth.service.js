const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { db } = require('../database/db');

class AuthService {
  async register(email, password, name) {
    const existingUser = await db('users').where({ email }).first();
    if (existingUser) {
      throw new Error('Email already registered');
    }
    
    const passwordHash = await bcrypt.hash(password, 12);
    
    const [userId] = await db('users').insert({
      email,
      password_hash: passwordHash,
      name,
      email_verified: false,
      is_active: true
    });
    
    return { id: userId, email, name };
  }
  
  async login(email, password) {
    const user = await db('users').where({ email, is_active: true }).first();
    
    if (!user) {
      throw new Error('Invalid credentials');
    }
    
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      throw new Error('Invalid credentials');
    }
    
    const sessionId = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    
    await db('sessions').insert({
      id: sessionId,
      user_id: user.id,
      expires_at: expiresAt
    });
    
    return {
      sessionId,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    };
  }
  
  async logout(sessionId) {
    await db('sessions').where({ id: sessionId }).delete();
  }
  
  async validateSession(sessionId) {
    const session = await db('sessions')
      .join('users', 'sessions.user_id', 'users.id')
      .where('sessions.id', sessionId)
      .where('sessions.expires_at', '>', new Date())
      .select('users.*')
      .first();
      
    return session;
  }
  
  async changePassword(userId, currentPassword, newPassword) {
    const user = await db('users').where({ id: userId }).first();
    
    const isValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValid) {
      throw new Error('Current password is incorrect');
    }
    
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await db('users').where({ id: userId }).update({ password_hash: passwordHash });
    
    await db('sessions').where({ user_id: userId }).delete();
  }
}

module.exports = new AuthService();