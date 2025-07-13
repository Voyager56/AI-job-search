class TechMatcherService {
  constructor() {
    this.techStacks = {
      php: {
        core: ['php'],
        frameworks: ['laravel', 'symfony', 'codeigniter', 'yii', 'slim'],
        related: ['composer', 'artisan', 'eloquent', 'blade'],
        databases: ['mysql', 'postgresql', 'mariadb'],
        compatible: ['javascript', 'vue', 'react', 'html', 'css', 'sql']
      },
      
      python: {
        core: ['python'],
        frameworks: ['django', 'flask', 'fastapi', 'pyramid'],
        related: ['pip', 'pandas', 'numpy', 'scipy', 'matplotlib', 'jupyter'],
        databases: ['postgresql', 'mongodb', 'redis'],
        compatible: ['javascript', 'react', 'vue', 'sql']
      },
      
      javascript: {
        core: ['javascript', 'nodejs', 'node.js', 'typescript'],
        frameworks: ['express', 'nestjs', 'next.js', 'nuxt', 'gatsby'],
        frontend: ['react', 'vue', 'angular', 'svelte'],
        related: ['npm', 'yarn', 'webpack', 'babel', 'jest'],
        databases: ['mongodb', 'postgresql', 'mysql'],
        compatible: ['html', 'css', 'sql']
      },
      
      java: {
        core: ['java'],
        frameworks: ['spring', 'spring boot', 'hibernate', 'struts'],
        related: ['maven', 'gradle', 'junit', 'tomcat'],
        databases: ['oracle', 'postgresql', 'mysql'],
        compatible: ['sql', 'javascript']
      },
      
      dotnet: {
        core: ['c#', 'csharp', '.net', 'dotnet'],
        frameworks: ['asp.net', 'entity framework', 'blazor', '.net core'],
        related: ['visual studio', 'nuget', 'linq'],
        databases: ['sql server', 'postgresql', 'mysql'],
        compatible: ['javascript', 'typescript', 'sql']
      },
      
      ruby: {
        core: ['ruby'],
        frameworks: ['rails', 'ruby on rails', 'sinatra'],
        related: ['bundler', 'rspec', 'activerecord'],
        databases: ['postgresql', 'mysql', 'redis'],
        compatible: ['javascript', 'react', 'vue', 'sql']
      },
      
      go: {
        core: ['go', 'golang'],
        frameworks: ['gin', 'echo', 'fiber', 'beego'],
        related: ['goroutines', 'channels'],
        databases: ['postgresql', 'mongodb', 'redis'],
        compatible: ['javascript', 'sql']
      }
    };
    
    this.transferableSkills = [
      'sql', 'database', 'api', 'rest', 'graphql', 'git', 'docker', 
      'kubernetes', 'aws', 'azure', 'gcp', 'linux', 'agile', 'scrum',
      'testing', 'ci/cd', 'devops', 'microservices', 'design patterns',
      'data structures', 'algorithms', 'web development', 'full stack',
      'backend', 'frontend', 'security', 'performance', 'optimization'
    ];
  }
  
  detectTechStack(text) {
    const lower = text.toLowerCase();
    const detectedStacks = [];
    
    for (const [stack, keywords] of Object.entries(this.techStacks)) {
      const allKeywords = [
        ...keywords.core,
        ...(keywords.frameworks || []),
        ...(keywords.frontend || []),
        ...(keywords.related || [])
      ];
      
      const matches = allKeywords.filter(keyword => {
        const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        return regex.test(lower);
      });
      
      if (matches.length > 0) {
        detectedStacks.push({
          stack,
          confidence: matches.length,
          matches
        });
      }
    }
    
    return detectedStacks.sort((a, b) => b.confidence - a.confidence);
  }
  
  calculateCompatibility(userSkills, jobDescription) {
    const jobStacks = this.detectTechStack(jobDescription);
    const userStacks = this.detectTechStack(userSkills.join(' '));
    
    const userPrimaryStacks = new Set(userStacks.map(s => s.stack));
    
    let score = 0;
    let matchDetails = {
      primaryMatch: false,
      compatibleMatch: false,
      transferableSkills: [],
      missingStacks: [],
      matchedStacks: [],
      warnings: []
    };
    
    for (const jobStack of jobStacks) {
      const stackName = jobStack.stack;
      
      if (userPrimaryStacks.has(stackName)) {
        score += 40;
        matchDetails.primaryMatch = true;
        matchDetails.matchedStacks.push(stackName);
      }
      else {
        let isCompatible = false;
        
        for (const userStack of userStacks) {
          const compatible = this.techStacks[userStack.stack].compatible || [];
          if (compatible.some(tech => jobStack.matches.includes(tech))) {
            score += 15;
            isCompatible = true;
            matchDetails.compatibleMatch = true;
            break;
          }
        }
        
        if (!isCompatible) {
          matchDetails.missingStacks.push(stackName);
          matchDetails.warnings.push(`Job requires ${stackName} experience`);
          score -= 20;
        }
      }
    }
    
    const jobLower = jobDescription.toLowerCase();
    const transferableMatches = this.transferableSkills.filter(skill => {
      return userSkills.some(userSkill => 
        userSkill.toLowerCase().includes(skill)) && 
        jobLower.includes(skill);
    });
    
    matchDetails.transferableSkills = transferableMatches;
    score += transferableMatches.length * 5;
    
    score = Math.max(0, Math.min(100, score));
    
    let recommendation = 'Skip';
    if (matchDetails.primaryMatch && matchDetails.missingStacks.length === 0) {
      recommendation = 'Apply';
    } else if (matchDetails.primaryMatch || (matchDetails.compatibleMatch && transferableMatches.length >= 3)) {
      recommendation = 'Maybe';
    } else if (matchDetails.missingStacks.length > 1) {
      recommendation = 'Skip';
      score = Math.min(score, 30);
    }
    
    return {
      score,
      recommendation,
      matchDetails,
      jobStacks: jobStacks.map(s => s.stack),
      userStacks: userStacks.map(s => s.stack)
    };
  }
}

module.exports = new TechMatcherService();