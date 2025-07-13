const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');

class GeminiService {
  constructor() {
    console.log('Initializing AI service...');
    
    this.aiProvider = null;
    
    if (process.env.ANTHROPIC_API_KEY) {
      console.log('Claude API key found - premium AI enabled');
      this.aiProvider = 'claude';
    } else if (process.env.USE_OLLAMA === 'true') {
      console.log('Ollama local AI enabled');
      this.aiProvider = 'ollama';
      this.ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
    } else if (process.env.GEMINI_API_KEY) {
      console.log('Gemini API key found');
      this.aiProvider = 'gemini';
      this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    } else {
      console.warn('No AI service configured - using templates only');
      this.aiProvider = 'template';
    }
  }

  async generateCoverLetter(resumeData, jobData) {
    if (this.aiProvider === 'ollama') {
      try {
        const response = await axios.post(`${this.ollamaUrl}/api/generate`, {
          model: 'mistral',
          prompt: `Write a professional cover letter for ${resumeData.name} applying to ${jobData.title} at ${jobData.company}. Skills: ${resumeData.skills?.join(', ')}. Keep it under 250 words. Mention this was sent via a custom job automation system.`,
          stream: false
        });
        return response.data.response;
      } catch (error) {
        console.log('Ollama failed, using template:', error.message);
        return this.generateTemplateCoverLetter(resumeData, jobData);
      }
    }
    
    if (!this.model || this.aiProvider === 'template') {
      console.log('Using template cover letter');
      return this.generateTemplateCoverLetter(resumeData, jobData);
    }

    const prompt = `
Generate a professional cover letter for a job application.

Resume Information:
- Name: ${resumeData.name}
- Email: ${resumeData.email}
- Skills: ${resumeData.skills?.join(', ') || 'Not specified'}
- Experience: ${resumeData.experience || 'Not specified'}

Job Information:
- Position: ${jobData.title}
- Company: ${jobData.company}
- Description: ${jobData.description}

Write a compelling cover letter that:
1. Shows enthusiasm for the specific role and company
2. Highlights relevant skills and experience from the resume
3. Explains why the candidate is a good fit
4. Uses professional tone
5. Keeps it concise (3-4 paragraphs)

Format: Standard business letter format starting with "Dear Hiring Manager,"
`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = result.response;
      return response.text();
    } catch (error) {
      console.error('Gemini API error:', error);
      throw error;
    }
  }

  async extractResumeInfo(resumeText) {
    if (!this.model) {
      throw new Error('Gemini API key not configured');
    }

    const prompt = `
Extract key information from this resume and return as JSON:

Resume text:
${resumeText}

Extract and return in this exact JSON format:
{
  "name": "Full name",
  "email": "Email address",
  "phone": "Phone number",
  "skills": ["skill1", "skill2", "skill3"],
  "experience": "Summary of work experience",
  "education": "Highest education",
  "yearsOfExperience": "Estimated total years",
  "topKeywords": ["keyword1", "keyword2", "keyword3"]
}

Return ONLY valid JSON, no additional text.
`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = result.response;
      const text = response.text();
      
      console.log('Gemini raw response:', text);
      
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          console.log('Parsed resume data:', parsed);
          return parsed;
        } catch (parseError) {
          console.error('JSON parse error:', parseError);
          console.error('Attempted to parse:', jsonMatch[0]);
          throw new Error('Invalid JSON response from Gemini');
        }
      }
      
      console.error('No JSON found in response:', text);
      throw new Error('Could not find JSON in Gemini response');
    } catch (error) {
      console.error('Gemini API error:', error);
      console.error('Error details:', error.message);
      
      if (error.message.includes('quota') || error.message.includes('limit')) {
        console.log('API limit reached, using template cover letter');
        return this.generateTemplateCoverLetter(resumeData, jobData);
      }
      throw error;
    }
  }
  
  generateTemplateCoverLetter(resumeData, jobData) {
    const name = resumeData.name || 'Applicant';
    const skills = resumeData.skills || [];
    const topSkills = skills.slice(0, 3).join(', ');
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

  async matchJobRelevance(resumeKeywords, jobDescription) {
    const techMatcher = require('./tech-matcher.service');
    const advancedMatcher = require('./advanced-matcher.service');
    
    const fallbackMatch = () => {
      const userSkills = resumeKeywords.map(k => k.toLowerCase());
      const resumeText = userSkills.join(' ');
      
      const advancedResult = advancedMatcher.calculateComprehensiveScore(resumeText, jobDescription);
      
      const techResult = techMatcher.calculateCompatibility(userSkills, jobDescription);
      
      const weightedScore = (advancedResult.score * 0.7) + (techResult.score * 0.3);
      
      const combinedMatchingSkills = [
        ...new Set([
          ...advancedResult.matchingSkills,
          ...techResult.matchDetails.matchedStacks,
          ...techResult.matchDetails.transferableSkills
        ])
      ];
      
      const combinedMissingSkills = [
        ...new Set([
          ...advancedResult.missingSkills,
          ...techResult.matchDetails.missingStacks
        ])
      ];
      
      let recommendation = 'Skip';
      if (weightedScore >= 70 && combinedMissingSkills.length <= 2) {
        recommendation = 'Apply';
      } else if (weightedScore >= 40 || combinedMatchingSkills.length >= 5) {
        recommendation = 'Maybe';
      }
      
      return {
        score: Math.round(weightedScore),
        matchingSkills: combinedMatchingSkills,
        missingSkills: combinedMissingSkills,
        recommendation,
        details: {
          tfidfScore: advancedResult.score,
          techScore: techResult.score,
          ...advancedResult.details
        }
      };
    };

    if (!this.model) {
      console.log('Gemini not configured, using fallback matching');
      return fallbackMatch();
    }

    const prompt = `
Analyze this job match using specific scoring criteria:

RESUME SKILLS: ${resumeKeywords.join(', ')}

JOB DESCRIPTION: ${jobDescription}

SCORING CRITERIA:
- Primary skill match (exact technology/framework match): +40 points per match
- Related/compatible skills: +15 points per match  
- Transferable skills (git, docker, databases, etc): +5 points per match
- Missing critical skills: -20 points per missing skill
- Maximum score: 100

RECOMMENDATION RULES:
- Score 70-100 + primary skill match = "Apply"
- Score 40-69 OR has compatible skills = "Maybe" 
- Score below 40 OR missing 2+ critical skills = "Skip"

Return ONLY a JSON object:
{
  "score": [0-100 based on criteria above],
  "matchingSkills": [list of skills from resume found in job],
  "missingSkills": [critical skills in job not in resume],
  "recommendation": "Apply" or "Skip" or "Maybe",
  "reasoning": "Brief explanation of score"
}
`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = result.response;
      const text = response.text();
      
      console.log('Gemini match response:', text.substring(0, 200));
      console.log('Input keywords:', resumeKeywords.length, 'keywords');
      console.log('Job description length:', jobDescription.length, 'chars');
      
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
          parsed.score = parseInt(parsed.score) || 50;
        
          console.log('Gemini scoring details:', {
          score: parsed.score,
          matchingSkills: parsed.matchingSkills?.length || 0,
          missingSkills: parsed.missingSkills?.length || 0,
          recommendation: parsed.recommendation,
          reasoning: parsed.reasoning
        });
        
        return parsed;
      }
      
      console.log('No valid JSON in Gemini response, using fallback');
      const fallbackResult = fallbackMatch();
      
      console.log('Fallback scoring used (invalid JSON):', {
        score: fallbackResult.score,
        matchingSkills: fallbackResult.matchingSkills?.length || 0,
        missingSkills: fallbackResult.missingSkills?.length || 0
      });
      
      return fallbackResult;
    } catch (error) {
      console.error('Gemini matching error:', error.message);
      console.log('Using fallback matching due to error');
      const fallbackResult = fallbackMatch();
      
      console.log('Fallback scoring details:', {
        score: fallbackResult.score,
        matchingSkills: fallbackResult.matchingSkills?.length || 0,
        missingSkills: fallbackResult.missingSkills?.length || 0,
        recommendation: fallbackResult.recommendation
      });
      
      return fallbackResult;
    }
  }
}

module.exports = new GeminiService();