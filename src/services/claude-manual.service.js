class ClaudeManualService {
  generatePromptForCoverLetter(resumeData, jobData) {
    const prompt = `Please generate a professional cover letter for this job application:

RESUME INFORMATION:
- Name: ${resumeData.name}
- Email: ${resumeData.email}
- Skills: ${resumeData.skills?.join(', ') || 'Not specified'}
- Experience: ${resumeData.experience || 'Not specified'}

JOB INFORMATION:
- Position: ${jobData.title}
- Company: ${jobData.company}
- Description: ${jobData.description}

Please write a compelling cover letter that:
1. Shows enthusiasm for the specific role and company
2. Highlights relevant skills and experience
3. Explains why I'm a good fit
4. Uses professional tone
5. Keeps it concise (3-4 paragraphs)

P.S. Mention that this application was sent using my custom-built job automation system (Node.js, AI integration, web scraping, Redis/BullMQ).`;

    return prompt;
  }

  generatePromptForJobMatching(resumeKeywords, jobDescription) {
    const prompt = `Rate how well this resume matches the job on a scale of 0-100:

Resume keywords: ${resumeKeywords.join(', ')}

Job description: ${jobDescription}

Please provide:
1. Match score (0-100)
2. Matching skills
3. Missing skills
4. Recommendation (Apply/Maybe/Skip)`;

    return prompt;
  }

  async savePromptsToFile(prompts) {
    const fs = require('fs').promises;
    const path = require('path');
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const filename = path.join(process.cwd(), 'claude-prompts', `prompts-${timestamp}.txt`);
    
    await fs.mkdir(path.dirname(filename), { recursive: true });
    await fs.writeFile(filename, prompts.join('\n\n---\n\n'), 'utf8');
    
    return filename;
  }
}

module.exports = new ClaudeManualService();