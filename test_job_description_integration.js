// Test script to verify job description integration in AI simulator
const axios = require('axios');
const fs = require('fs');

const API_BASE = 'http://localhost:5000';
const TEST_USER_ID = 'test-user-jd-integration';

// Sample job description for testing
const sampleJobDescription = `
SOFTWARE ENGINEER - FRONTEND SPECIALIST
Company: TechSingapore Pte Ltd
Location: Singapore

JOB DESCRIPTION:
We are seeking a talented Frontend Software Engineer to join our dynamic development team. The ideal candidate will have strong experience with React, TypeScript, and modern web technologies.

KEY RESPONSIBILITIES:
- Develop and maintain responsive web applications using React and TypeScript
- Collaborate with UX/UI designers to implement pixel-perfect designs
- Optimize applications for maximum speed and scalability
- Write clean, maintainable code following best practices
- Participate in code reviews and mentor junior developers
- Work closely with backend teams to integrate APIs
- Ensure cross-browser compatibility and accessibility standards

REQUIRED QUALIFICATIONS:
- Bachelor's degree in Computer Science or related field
- 3+ years of experience in frontend development
- Proficiency in React, TypeScript, HTML5, CSS3
- Experience with state management (Redux, Context API)
- Knowledge of modern build tools (Webpack, Vite)
- Familiarity with version control (Git)
- Strong problem-solving and debugging skills

PREFERRED QUALIFICATIONS:
- Experience with Next.js or similar frameworks
- Knowledge of testing frameworks (Jest, Testing Library)
- Understanding of CI/CD pipelines
- Experience with cloud platforms (AWS, Azure)
- Familiarity with Agile development methodologies

COMPANY CULTURE:
TechSingapore values innovation, collaboration, and continuous learning. We offer flexible working arrangements, professional development opportunities, and a multicultural work environment that reflects Singapore's diverse talent pool.
`;

async function testJobDescriptionIntegration() {
  try {
    console.log('🚀 Testing Job Description Integration in AI Simulator...\n');

    // Step 1: Upload job description
    console.log('📄 Step 1: Uploading job description...');
    const jobDescFormData = new FormData();
    const jobDescBlob = new Blob([sampleJobDescription], { type: 'text/plain' });
    jobDescFormData.append('file', jobDescBlob, 'frontend-engineer-job.txt');
    jobDescFormData.append('userId', TEST_USER_ID);

    const uploadResponse = await fetch(`${API_BASE}/api/job-descriptions/upload`, {
      method: 'POST',
      body: jobDescFormData
    });

    if (!uploadResponse.ok) {
      throw new Error(`Upload failed: ${uploadResponse.status}`);
    }

    const jobDesc = await uploadResponse.json();
    console.log(`✅ Job description uploaded successfully. ID: ${jobDesc.id}`);
    console.log(`📝 Extracted text length: ${jobDesc.extractedText?.length || 0} characters\n`);

    // Step 2: Create practice session with job description
    console.log('🎭 Step 2: Creating practice session with job description...');
    const sessionData = {
      userId: TEST_USER_ID,
      position: 'Frontend Software Engineer',
      company: 'TechSingapore Pte Ltd',
      industry: 'Technology',
      interviewStage: 'technical-specialist',
      jobDescriptionId: jobDesc.id
    };

    const sessionResponse = await axios.post(`${API_BASE}/api/practice/sessions`, sessionData);
    const session = sessionResponse.data;
    
    console.log(`✅ Practice session created. ID: ${session.id}`);
    console.log(`👤 Generated Interviewer: ${session.interviewerName} - ${session.interviewerRole}`);
    console.log(`🎯 Personality: ${session.interviewerPersonality}`);
    console.log(`💬 Communication Style: ${session.interviewerCommunicationStyle}`);
    console.log(`📚 Background: ${session.interviewerBackground.substring(0, 100)}...\n`);

    // Step 3: Get initial greeting message to check job description influence
    console.log('💬 Step 3: Retrieving initial greeting message...');
    const messagesResponse = await axios.get(`${API_BASE}/api/practice/sessions/${session.id}/messages`);
    const messages = messagesResponse.data;

    if (messages.length > 0) {
      const greeting = messages[0];
      console.log(`✅ Initial greeting received:`);
      console.log(`"${greeting.content}"\n`);
    }

    // Step 4: Send a technical question to test job description integration
    console.log('🔧 Step 4: Testing technical question with job description context...');
    const testMessage = {
      message: "Can you tell me about your experience with React and TypeScript, specifically how you've used them in building scalable web applications?"
    };

    const messageResponse = await axios.post(`${API_BASE}/api/practice/sessions/${session.id}/message`, testMessage);
    const aiResponse = messageResponse.data;
    
    console.log(`✅ AI Response received:`);
    console.log(`"${aiResponse.aiResponse}"\n`);

    // Step 5: Check session context to verify job description integration
    console.log('🔍 Step 5: Verifying job description integration...');
    const sessionDetailResponse = await axios.get(`${API_BASE}/api/practice/sessions/${session.id}`);
    const sessionDetail = sessionDetailResponse.data;

    // Analysis
    console.log('📊 INTEGRATION ANALYSIS:');
    console.log('========================');
    
    const hasJobDescId = !!sessionDetail.jobDescriptionId;
    console.log(`✓ Job Description ID stored: ${hasJobDescId ? '✅ YES' : '❌ NO'}`);
    
    const interviewerRole = sessionDetail.interviewerRole.toLowerCase();
    const isTechnicalRole = interviewerRole.includes('technical') || 
                          interviewerRole.includes('engineer') || 
                          interviewerRole.includes('specialist') || 
                          interviewerRole.includes('expert');
    console.log(`✓ Appropriate technical interviewer role: ${isTechnicalRole ? '✅ YES' : '❌ NO'}`);
    
    const backgroundMentionsTech = sessionDetail.interviewerBackground.toLowerCase().includes('software') ||
                                  sessionDetail.interviewerBackground.toLowerCase().includes('frontend') ||
                                  sessionDetail.interviewerBackground.toLowerCase().includes('react') ||
                                  sessionDetail.interviewerBackground.toLowerCase().includes('typescript');
    console.log(`✓ Background mentions relevant tech: ${backgroundMentionsTech ? '✅ YES' : '❌ NO'}`);
    
    const objectivesMatchRole = sessionDetail.interviewObjectives?.some(obj => 
      obj.toLowerCase().includes('technical') || 
      obj.toLowerCase().includes('frontend') || 
      obj.toLowerCase().includes('react') ||
      obj.toLowerCase().includes('typescript') ||
      obj.toLowerCase().includes('development')
    );
    console.log(`✓ Objectives match job requirements: ${objectivesMatchRole ? '✅ YES' : '❌ NO'}`);

    const greetingMentionsCompany = messages.length > 0 && 
      messages[0].content.toLowerCase().includes('techsingapore');
    console.log(`✓ Greeting mentions correct company: ${greetingMentionsCompany ? '✅ YES' : '❌ NO'}`);

    // Step 6: Test without job description for comparison
    console.log('\n🔄 Step 6: Creating comparison session without job description...');
    const comparisonSessionData = {
      userId: TEST_USER_ID,
      position: 'Frontend Software Engineer',
      company: 'TechSingapore Pte Ltd',
      industry: 'Technology',
      interviewStage: 'technical-specialist'
      // No jobDescriptionId
    };

    const comparisonSessionResponse = await axios.post(`${API_BASE}/api/practice/sessions`, comparisonSessionData);
    const comparisonSession = comparisonSessionResponse.data;
    
    console.log(`✅ Comparison session created. ID: ${comparisonSession.id}`);
    console.log(`👤 Comparison Interviewer: ${comparisonSession.interviewerName} - ${comparisonSession.interviewerRole}`);

    // Final summary
    console.log('\n🎯 FINAL ASSESSMENT:');
    console.log('====================');
    const integrationScore = [hasJobDescId, isTechnicalRole, backgroundMentionsTech, objectivesMatchRole, greetingMentionsCompany]
      .filter(Boolean).length;
    
    console.log(`Integration Score: ${integrationScore}/5`);
    
    if (integrationScore >= 4) {
      console.log('🎉 EXCELLENT: Job description is properly integrated into AI simulation');
    } else if (integrationScore >= 3) {
      console.log('✅ GOOD: Job description integration is working but could be improved');
    } else {
      console.log('⚠️  NEEDS IMPROVEMENT: Job description integration may need attention');
    }

    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    // Note: In a real test, you might want to clean up the created sessions and job descriptions

    return {
      success: true,
      integrationScore,
      sessionId: session.id,
      comparisonSessionId: comparisonSession.id,
      jobDescriptionId: jobDesc.id
    };

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testJobDescriptionIntegration()
    .then(result => {
      console.log('\n📋 Test completed:', result);
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { testJobDescriptionIntegration };