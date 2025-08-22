import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

// Parse the provided API key to extract AWS credentials or bearer token
function parseBedrockCredentials(apiKey: string) {
  try {
    // Handle new AWS Bedrock API Key format (Bearer token)
    if (apiKey.length > 100 && !apiKey.includes(':') && !apiKey.includes('BedrockAPIKey-')) {
      return { type: 'bearer', token: apiKey };
    }
    
    // Handle direct AWS credentials format: ACCESS_KEY:SECRET_KEY
    if (apiKey.includes(':') && !apiKey.includes('BedrockAPIKey-')) {
      const parts = apiKey.split(':');
      if (parts.length >= 2) {
        return {
          type: 'credentials' as const,
          accessKeyId: parts[0].trim(),
          secretAccessKey: parts[1].trim()
        };
      }
    }
    
    // Handle legacy base64 encoded format
    try {
      const decoded = Buffer.from(apiKey, 'base64').toString('utf-8');
      const match = decoded.match(/BedrockAPIKey-(.+):(.+)/);
      if (match) {
        return {
          type: 'credentials' as const,
          accessKeyId: match[1].trim(),
          secretAccessKey: match[2].trim()
        };
      }
    } catch {
      // Not base64, continue with other formats
    }
    
    throw new Error('Invalid API key format');
  } catch (error) {
    throw new Error(`Failed to parse Bedrock credentials: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Initialize Bedrock client with error handling
let bedrockClient: BedrockRuntimeClient | null = null;
let initializationError: string | null = null;

try {
  const bedrockApiKey = process.env.BEDROCK_API_KEY;
  if (!bedrockApiKey) {
    throw new Error('BEDROCK_API_KEY environment variable is required');
  }

  const parsedCredentials = parseBedrockCredentials(bedrockApiKey);
  
  if (parsedCredentials.type === 'bearer') {
    throw new Error('Bearer token authentication not yet implemented. Please provide ACCESS_KEY:SECRET_KEY format.');
  } else if (parsedCredentials.type === 'credentials') {
    if (!parsedCredentials.accessKeyId || !parsedCredentials.secretAccessKey) {
      throw new Error('Invalid credentials: missing accessKeyId or secretAccessKey');
    }
    
    bedrockClient = new BedrockRuntimeClient({
      region: 'us-east-1',
      credentials: {
        accessKeyId: parsedCredentials.accessKeyId,
        secretAccessKey: parsedCredentials.secretAccessKey
      }
    });
  }
  
  console.log('Bedrock client initialized successfully with', parsedCredentials.type, 'authentication');
} catch (error) {
  initializationError = `Failed to initialize Bedrock client: ${error instanceof Error ? error.message : 'Unknown error'}`;
  console.error(initializationError);
}

export interface BedrockResponse {
  content: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export async function generateWithBedrock(
  prompt: string,
  modelId: string = 'anthropic.claude-3-5-haiku-20241022-v1:0'
): Promise<BedrockResponse> {
  if (!bedrockClient) {
    throw new Error(initializationError || 'Bedrock client not initialized');
  }
  
  try {
    console.log('Calling Bedrock with model:', modelId);
    console.log('Prompt length:', prompt.length);
    
    const command = new InvokeModelCommand({
      modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        top_p: 0.9
      })
    });

    const response = await bedrockClient.send(command);
    console.log('Bedrock response received, status:', response.$metadata.httpStatusCode);
    
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    console.log('Response parsed successfully');

    return {
      content: responseBody.content[0].text,
      usage: {
        inputTokens: responseBody.usage?.input_tokens || 0,
        outputTokens: responseBody.usage?.output_tokens || 0
      }
    };
  } catch (error) {
    console.error('Bedrock API error details:', error);
    console.error('Error type:', error instanceof Error ? error.constructor.name : typeof error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    throw new Error(`Bedrock API request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function generateInterviewFeedback(
  question: string,
  userResponse: string,
  interviewStage: string,
  position: string,
  company: string,
  jobDescription?: string
): Promise<string> {
  try {
    const contextPrompt = jobDescription 
      ? `Job Description Context: ${jobDescription.substring(0, 500)}...`
      : '';

    const prompt = `As an expert interview coach, provide comprehensive feedback for this ${interviewStage} interview response.

Question: "${question}"

Candidate Response: "${userResponse}"

Position: ${position}
Company: ${company}
${contextPrompt}

Please provide detailed feedback in the following JSON format:
{
  "overallScore": 4,
  "strengths": ["strength1", "strength2"],
  "areasForImprovement": ["improvement1", "improvement2"],
  "specificFeedback": "Detailed analysis of the response quality, structure, and content",
  "actionableAdvice": "Concrete suggestions for improvement",
  "scoreBreakdown": {
    "content": 4,
    "structure": 3,
    "relevance": 5,
    "impact": 4,
    "communication": 4
  }
}

Rate each aspect on a 1-5 scale where:
1 = Poor, needs significant improvement
2 = Below average, several areas to address  
3 = Average, meets basic expectations
4 = Good, above average with minor improvements needed
5 = Excellent, exceptional response

Focus on practical, actionable feedback that helps the candidate improve their interview performance.`;

    const response = await generateWithBedrock(prompt);
    
    // Clean up potential markdown formatting from the response
    let cleanResponse = response.content.trim();
    if (cleanResponse.startsWith('```json')) {
      cleanResponse = cleanResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    }
    
    // Validate JSON format
    try {
      JSON.parse(cleanResponse);
      return cleanResponse;
    } catch (parseError) {
      console.error('Failed to parse Bedrock JSON response:', parseError);
      console.error('Raw response:', cleanResponse);
      throw new Error('Invalid JSON response from Bedrock');
    }
  } catch (error) {
    console.error('Bedrock feedback generation failed:', error);
    
    // Generate intelligent fallback feedback using response analysis
    return generateIntelligentFallbackFeedback(question, userResponse, interviewStage, position, company, jobDescription);
  }
}

function generateIntelligentFallbackFeedback(
  question: string,
  userResponse: string,
  interviewStage: string,
  position: string,
  company: string,
  jobDescription?: string
): string {
  const responseLength = userResponse.length;
  const wordCount = userResponse.split(/\s+/).length;
  const sentences = userResponse.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
  
  let overallScore = 3; // Default to average
  let strengths: string[] = [];
  let improvements: string[] = [];
  let specificFeedback = "";
  let actionableAdvice = "";
  
  // Analyze response characteristics
  const lowerResponse = userResponse.toLowerCase();
  
  // Length analysis
  if (wordCount < 50) {
    improvements.push("Response could be more detailed with additional context and examples");
    overallScore = Math.max(overallScore - 0.5, 2);
  } else if (wordCount > 200) {
    improvements.push("Consider being more concise while maintaining key points");
  } else {
    strengths.push("Good response length with appropriate detail level");
  }
  
  // Structure analysis (look for storytelling elements)
  let hasStructure = false;
  const structureWords = ['situation', 'challenge', 'context', 'task', 'action', 'result', 'outcome', 'impact'];
  const foundStructureWords = structureWords.filter(word => lowerResponse.includes(word));
  
  if (foundStructureWords.length >= 2) {
    strengths.push("Response demonstrates structured storytelling approach");
    hasStructure = true;
    overallScore += 0.5;
  } else {
    improvements.push("Consider using the STAR method (Situation, Task, Action, Result) for better structure");
  }
  
  // Specificity analysis
  const specificityIndicators = ['specific', 'example', 'instance', 'experience', 'project', 'company', 'team', 'achieved', 'implemented', 'developed'];
  const foundSpecificityWords = specificityIndicators.filter(word => lowerResponse.includes(word));
  
  if (foundSpecificityWords.length >= 3) {
    strengths.push("Response includes specific examples and concrete details");
    overallScore += 0.3;
  } else {
    improvements.push("Include more specific examples and quantifiable results");
  }
  
  // Industry/role relevance analysis
  if (jobDescription) {
    const jdWords = jobDescription.toLowerCase().split(/\s+/).slice(0, 100);
    const commonWords = jdWords.filter(word => 
      word.length > 4 && 
      lowerResponse.includes(word) && 
      !['that', 'this', 'with', 'have', 'will', 'been', 'from', 'they', 'were', 'said'].includes(word)
    );
    
    if (commonWords.length >= 2) {
      strengths.push("Response demonstrates understanding of role requirements");
      overallScore += 0.2;
    } else {
      improvements.push("Connect response more directly to the specific role and requirements");
    }
  }
  
  // Generate specific feedback based on interview stage
  switch (interviewStage) {
    case 'phone-screening':
      specificFeedback = "This initial screening response should focus on clear communication, enthusiasm for the role, and basic qualifications alignment.";
      if (!lowerResponse.includes('interest') && !lowerResponse.includes('excited')) {
        improvements.push("Express more enthusiasm and specific interest in the opportunity");
      }
      break;
    
    case 'functional-team':
      specificFeedback = "Team interview responses should emphasize collaboration, communication skills, and ability to work effectively with diverse stakeholders.";
      if (!lowerResponse.includes('team') && !lowerResponse.includes('collaborate')) {
        improvements.push("Highlight team collaboration and cross-functional communication skills");
      }
      break;
    
    case 'hiring-manager':
      specificFeedback = "Hiring manager interviews focus on leadership potential, strategic thinking, and ability to drive results independently.";
      if (!lowerResponse.includes('lead') && !lowerResponse.includes('decision') && !lowerResponse.includes('manage')) {
        improvements.push("Demonstrate leadership experience and strategic decision-making capabilities");
      }
      break;
    
    case 'technical-specialist':
      specificFeedback = "Technical interviews require deep expertise demonstration, problem-solving methodology, and practical implementation experience.";
      if (!lowerResponse.includes('technical') && !lowerResponse.includes('solution') && !lowerResponse.includes('implement')) {
        improvements.push("Provide more technical depth and specific implementation details");
      }
      break;
    
    case 'executive-final':
      specificFeedback = "Executive interviews assess strategic vision, organizational impact, and long-term leadership potential.";
      if (!lowerResponse.includes('strategic') && !lowerResponse.includes('vision') && !lowerResponse.includes('impact')) {
        improvements.push("Focus on strategic impact, long-term vision, and organizational influence");
      }
      break;
    
    default:
      specificFeedback = "Response addresses the question but could benefit from more targeted storytelling and specific examples.";
  }
  
  // Generate actionable advice
  if (!hasStructure) {
    actionableAdvice = "Structure your response using STAR method: describe the Situation, explain your Task, detail the Actions you took, and highlight the Results achieved.";
  } else if (improvements.some(imp => imp.includes('specific'))) {
    actionableAdvice = "Strengthen your response by adding quantifiable metrics, specific timeframes, and concrete outcomes that demonstrate your impact.";
  } else {
    actionableAdvice = "Practice telling this story more concisely while ensuring you hit all key points that align with the role requirements.";
  }
  
  // Ensure score is within bounds
  overallScore = Math.max(1, Math.min(5, Math.round(overallScore)));
  
  return JSON.stringify({
    overallScore,
    strengths: strengths.length > 0 ? strengths : ["Response addresses the question directly"],
    areasForImprovement: improvements.length > 0 ? improvements : ["Consider adding more specific examples"],
    specificFeedback,
    actionableAdvice,
    scoreBreakdown: {
      content: overallScore,
      structure: hasStructure ? Math.min(overallScore + 1, 5) : Math.max(overallScore - 1, 1),
      relevance: jobDescription && improvements.some(imp => imp.includes('role')) ? overallScore - 1 : overallScore,
      impact: foundSpecificityWords.length >= 3 ? Math.min(overallScore + 1, 5) : overallScore,
      communication: sentences > 0 && wordCount > 20 ? overallScore : Math.max(overallScore - 1, 1)
    }
  });
}

export async function enhanceQuestionWithJobDescription(
  baseQuestion: string,
  jobDescription: string,
  position: string,
  company: string
): Promise<string> {
  const prompt = `Enhance this interview question by incorporating specific details from the job description while maintaining the original question's intent and structure.

Base Question: "${baseQuestion}"

Job Description: "${jobDescription.substring(0, 1000)}..."

Position: ${position}
Company: ${company}

Instructions:
1. Keep the core question structure intact
2. Add 1-2 specific requirements, technologies, or responsibilities from the job description
3. Make it feel natural and relevant to the role
4. Ensure it remains answerable even if the candidate hasn't worked at this exact company
5. If the job description seems unrelated to the question type, return the original question

Return only the enhanced question, no additional text or formatting.`;

  const response = await generateWithBedrock(prompt);
  return response.content.trim();
}