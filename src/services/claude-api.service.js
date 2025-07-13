const Anthropic = require('@anthropic-ai/sdk');

class ClaudeAPIService {
  constructor() {
    if (process.env.ANTHROPIC_API_KEY) {
      this.client = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
      console.log('Claude API initialized');
    } else {
      console.log('Claude API key not found - using fallback');
    }
  }

  async generateCoverLetter(resumeData, jobData) {
    if (!this.client) {
      return this.generateTemplateCoverLetter(resumeData, jobData);
    }

    try {
      const message = await this.client.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1000,
        temperature: 0.7,
        messages: [{
          role: 'user',
          content: `Generate a professional cover letter for a job application.

Resume Information:
- Name: ${resumeData.name}
- Email: ${resumeData.email}
- Skills: ${resumeData.skills?.join(', ') || 'Not specified'}
- Experience: ${resumeData.experience || 'Not specified'}

Job Information:
- Position: ${jobData.title}
- Company: ${jobData.company}
- Description: ${jobData.description}

Write a compelling cover letter that shows enthusiasm, highlights relevant skills, and mentions that this was sent using my custom job automation system built with Node.js.`
        }]
      });

      return message.content[0].text;
    } catch (error) {
      console.error('Claude API error:', error);
      return this.generateTemplateCoverLetter(resumeData, jobData);
    }
  }

  generateTemplateCoverLetter(resumeData, jobData) {
    return `Dear Hiring Manager...`;
  }

  async matchJobRelevance(resumeKeywords, jobDescription) {
    if (!this.client) {
      return { score: 50, recommendation: 'Maybe' };
    }

    try {
      const message = await this.client.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 200,
        temperature: 0,
        messages: [{
          role: 'user',
          content: `Rate job match (0-100): Resume: ${resumeKeywords.join(', ')}. Job: ${jobDescription}. Return JSON only.`
        }]
      });

      const text = message.content[0].text;
      return JSON.parse(text);
    } catch (error) {
      console.error('Claude matching error:', error);
      return { score: 50, recommendation: 'Maybe' };
    }
  }
}

module.exports = new ClaudeAPIService();