const nodemailer = require('nodemailer');
const { db } = require('../database/db');
const fs = require('fs').promises;
const path = require('path');

class EmailService {
  constructor() {
    this.testMode = false;
    
    if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_APP_PASSWORD
        }
      });
    } else {
      console.log('⚠️  Gmail credentials not found. Running in TEST MODE');
      console.log('📧 Emails will be saved to ./test-emails/ directory');
      this.testMode = true;
    }
  }
  
  async sendApplication(applicationData) {
    if (!this.transporter && !this.testMode) {
      throw new Error('Email service not configured');
    }
    
    const { resumeId, jobId, coverLetter, emailTo, userId } = applicationData;
    
    try {
      console.log(`Looking for resume ID: ${resumeId}, job ID: ${jobId}`);
      
      const resume = await db('resumes')
        .where('id', resumeId)
        .first();
        
      const job = await db('jobs')
        .where('id', jobId)
        .first();
        
      if (!resume || !job) {
        console.error(`Resume found: ${!!resume}, Job found: ${!!job}`);
        console.error(`Resume ID: ${resumeId}, Job ID: ${jobId}`);
        throw new Error(`Resume or job not found - Resume: ${!!resume}, Job: ${!!job}`);
      }
      
      const parsedData = JSON.parse(resume.parsed_data);
      
      const finalCoverLetter = coverLetter || this.generateTemplateCoverLetter(parsedData, job);
      
      const mailOptions = {
        from: process.env.GMAIL_USER,
        to: emailTo || 'hr@company.com',
        subject: `Application for ${job.title} position - ${parsedData.name}`,
        text: finalCoverLetter,
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6;">
            ${finalCoverLetter.replace(/\n/g, '<br>')}
          </div>
        `,
        attachments: [
          {
            filename: resume.filename,
            content: resume.pdf_content || Buffer.from(resume.content),
            contentType: 'application/pdf'
          }
        ]
      };
      
      const [applicationId] = await db('applications').insert({
        resume_id: resumeId,
        job_id: jobId,
        cover_letter: coverLetter,
        status: 'pending',
        email_to: emailTo,
        user_id: userId
      });
      
      if (this.testMode) {
        const emailContent = {
          from: process.env.GMAIL_USER || 'test@jobbot.com',
          to: emailTo || 'hr@company.com',
          subject: mailOptions.subject,
          text: mailOptions.text,
          html: mailOptions.html,
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
        
        const htmlFile = path.join(emailDir, `email-${applicationId}-preview.html`);
        const htmlPreview = `
          <!DOCTYPE html>
          <html>
          <head>
            <title>${emailContent.subject}</title>
            <style>
              body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
              .header { background: #f0f0f0; padding: 20px; margin-bottom: 20px; border-radius: 5px; }
              .content { line-height: 1.6; }
              .attachment { background: #e0e0e0; padding: 10px; margin-top: 20px; border-radius: 5px; }
            </style>
          </head>
          <body>
            <div class="header">
              <h2>Email Preview</h2>
              <p><strong>Subject:</strong> ${emailContent.subject}</p>
              <p><strong>From:</strong> ${emailContent.from}</p>
              <p><strong>To:</strong> ${emailContent.to}</p>
              <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
            </div>
            <div class="content">
              ${emailContent.html}
            </div>
            <div class="attachment">
              <p>📎 <strong>Attachment:</strong> ${emailContent.attachments[0].filename}</p>
            </div>
          </body>
          </html>
        `;
        await fs.writeFile(htmlFile, htmlPreview);
        
        console.log(`\n📧 TEST MODE: Email saved locally`);
        console.log(`📄 JSON: ${emailFile}`);
        console.log(`🌐 HTML Preview: ${htmlFile}`);
        console.log(`📬 To: ${emailContent.to}`);
        console.log(`📑 Subject: ${emailContent.subject}\n`);
        
        await db('applications')
          .where('id', applicationId)
          .update({
            status: 'test_sent',
            sent_at: new Date()
          });
          
        return {
          success: true,
          messageId: `test-${applicationId}`,
          applicationId: applicationId,
          testMode: true,
          savedTo: emailFile
        };
      } else {
        const info = await this.transporter.sendMail(mailOptions);
        
        await db('applications')
          .where('id', applicationId)
          .update({
            status: 'sent',
            sent_at: new Date()
          });
          
        return {
          success: true,
          messageId: info.messageId,
          applicationId: applicationId
        };
      }
      
    } catch (error) {
      console.error('Email send error:', error);
      
      if (applicationData.applicationId) {
        await db('applications')
          .where('id', applicationData.applicationId)
          .update({
            status: 'failed',
            error_message: error.message
          });
      }
      
      throw error;
    }
  }
  
  async getApplicationHistory(userId = null) {
    const query = db('applications')
      .join('resumes', 'applications.resume_id', 'resumes.id')
      .join('jobs', 'applications.job_id', 'jobs.id')
      .select(
        'applications.*',
        'resumes.filename as resume_filename',
        'jobs.title as job_title',
        'jobs.company as job_company'
      )
      .orderBy('applications.created_at', 'desc');
    
    if (userId) {
      query.where('applications.user_id', userId);
    }
      
    return query;
  }
  
  generateTemplateCoverLetter(resumeData, jobData) {
    const name = resumeData.name || 'Applicant';
    const skills = resumeData.skills || [];
    const topSkills = skills.slice(0, 3).join(', ') || 'relevant skills';
    const experience = resumeData.yearsOfExperience || 'several years';
    
    return `Dear Hiring Manager,

I am writing to express my strong interest in the ${jobData.title} position at ${jobData.company}. With ${experience} of experience in software development and expertise in ${topSkills}, I am confident I would be a valuable addition to your team.

My background includes:
${skills.slice(0, 5).map(skill => `• ${skill}`).join('\n')}

I am particularly drawn to this opportunity at ${jobData.company} because it aligns perfectly with my technical skills and career goals. I am eager to contribute to your team and help drive innovative solutions.

P.S. This application was sent using my custom-built job automation system that I developed using Node.js, AI integration (Gemini), web scraping, and queue processing with Redis/BullMQ. It intelligently matches jobs to my skills and generates personalized applications. I'd be happy to discuss the technical implementation!

Thank you for considering my application. I look forward to the opportunity to discuss how my skills and experience can contribute to ${jobData.company}'s continued success.

Best regards,
${name}`;
  }
}

module.exports = new EmailService();