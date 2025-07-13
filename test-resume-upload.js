const fs = require('fs');
const path = require('path');

const testResumeContent = `
JOHN DOE
Software Engineer
john.doe@email.com | (555) 123-4567

SKILLS
JavaScript, Node.js, React, Python, MongoDB, PostgreSQL, Docker, AWS

EXPERIENCE
Senior Software Engineer - Tech Corp (2020-2023)
- Developed scalable web applications using Node.js and React
- Led a team of 5 developers
- Implemented CI/CD pipelines

Software Developer - StartupXYZ (2018-2020)
- Built RESTful APIs using Express.js
- Worked with MongoDB and PostgreSQL databases

EDUCATION
B.S. Computer Science - University of Technology (2014-2018)
`;

async function testResumeParsing() {
  require('dotenv').config();
  const geminiService = require('./src/services/gemini.service');
  
  console.log('Testing Gemini resume parsing...');
  try {
    const result = await geminiService.extractResumeInfo(testResumeContent);
    console.log('Parsing successful:', result);
  } catch (error) {
    console.error('Parsing failed:', error.message);
  }
}

testResumeParsing();