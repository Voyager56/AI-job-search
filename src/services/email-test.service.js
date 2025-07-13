const { db } = require('../database/db');
const fs = require('fs').promises;
const path = require('path');

class EmailTestService {
  constructor() {
    this.testMode = process.env.EMAIL_TEST_MODE === 'true' || 
                   (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD);
    
    if (this.testMode) {
      console.log('📧 Email Test Mode: Emails will be saved locally instead of sending');
    }
  }
  
  async sendApplication(applicationData) {
    const { resumeId, jobId, coverLetter, emailTo } = applicationData;
    
    try {
      const resume = await db('resumes')
        .where('id', resumeId)
        .first();
        
      const job = await db('jobs')
        .where('id', jobId)
        .first();
        
      if (!resume || !job) {
        throw new Error('Resume or job not found');
      }
      
      const parsedData = JSON.parse(resume.parsed_data);
      
      const [applicationId] = await db('applications').insert({
        resume_id: resumeId,
        job_id: jobId,
        cover_letter: coverLetter,
        status: 'pending',
        email_to: emailTo
      });
      
      if (this.testMode) {
        const emailContent = {
          from: process.env.GMAIL_USER || 'test@jobbot.com',
          to: emailTo || 'hr@company.com',
          subject: `Application for ${job.title} position - ${parsedData.name}`,
          text: coverLetter,
          html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6;">
              ${coverLetter.replace(/\n/g, '<br>')}
            </div>
          `,
          attachments: [{
            filename: resume.filename,
            size: resume.content.length
          }],
          timestamp: new Date().toISOString()
        };
        
        const emailDir = path.join(process.cwd(), 'test-emails');
        await fs.mkdir(emailDir, { recursive: true });
        
        const emailFile = path.join(emailDir, `email-${applicationId}-${Date.now()}.json`);
        await fs.writeFile(emailFile, JSON.stringify(emailContent, null, 2));
        
        console.log(`📧 Test email saved to: ${emailFile}`);
        console.log(`📄 Subject: ${emailContent.subject}`);
        console.log(`📬 To: ${emailContent.to}`);
        
        const htmlFile = path.join(emailDir, `email-${applicationId}-${Date.now()}.html`);
        const htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <title>${emailContent.subject}</title>
            <style>
              body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
              .header { background: #f0f0f0; padding: 20px; margin-bottom: 20px; }
              .content { line-height: 1.6; }
              .attachment { background: #e0e0e0; padding: 10px; margin-top: 20px; }
            </style>
          </head>
          <body>
            <div class="header">
              <h2>${emailContent.subject}</h2>
              <p><strong>From:</strong> ${emailContent.from}</p>
              <p><strong>To:</strong> ${emailContent.to}</p>
              <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
            </div>
            <div class="content">
              ${emailContent.html}
            </div>
            <div class="attachment">
              <p><strong>Attachment:</strong> ${emailContent.attachments[0].filename}</p>
            </div>
          </body>
          </html>
        `;
        await fs.writeFile(htmlFile, htmlContent);
        
        console.log(`🌐 HTML preview saved to: ${htmlFile}`);
      }
      
      await db('applications')
        .where('id', applicationId)
        .update({
          status: this.testMode ? 'test_sent' : 'sent',
          sent_at: new Date()
        });
        
      return {
        success: true,
        messageId: this.testMode ? `test-${applicationId}` : 'real-message-id',
        applicationId: applicationId,
        testMode: this.testMode
      };
      
    } catch (error) {
      console.error('Email send error:', error);
      throw error;
    }
  }
  
  async getApplicationHistory() {
    const applications = await db('applications')
      .join('resumes', 'applications.resume_id', 'resumes.id')
      .join('jobs', 'applications.job_id', 'jobs.id')
      .select(
        'applications.*',
        'resumes.filename as resume_filename',
        'jobs.title as job_title',
        'jobs.company as job_company'
      )
      .orderBy('applications.created_at', 'desc');
      
    return applications;
  }
}

module.exports = new EmailTestService();