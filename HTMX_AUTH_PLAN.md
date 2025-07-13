# HTMX Authentication Implementation Plan

## Overview
Transform the job application bot into a multi-user system with secure authentication using HTMX.

## Architecture Design

### 1. Authentication Strategy
- **Method**: Cookie-based sessions (recommended for HTMX)
- **Session Store**: Redis (already have it for queues)
- **Password Hashing**: bcrypt
- **CSRF Protection**: Double Submit Cookie pattern
- **Remember Me**: Optional persistent sessions

### 2. Database Schema Updates

```sql
-- Users table
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  email_verified BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE
);

-- Sessions table
CREATE TABLE sessions (
  id VARCHAR(255) PRIMARY KEY,
  user_id INTEGER NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Update existing tables
ALTER TABLE resumes ADD COLUMN user_id INTEGER REFERENCES users(id);
ALTER TABLE jobs ADD COLUMN user_id INTEGER REFERENCES users(id);
ALTER TABLE applications ADD COLUMN user_id INTEGER REFERENCES users(id);
```

### 3. HTMX Setup

#### Installation
```html
<!-- In index.html -->
<script src="https://unpkg.com/htmx.org@1.9.10"></script>
<script src="https://unpkg.com/htmx.org/dist/ext/response-targets.js"></script>
```

#### Configuration
```javascript
// htmx config
htmx.config.defaultSwapStyle = 'innerHTML';
htmx.config.historyCacheSize = 0; // Disable for auth pages
```

### 4. Page Structure

```
/auth/login.html    - Login page
/auth/register.html - Registration page
/dashboard.html     - Main app (protected)
/index.html        - Landing page
```

### 5. Authentication Flow

#### Login Form (HTMX)
```html
<form hx-post="/api/auth/login" 
      hx-target="#errors" 
      hx-target-error="#errors"
      hx-swap="innerHTML">
  <input type="email" name="email" required>
  <input type="password" name="password" required>
  <button type="submit">Login</button>
  <div id="errors"></div>
</form>
```

#### Registration Form
```html
<form hx-post="/api/auth/register" 
      hx-target="#message"
      hx-swap="innerHTML">
  <input type="text" name="name" required>
  <input type="email" name="email" required>
  <input type="password" name="password" required>
  <input type="password" name="confirmPassword" required>
  <button type="submit">Register</button>
  <div id="message"></div>
</form>
```

### 6. Middleware Implementation

```javascript
// auth.middleware.js
const requireAuth = async (req, res, next) => {
  const sessionId = req.cookies.sessionId;
  
  if (!sessionId) {
    if (req.headers['hx-request']) {
      res.setHeader('HX-Redirect', '/auth/login');
      return res.status(401).end();
    }
    return res.redirect('/auth/login');
  }
  
  // Validate session from Redis
  const session = await getSession(sessionId);
  if (!session) {
    res.clearCookie('sessionId');
    res.setHeader('HX-Redirect', '/auth/login');
    return res.status(401).end();
  }
  
  req.user = session.user;
  next();
};
```

### 7. API Endpoints

```javascript
// Authentication routes
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/check
POST   /api/auth/forgot-password
POST   /api/auth/reset-password

// Protected routes (require auth)
GET    /api/user/profile
PUT    /api/user/profile
GET    /api/user/resumes
GET    /api/user/applications
```

### 8. Security Features

#### CSRF Protection
```javascript
// Generate token on session creation
const csrfToken = crypto.randomBytes(32).toString('hex');

// Validate on state-changing requests
const validateCSRF = (req, res, next) => {
  const token = req.headers['x-csrf-token'] || req.body._csrf;
  if (token !== req.session.csrfToken) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  next();
};
```

#### Rate Limiting
```javascript
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: 'Too many login attempts'
});
```

### 9. HTMX Patterns

#### Progressive Enhancement
```html
<!-- Works without JS -->
<form action="/api/auth/login" method="POST"
      hx-boost="true"
      hx-target="body">
```

#### Loading States
```html
<button hx-post="/api/auth/login" 
        hx-indicator="#spinner">
  <span>Login</span>
  <span id="spinner" class="htmx-indicator">
    <i class="spinner"></i>
  </span>
</button>
```

#### Error Handling
```html
<div hx-post="/api/auth/login"
     hx-target-4xx="#errors"
     hx-target-5xx="#server-error">
```

### 10. User Dashboard

```html
<!-- Dashboard with HTMX navigation -->
<div class="dashboard">
  <nav>
    <a hx-get="/dashboard/resumes" hx-target="#content">My Resumes</a>
    <a hx-get="/dashboard/jobs" hx-target="#content">Saved Jobs</a>
    <a hx-get="/dashboard/applications" hx-target="#content">Applications</a>
  </nav>
  
  <div id="content" hx-get="/dashboard/overview" hx-trigger="load">
    <!-- Content loads here -->
  </div>
</div>
```

## Implementation Steps

1. **Install Dependencies**
   ```bash
   npm install express-session connect-redis bcrypt
   npm install express-validator cookie-parser
   npm install express-rate-limit
   ```

2. **Update Database Schema**
   - Run migrations to add user tables
   - Add user_id to existing tables

3. **Create Auth Pages**
   - Convert to HTMX-powered forms
   - Add loading indicators
   - Implement error handling

4. **Build Auth API**
   - Registration with validation
   - Login with session creation
   - Logout with session cleanup

5. **Add Middleware**
   - Authentication checks
   - CSRF protection
   - Rate limiting

6. **Update Existing Features**
   - Scope resumes to users
   - Scope jobs/applications to users
   - Update UI for multi-user

## Benefits of HTMX

1. **No JSON APIs needed** - Return HTML fragments
2. **Progressive enhancement** - Works without JavaScript
3. **Simpler state management** - Server handles all state
4. **Better SEO** - Server-rendered content
5. **Reduced complexity** - No frontend framework needed

## Security Checklist

- [ ] Use HTTPS in production
- [ ] Set secure cookie flags
- [ ] Implement CSRF protection
- [ ] Add rate limiting
- [ ] Validate all inputs
- [ ] Escape all outputs
- [ ] Use parameterized queries
- [ ] Hash passwords with bcrypt
- [ ] Implement session timeout
- [ ] Add account lockout after failed attempts