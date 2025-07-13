# Job Application Bot - Project Scope

## Executive Summary

An automated system that streamlines job applications by parsing resumes, finding relevant job postings, generating personalized cover letters, and sending applications via email.

## Core Features (MVP)

### 1. Resume Management
- [x] Upload PDF resumes
- [x] Extract key information (name, email, skills, experience)
- [x] Store parsed data in database
- [x] Support multiple resume versions

### 2. Job Discovery
- [x] Web scraping from job boards (Indeed, SimplyHired, LinkedIn)
- [x] Keyword-based job search
- [x] Location-based filtering
- [x] Deduplication of results

### 3. Job Matching
- [x] AI-powered relevance scoring
- [x] Skill matching analysis
- [x] Recommendation system (Apply/Skip/Maybe)
- [x] Missing skills identification

### 4. Application Automation
- [x] AI-generated cover letters
- [x] Email application sending
- [x] Resume attachment
- [x] Application tracking

### 5. User Interface
- [x] Web-based dashboard
- [x] Resume upload interface
- [x] Job listing display
- [x] One-click application

## Technical Stack

- **Backend**: Node.js + Express
- **Database**: SQLite with Knex ORM
- **AI/ML**: Google Gemini API
- **Web Scraping**: Cheerio + Axios
- **Email**: Nodemailer with Gmail
- **Frontend**: Vanilla JS + HTML/CSS

## Out of Scope (Current Version)

1. **Authentication & Multi-user Support**
   - Single user system
   - No login/registration

2. **Advanced Job Sources**
   - No LinkedIn authenticated API
   - No premium job board access
   - No company career pages

3. **Application Tracking**
   - No response tracking
   - No interview scheduling
   - No follow-up automation

4. **Advanced AI Features**
   - No resume optimization
   - No interview preparation
   - No salary negotiation

## Constraints & Limitations

### Technical Constraints
- Gemini API: 60 requests/minute (free tier)
- Gmail: 500 emails/day limit
- Web scraping: Subject to site changes/blocking
- SQLite: Single-user, local database

### Legal & Ethical Constraints
- Respect robots.txt and rate limits
- No bypassing of authentication
- Truthful resume information only
- User controls all applications sent

## Success Metrics

1. **Efficiency**
   - Time saved: 80% reduction in application time
   - Applications per hour: 10-15 (vs 2-3 manual)

2. **Quality**
   - Relevance score accuracy: >70%
   - Cover letter personalization: High
   - Application success rate: Track but not guaranteed

3. **Reliability**
   - Uptime: 95%+ during job search hours
   - Scraping success: 60%+ across sites
   - Email delivery: 99%+

## Implementation Phases

### Phase 1: Core Functionality ✅
- Basic resume parsing
- Job scraping from 1 source
- Simple cover letter generation
- Manual email sending

### Phase 2: Enhanced Matching ✅
- Multi-source job aggregation
- AI-powered matching scores
- Automated cover letter personalization
- Batch application sending

### Phase 3: Future Enhancements
- [ ] Queue system for background processing
- [ ] Advanced analytics dashboard
- [ ] Multiple resume template support
- [ ] API integrations with job boards
- [ ] Chrome extension for quick apply

## Risk Assessment

### High Risk
- **Web scraping blocking**: Sites may block or change structure
  - Mitigation: Multiple sources, fallback options

### Medium Risk
- **API rate limits**: Free tier limitations
  - Mitigation: Caching, request optimization
  
- **Email deliverability**: Spam filters
  - Mitigation: Proper email configuration, rate limiting

### Low Risk
- **Data loss**: Local database corruption
  - Mitigation: Regular backups, data export

## Maintenance Requirements

### Daily
- Monitor scraping success rates
- Check email delivery status
- Review API usage

### Weekly
- Update scraping selectors if needed
- Clean old application data
- Check for security updates

### Monthly
- Performance optimization
- Feature usage analysis
- Dependency updates

## Budget Considerations

### Operational Costs (Monthly)
- Gemini API: $0 (free tier)
- Email: $0 (Gmail)
- Hosting: $0 (local)
- **Total**: $0/month

### Potential Paid Upgrades
- Gemini API Pro: $10-50/month
- Email service (SendGrid): $20/month
- VPS hosting: $10-20/month
- Proxy service: $50/month

## Conclusion

This project delivers a functional job application automation system within free tier limits. It prioritizes practical functionality over complex features, making it suitable for individual job seekers who want to streamline their application process without significant technical knowledge or financial investment.