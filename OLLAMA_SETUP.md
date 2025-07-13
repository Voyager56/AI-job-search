# Setting Up Ollama for Free Local AI

## Installation

1. **Install Ollama**:
```bash
# Linux
curl -fsSL https://ollama.com/install.sh | sh

# Or manually download from https://ollama.com/download
```

2. **Download a model** (choose based on your PC specs):
```bash
# Lightweight (3GB RAM) - Good for job matching
ollama pull mistral

# Medium (8GB RAM) - Better for cover letters
ollama pull llama2

# Tiny (1GB RAM) - For weak PCs
ollama pull phi
```

3. **Test it**:
```bash
ollama run mistral "Hello world"
```

## Integration with Job Bot

### Option A: Quick Integration (Replace Gemini)

Create `src/services/ollama.service.js`:
```javascript
const axios = require('axios');

class OllamaService {
  constructor() {
    this.baseURL = 'http://localhost:11434';
    this.model = 'mistral'; // or 'llama2' or 'phi'
  }

  async generateCoverLetter(resumeData, jobData) {
    const prompt = `Write a cover letter for this job:
Job: ${jobData.title} at ${jobData.company}
My skills: ${resumeData.skills.join(', ')}
Keep it under 200 words.`;

    try {
      const response = await axios.post(`${this.baseURL}/api/generate`, {
        model: this.model,
        prompt: prompt,
        stream: false
      });
      
      return response.data.response;
    } catch (error) {
      // Fallback to template
      return this.templateCoverLetter(resumeData, jobData);
    }
  }

  templateCoverLetter(resumeData, jobData) {
    return `Dear Hiring Manager,

I am writing to express my interest in the ${jobData.title} position at ${jobData.company}.

With my experience in ${resumeData.skills.slice(0, 3).join(', ')}, I believe I would be a valuable addition to your team.

My background in ${resumeData.experience || 'software development'} has prepared me well for this role.

I look forward to discussing how I can contribute to ${jobData.company}.

Best regards,
${resumeData.name}`;
  }

  async matchJobRelevance(keywords, jobDescription) {
    // Use the existing fallback - it's already pretty good!
    // No need for AI for simple keyword matching
    return null; // This will trigger the fallback
  }
}

module.exports = new OllamaService();
```

### Option B: Just Use Templates

No AI needed! Create template-based cover letters:
```javascript
function generateCoverLetter(resume, job) {
  const templates = {
    'developer': `Dear Hiring Manager...`,
    'php': `As a PHP developer with Laravel expertise...`,
    'default': `I am interested in your ${job.title} position...`
  };
  
  // Pick template based on job title
  const template = templates[job.title.toLowerCase().includes('php') ? 'php' : 'default'];
  return template.replace(/\${([^}]+)}/g, (_, key) => resume[key] || job[key]);
}
```

## Resource Usage

- **Mistral**: ~4GB RAM while running
- **Phi**: ~2GB RAM while running  
- **Llama2**: ~8GB RAM while running

You can stop Ollama when not using it:
```bash
# Stop
sudo systemctl stop ollama

# Start when needed
sudo systemctl start ollama
```