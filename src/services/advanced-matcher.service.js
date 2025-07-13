class AdvancedMatcher {
  constructor() {
    this.stopWords = new Set([
      'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
      'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
      'to', 'was', 'will', 'with', 'the', 'we', 'our', 'you', 'your',
      'able', 'about', 'across', 'after', 'all', 'almost', 'also', 'am',
      'among', 'an', 'any', 'been', 'but', 'can', 'cannot', 'could',
      'did', 'do', 'does', 'either', 'else', 'ever', 'every', 'for',
      'get', 'got', 'had', 'has', 'have', 'her', 'him', 'how', 'however',
      'if', 'into', 'just', 'least', 'let', 'like', 'likely', 'may',
      'me', 'might', 'most', 'must', 'my', 'neither', 'no', 'nor', 'not',
      'of', 'off', 'often', 'only', 'or', 'other', 'our', 'own', 'rather',
      'said', 'say', 'says', 'she', 'should', 'since', 'so', 'some', 'than',
      'that', 'the', 'their', 'them', 'then', 'there', 'these', 'they',
      'this', 'those', 'through', 'too', 'under', 'until', 'up', 'very',
      'was', 'way', 'well', 'were', 'what', 'where', 'which', 'while',
      'who', 'whom', 'why', 'will', 'with', 'would', 'yet', 'you', 'your'
    ]);

    this.techSkillBoosts = {
      'javascript': 1.5, 'python': 1.5, 'java': 1.5, 'c++': 1.5, 'php': 1.5,
      'react': 1.4, 'angular': 1.4, 'vue': 1.4, 'node': 1.4, 'django': 1.4,
      'spring': 1.4, 'laravel': 1.4, 'flask': 1.4, 'express': 1.4,
      'docker': 1.3, 'kubernetes': 1.3, 'aws': 1.3, 'azure': 1.3, 'gcp': 1.3,
      'sql': 1.3, 'nosql': 1.3, 'mongodb': 1.3, 'postgresql': 1.3, 'mysql': 1.3,
      'git': 1.2, 'ci/cd': 1.2, 'agile': 1.2, 'scrum': 1.2, 'api': 1.2
    };

    this.experienceLevels = {
      'senior': { years: 5, weight: 1.0 },
      'mid': { years: 3, weight: 0.8 },
      'junior': { years: 1, weight: 0.6 },
      'entry': { years: 0, weight: 0.4 }
    };
  }

  tokenize(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s\+\#]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 1 && !this.stopWords.has(word));
  }

  calculateTF(tokens) {
    const tf = {};
    const totalTokens = tokens.length;
    
    tokens.forEach(token => {
      tf[token] = (tf[token] || 0) + 1;
    });
    
    Object.keys(tf).forEach(token => {
      tf[token] = tf[token] / totalTokens;
      
      if (this.techSkillBoosts[token]) {
        tf[token] *= this.techSkillBoosts[token];
      }
    });
    
    return tf;
  }

  calculateIDF(documents) {
    const idf = {};
    const totalDocs = documents.length;
    const allTokens = new Set();
    
    documents.forEach(doc => {
      const uniqueTokens = new Set(this.tokenize(doc));
      uniqueTokens.forEach(token => allTokens.add(token));
    });
    
    allTokens.forEach(token => {
      const docsWithToken = documents.filter(doc => 
        this.tokenize(doc).includes(token)
      ).length;
      
      idf[token] = Math.log(totalDocs / (docsWithToken || 1));
    });
    
    return idf;
  }

  calculateTFIDF(tf, idf) {
    const tfidf = {};
    
    Object.keys(tf).forEach(token => {
      tfidf[token] = tf[token] * (idf[token] || 0);
    });
    
    return tfidf;
  }

  cosineSimilarity(vec1, vec2) {
    const allKeys = new Set([...Object.keys(vec1), ...Object.keys(vec2)]);
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    allKeys.forEach(key => {
      const val1 = vec1[key] || 0;
      const val2 = vec2[key] || 0;
      
      dotProduct += val1 * val2;
      norm1 += val1 * val1;
      norm2 += val2 * val2;
    });
    
    const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  detectExperienceLevel(text) {
    const lower = text.toLowerCase();
    
    if (lower.includes('senior') || lower.includes('sr.') || lower.includes('lead') || 
        lower.includes('principal') || lower.includes('5+ years') || lower.includes('7+ years')) {
      return 'senior';
    } else if (lower.includes('mid-level') || lower.includes('mid level') || 
               lower.includes('3+ years') || lower.includes('2-5 years')) {
      return 'mid';
    } else if (lower.includes('junior') || lower.includes('jr.') || 
               lower.includes('1+ year') || lower.includes('1-2 years')) {
      return 'junior';
    } else if (lower.includes('entry') || lower.includes('graduate') || 
               lower.includes('intern') || lower.includes('0-1 year')) {
      return 'entry';
    }
    
    return null;
  }

  extractKeyPhrases(text) {
    const phrases = [];
    const patterns = [
      /\b(?:experience with|proficient in|expert in|knowledge of|familiar with)\s+([^,.]+)/gi,
      /\b(\w+(?:\s+\w+)?)\s+(?:developer|engineer|programmer|architect)/gi,
      /\b(?:certified|certification in)\s+([^,.]+)/gi
    ];
    
    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        phrases.push(match[1].toLowerCase().trim());
      }
    });
    
    return phrases;
  }

  calculateComprehensiveScore(resumeText, jobDescription) {
    const resumeTokens = this.tokenize(resumeText);
    const jobTokens = this.tokenize(jobDescription);
    
    const documents = [resumeText, jobDescription];
    const idf = this.calculateIDF(documents);
    
    const resumeTF = this.calculateTF(resumeTokens);
    const jobTF = this.calculateTF(jobTokens);
    
    const resumeTFIDF = this.calculateTFIDF(resumeTF, idf);
    const jobTFIDF = this.calculateTFIDF(jobTF, idf);
    
    let baseScore = this.cosineSimilarity(resumeTFIDF, jobTFIDF) * 100;
    
    const jobLevel = this.detectExperienceLevel(jobDescription);
    const resumeLevel = this.detectExperienceLevel(resumeText);
    
    if (jobLevel && resumeLevel) {
      const jobYears = this.experienceLevels[jobLevel].years;
      const resumeYears = this.experienceLevels[resumeLevel].years;
      
      if (resumeYears >= jobYears) {
        baseScore *= 1.1;
      } else {
        const penaltyFactor = 1 - ((jobYears - resumeYears) * 0.1);
        baseScore *= Math.max(0.7, penaltyFactor);
      }
    }
    
    const resumePhrases = this.extractKeyPhrases(resumeText);
    const jobPhrases = this.extractKeyPhrases(jobDescription);
    
    const phraseMatches = jobPhrases.filter(phrase => 
      resumePhrases.some(rPhrase => rPhrase.includes(phrase) || phrase.includes(rPhrase))
    ).length;
    
    const phraseBonus = Math.min(10, phraseMatches * 2);
    baseScore += phraseBonus;
    
    const matchingSkills = [];
    const missingSkills = [];
    
    const importantJobTokens = Object.entries(jobTFIDF)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([token]) => token);
    
    importantJobTokens.forEach(token => {
      if (resumeTokens.includes(token)) {
        matchingSkills.push(token);
      } else if (this.techSkillBoosts[token]) {
        missingSkills.push(token);
      }
    });
    
    const finalScore = Math.min(100, Math.max(0, baseScore));
    
    let recommendation = 'Skip';
    if (finalScore >= 70 && missingSkills.length <= 2) {
      recommendation = 'Apply';
    } else if (finalScore >= 40 || (finalScore >= 30 && matchingSkills.length >= 5)) {
      recommendation = 'Maybe';
    }
    
    return {
      score: Math.round(finalScore),
      matchingSkills: [...new Set(matchingSkills)],
      missingSkills: [...new Set(missingSkills)],
      recommendation,
      details: {
        tfidfSimilarity: Math.round(this.cosineSimilarity(resumeTFIDF, jobTFIDF) * 100),
        experienceMatch: jobLevel && resumeLevel ? `${resumeLevel} vs ${jobLevel} required` : 'N/A',
        keyPhraseMatches: phraseMatches
      }
    };
  }
}

module.exports = new AdvancedMatcher();