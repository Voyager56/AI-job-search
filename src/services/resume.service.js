const fs = require('fs').promises;
const pdfParse = require('pdf-parse');
const crypto = require('crypto');
const { db } = require('../database/db');
const geminiService = require('./gemini.service');

class ResumeService {
  async uploadResume(filePath, filename) {
    try {
      console.log('Starting resume upload:', { filePath, filename });
      
      try {
        await fs.access(filePath);
      } catch (err) {
        throw new Error(`File not found: ${filePath}`);
      }
      
      const dataBuffer = await fs.readFile(filePath);
      console.log('File read successfully, size:', dataBuffer.length);
      
      const pdfData = await pdfParse(dataBuffer);
      const text = pdfData.text;
      console.log('PDF parsed, text length:', text.length);
      
      if (!text || text.trim().length === 0) {
        throw new Error('PDF appears to be empty or could not be parsed');
      }
      
      const contentHash = crypto.createHash('sha256').update(text).digest('hex');
      console.log('Content hash:', contentHash);
      
      const existingResume = await db('resumes')
        .where('content_hash', contentHash)
        .first();
      
      if (existingResume) {
        console.log('Resume already exists in database, returning cached data');
        return {
          id: existingResume.id,
          filename: existingResume.filename,
          parsedData: JSON.parse(existingResume.parsed_data),
          cached: true
        };
      }
      
      console.log('New resume detected, extracting info with Gemini...');
      const parsedData = await geminiService.extractResumeInfo(text);
      console.log('Gemini extraction complete:', parsedData);
      
      const [resumeId] = await db('resumes').insert({
        filename: filename,
        content: text,
        pdf_content: dataBuffer,
        parsed_data: JSON.stringify(parsedData),
        content_hash: contentHash
      });
      
      console.log('Resume saved to database with ID:', resumeId);
      
      return {
        id: resumeId,
        filename: filename,
        parsedData: parsedData,
        cached: false
      };
    } catch (error) {
      console.error('Resume upload error:', error);
      console.error('Error stack:', error.stack);
      throw error;
    }
  }
  
  async getResume(resumeId) {
    const resume = await db('resumes')
      .where('id', resumeId)
      .first();
      
    if (resume) {
      resume.parsed_data = JSON.parse(resume.parsed_data);
    }
    
    return resume;
  }
  
  async getAllResumes() {
    const resumes = await db('resumes')
      .select('id', 'filename', 'created_at', 'content_hash')
      .orderBy('created_at', 'desc');
      
    return resumes;
  }
  
  async getUniqueResumes() {
    const resumes = await db('resumes')
      .select('resumes.*')
      .innerJoin(
        db('resumes')
          .select('content_hash')
          .max('created_at as max_created_at')
          .groupBy('content_hash')
          .as('latest'),
        function() {
          this.on('resumes.content_hash', '=', 'latest.content_hash')
            .andOn('resumes.created_at', '=', 'latest.max_created_at');
        }
      )
      .orderBy('resumes.created_at', 'desc');
    
    return resumes.map(resume => ({
      ...resume,
      parsed_data: JSON.parse(resume.parsed_data)
    }));
  }
  
  async deleteResume(resumeId) {
    await db('resumes')
      .where('id', resumeId)
      .delete();
  }
}

module.exports = new ResumeService();