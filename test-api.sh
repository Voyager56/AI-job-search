#!/bin/bash

echo "=== Job Application Bot API Test ==="
echo

# Check server health
echo "1. Testing server health..."
curl -s http://localhost:3000/health | jq
echo

# Check queue stats
echo "2. Checking queue statistics..."
curl -s http://localhost:3000/api/queues/stats | jq
echo

# Test job search (without uploading resume)
echo "3. Testing job search..."
curl -s -X POST http://localhost:3000/api/jobs/search \
  -H "Content-Type: application/json" \
  -d '{"keywords": "software engineer", "location": "remote"}' | jq
echo

# Check existing resumes
echo "4. Checking existing resumes..."
curl -s http://localhost:3000/api/resumes | jq
echo

echo "=== Basic API tests completed ==="
echo
echo "To test resume upload:"
echo "  curl -X POST http://localhost:3000/api/resume/upload?queue=false \\"
echo "    -F 'resume=@/path/to/resume.pdf'"
echo
echo "To test with queue:"
echo "  curl -X POST http://localhost:3000/api/resume/upload \\"
echo "    -F 'resume=@/path/to/resume.pdf'"