const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { requireAuth } = require('../middleware/auth.middleware');
const authService = require('../services/auth.service');
const { db } = require('../database/db');

router.get('/stats', requireAuth, async (req, res) => {
  try {
    const [resumes] = await db('resumes')
      .where('user_id', req.user.id)
      .count('* as count');
    
    const [applications] = await db('applications')
      .where('user_id', req.user.id)
      .count('* as count');
    
    const [jobs] = await db('jobs')
      .where('user_id', req.user.id)
      .count('* as count');
    
    res.json({
      success: true,
      stats: {
        resumes: resumes.count || 0,
        applications: applications.count || 0,
        jobs: jobs.count || 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/resumes', requireAuth, async (req, res) => {
  try {
    const resumes = await db('resumes')
      .where('user_id', req.user.id)
      .select('id', 'filename', 'created_at')
      .orderBy('created_at', 'desc');
    
    res.json({ success: true, resumes });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/change-password', requireAuth, [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 8 }),
  body('confirmPassword').custom((value, { req }) => value === req.body.newPassword)
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorHtml = `
      <div class="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded">
        ${errors.array().map(err => err.msg).join('<br>')}
      </div>
    `;
    res.setHeader('Content-Type', 'text/html');
    return res.status(400).send(errorHtml);
  }
  
  try {
    const { currentPassword, newPassword } = req.body;
    await authService.changePassword(req.user.id, currentPassword, newPassword);
    
    const successHtml = `
      <div class="bg-green-900 border border-green-700 text-green-200 px-4 py-3 rounded">
        Password updated successfully!
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

module.exports = router;