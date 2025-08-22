import OpenAI from "openai";
import type { ConversationMessage } from "@shared/schema";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Token optimization constants
const MAX_USER_INPUT_LENGTH = 1000; // Characters
const MAX_CONVERSATION_HISTORY = 10; // Number of message pairs to keep
const MAX_TOTAL_TOKENS = 4000; // Approximate token limit for conversation context

// Input validation and optimization functions
export function validateUserInput(input: string): { isValid: boolean; message?: string } {
  if (!input || input.trim().length === 0) {
    return { isValid: false, message: "Input cannot be empty" };
  }
  
  if (input.length > MAX_USER_INPUT_LENGTH) {
    return { 
      isValid: false, 
      message: `Input too long. Maximum ${MAX_USER_INPUT_LENGTH} characters allowed. Current: ${input.length}` 
    };
  }
  
  return { isValid: true };
}

export function truncateInput(input: string): string {
  if (input.length <= MAX_USER_INPUT_LENGTH) {
    return input;
  }
  return input.substring(0, MAX_USER_INPUT_LENGTH - 3) + "...";
}

// Estimate token count (rough approximation: 1 token ≈ 4 characters)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Optimize conversation history for token efficiency
export function optimizeConversationHistory(messages: ConversationMessage[]): ConversationMessage[] {
  // Keep only the most recent messages within token limits
  let totalTokens = 0;
  const optimizedMessages: ConversationMessage[] = [];
  
  // Process messages in reverse order (most recent first)
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    const messageTokens = estimateTokens(message.content);
    
    if (totalTokens + messageTokens > MAX_TOTAL_TOKENS) {
      break; // Stop if adding this message would exceed token limit
    }
    
    optimizedMessages.unshift(message); // Add to beginning
    totalTokens += messageTokens;
    
    // Limit number of message pairs
    if (optimizedMessages.length >= MAX_CONVERSATION_HISTORY * 2) {
      break;
    }
  }
  
  return optimizedMessages;
}

// Types for dynamic persona generation
export interface SimulationRequest {
  position: string;
  company: string;
  industry?: string;
  interviewStage: string;
  jobDescription?: string;
}

export interface GeneratedInterviewer {
  name: string;
  role: string;
  personality: string;
  communicationStyle: string;
  background: string;
  objectives: string[];
}

export interface StageConfiguration {
  interviewerType: string;
  focus: string;
  rolePrefix: string;
  requirements: string;
}

/**
 * Define stage-specific interviewer configurations
 */
function getStageConfiguration(interviewStage: string): StageConfiguration {
  const configurations: Record<string, StageConfiguration> = {
    'phone-screening': {
      interviewerType: 'HR Recruiter or Talent Acquisition Specialist',
      focus: 'Basic qualifications, culture fit, salary expectations',
      rolePrefix: 'HR Recruiter, Talent Acquisition Specialist, or People Operations',
      requirements: 'Must be from HR/People Operations team. Focus on initial screening, background verification, cultural fit assessment, and basic qualifications. Should be friendly, efficient, and process-oriented.'
    },
    'functional-team': {
      interviewerType: 'Team Member or Peer',
      focus: 'Team dynamics, collaboration, role-specific skills',
      rolePrefix: 'Team Member, Senior Team Member, or Team Lead',
      requirements: 'Must be a current team member or peer who would work directly with the candidate. Focus on collaboration skills, team dynamics, technical skills relevant to daily work, and cultural fit within the team.'
    },
    'hiring-manager': {
      interviewerType: 'Direct Manager or Department Head',
      focus: 'Leadership assessment, strategic thinking, team fit',
      rolePrefix: 'Manager, Director, or Department Head',
      requirements: 'Must be the direct manager or someone in management hierarchy. Focus on leadership potential, strategic thinking, decision-making abilities, and how the candidate would contribute to team goals and company growth.'
    },
    'technical-specialist': {
      interviewerType: 'Industry Specialist or Subject Matter Expert',
      focus: 'Industry-specific expertise, domain knowledge, specialized skills',
      rolePrefix: 'Senior Specialist, Subject Matter Expert, Principal Consultant, or Industry Expert',
      requirements: 'Must be a senior specialist with deep industry expertise. Focus on industry-specific knowledge, domain expertise, specialized methodologies, regulatory understanding, and industry best practices. Should be highly knowledgeable about the specific industry and role requirements.'
    },
    'executive-final': {
      interviewerType: 'Senior Executive or C-Level',
      focus: 'Vision alignment, cultural impact, final decision',
      rolePrefix: 'VP, SVP, Chief Officer, or Senior Executive',
      requirements: 'Must be a senior executive (VP level or above). Focus on strategic vision alignment, cultural impact, long-term thinking, executive presence, and final hiring decision. Should be authoritative and focused on big-picture thinking.'
    }
  };

  return configurations[interviewStage] || configurations['hiring-manager'];
}

/**
 * Generates a custom interviewer persona based on user inputs
 */
export async function generateInterviewerPersona(request: SimulationRequest): Promise<GeneratedInterviewer> {
  const { position, company, industry, interviewStage, jobDescription } = request;
  
  // Define stage-specific interviewer types and responsibilities
  const stageConfig = getStageConfiguration(interviewStage);
  
  const industryContext = industry ? `
INDUSTRY-SPECIFIC CONTEXT for ${industry}:
This interviewer must have deep expertise in ${industry} and should ask questions relevant to this industry's standards, regulations, challenges, and best practices. They should understand the industry's unique requirements and speak the industry language.` : '';

  const prompt = `Generate a realistic interviewer persona for this interview scenario:

Position: ${position}
Company: ${company}
Industry: ${industry || 'Technology'}
Interview Stage: ${interviewStage}
Stage Focus: ${stageConfig.focus}
Interviewer Type: ${stageConfig.interviewerType}
${jobDescription ? `Job Description: ${jobDescription.substring(0, 500)}...` : ''}

CRITICAL REQUIREMENTS for ${interviewStage} stage:
${stageConfig.requirements}
${industryContext}

CULTURAL LOCALIZATION REQUIREMENTS:
- Use Southeast Asian names (e.g., Wei Lin, Priya Sharma, Ahmad Rahman, Maria Santos, Kai Tanaka, Siti Nurhaliza, etc.)
- Incorporate Southeast Asian business culture and professional context
- Reference regional business practices, work culture, and professional expectations
- Consider multicultural dynamics common in Southeast Asian workplaces
- Use professional communication styles typical in Singapore, Malaysia, Thailand, Philippines, Indonesia, Vietnam

The interviewer MUST be a ${stageConfig.interviewerType}, NOT a technical engineer or other role unless specifically relevant to the industry.

Create a professional interviewer with these exact fields (respond in valid JSON format):
{
  "name": "First Last",
  "role": "Must be ${stageConfig.rolePrefix} - NOT an engineer",
  "personality": "Brief personality description fitting ${stageConfig.interviewerType}",
  "communicationStyle": "How they communicate in interviews for ${interviewStage}",
  "background": "Professional background as ${stageConfig.interviewerType} at ${company}",
  "objectives": ["objective1", "objective2", "objective3", "objective4"]
}

REMEMBER: For ${interviewStage}, the interviewer must be ${stageConfig.interviewerType}.

Ensure the persona matches the seniority and responsibilities expected for ${interviewStage} at ${company}.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert at creating realistic interviewer personas. Always respond with valid JSON only."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    
    // Validate the response has all required fields
    if (!result.name || !result.role || !result.personality || !result.communicationStyle || !result.background || !result.objectives) {
      throw new Error('Invalid persona response from OpenAI');
    }

    return result as GeneratedInterviewer;
  } catch (error) {
    console.error('Error generating interviewer persona:', error);
    
    // Fallback to a generic persona based on interview stage
    return generateFallbackPersona(interviewStage, company, position);
  }
}

/**
 * Fallback persona generator if OpenAI fails
 */
function generateFallbackPersona(interviewStage: string, company: string, position: string): GeneratedInterviewer {
  const stageConfig = getStageConfiguration(interviewStage);
  
  const fallbackPersonas: Record<string, GeneratedInterviewer> = {
    'phone-screening': {
      name: 'Priya Lim',
      role: 'Senior HR Recruiter',
      personality: 'Warm and efficient, focused on cultural harmony and professional qualifications. Known for creating inclusive environments while thoroughly assessing candidate fit.',
      communicationStyle: 'Professional but approachable, uses respectful questioning style common in Southeast Asian business culture. Values relationship-building.',
      background: `Senior HR Recruiter at ${company} with 6+ years in multicultural talent acquisition across Southeast Asia. Specializes in screening candidates for ${position} roles.`,
      objectives: [
        'Verify qualifications and cultural adaptability',
        'Assess communication skills in diverse workplace',
        'Understand motivation and respect for organizational hierarchy',
        'Screen for regional business culture alignment'
      ]
    },
    'functional-team': {
      name: 'Wei Ming Tan',
      role: 'Senior Team Member',
      personality: 'Collaborative and harmony-focused, values team consensus and respectful problem-solving approaches in multicultural settings.',
      communicationStyle: 'Respectful and inclusive, emphasizes team dynamics and collaborative work style. Discusses challenges with cultural sensitivity.',
      background: `Senior team member at ${company} with 7+ years experience in diverse Southeast Asian teams. Would work directly with the new ${position}.`,
      objectives: [
        'Evaluate collaboration in multicultural teams',
        'Assess respect for hierarchy and team harmony',
        'Test problem-solving with cultural awareness',
        'Understand adaptation to regional work styles'
      ]
    },
    'hiring-manager': {
      name: 'Ahmad Rizal',
      role: 'Department Manager',
      personality: 'Strategic and balanced, focused on leadership that respects cultural diversity while driving business results in Southeast Asian markets.',
      communicationStyle: 'Thoughtful and respectful, probes for examples while maintaining professional courtesy. Values both results and relationship-building.',
      background: `Department Manager at ${company} with 10+ years experience leading diverse teams across Southeast Asia. Expert in regional hiring for ${position} roles.`,
      objectives: [
        'Evaluate culturally-aware leadership potential',
        'Assess strategic thinking for regional markets',
        'Understand team building in diverse environments',
        'Test adaptability to Southeast Asian business practices'
      ]
    },
    'technical-specialist': {
      name: 'Dr. Siti Rahman',
      role: 'Principal Industry Specialist',
      personality: 'Highly knowledgeable and intellectually curious, enjoys deep industry discussions while respecting diverse professional backgrounds.',
      communicationStyle: 'Professional and thorough, asks detailed questions about industry expertise with cultural sensitivity and regional context awareness.',
      background: `Principal Industry Specialist at ${company} with PhD and 15+ years experience in Southeast Asian markets. Expert in evaluating industry depth for ${position} roles.`,
      objectives: [
        'Evaluate deep industry expertise and regional knowledge',
        'Test understanding of Southeast Asian market dynamics',
        'Assess problem-solving with cultural and regulatory awareness',
        'Understand leadership potential in diverse professional environments'
      ]
    },
    'executive-final': {
      name: 'Catherine Wijaya',
      role: 'Vice President',
      personality: 'Strategic visionary who balances global business goals with regional cultural sensitivity. Values innovation that respects diverse stakeholder needs.',
      communicationStyle: 'High-level and diplomatic, interested in vision alignment, cultural impact, and sustainable regional growth strategies.',
      background: `Vice President at ${company} with extensive leadership experience across Southeast Asian markets. Makes final hiring decisions for senior ${position} roles.`,
      objectives: [
        'Assess strategic vision for regional expansion',
        'Evaluate cultural leadership and market sensitivity',
        'Test ability to drive innovation with cultural awareness',
        'Understand potential for sustainable organizational impact'
      ]
    }
  };

  return fallbackPersonas[interviewStage] || fallbackPersonas['hiring-manager'];
}

// Using ConversationMessage type from shared schema
export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface SessionContext {
  position: string;
  company: string;
  industry?: string;
  interviewStage: string;
  jobDescription?: string;
  interviewer: GeneratedInterviewer;
}

export class OpenAIInterviewer {
  private conversationHistory: OpenAIMessage[] = [];
  private sessionContext: SessionContext;

  constructor(sessionContext: SessionContext) {
    this.sessionContext = sessionContext;
    this.initializeConversation();
  }

  private initializeConversation() {
    const systemPrompt = this.buildSystemPrompt();
    this.conversationHistory = [
      {
        role: 'system',
        content: systemPrompt
      }
    ];
  }

  private buildSystemPrompt(): string {
    const { interviewer, position, company, interviewStage, industry, jobDescription } = this.sessionContext;

    return `You are ${interviewer.name}, a ${interviewer.role} conducting a ${interviewStage} interview for the ${position} position at ${company}.

PERSONALITY & STYLE:
- ${interviewer.personality}
- Communication style: ${interviewer.communicationStyle}
- Background: ${interviewer.background}

IMPORTANT CONVERSATION RULES:
- Do NOT introduce yourself again if you have already done so in the conversation
- Build upon the conversation naturally without repeating previous information
- If the candidate responds to your introduction, acknowledge it and continue with the interview
- Stay in character throughout the entire conversation

INTERVIEW CONTEXT:
- Position: ${position}
- Company: ${company}
- Industry: ${industry || 'Technology'}
- Interview Stage: ${interviewStage}
${jobDescription ? `- Job Description: ${jobDescription}` : ''}

OBJECTIVES FOR THIS SESSION:
${interviewer.objectives.map((obj: string) => `- ${obj}`).join('\n')}

INTERVIEW GUIDELINES:
1. Stay in character as ${interviewer.name} throughout the conversation
2. Ask relevant, realistic interview questions appropriate for the ${interviewStage} stage
3. For INDUSTRY SPECIALIST interviews, focus on ${industry || 'technology'}-specific knowledge, regulations, methodologies, and industry best practices
4. Respond naturally to the candidate's answers with follow-up questions
5. Keep responses conversational and authentic (2-3 sentences typically)
6. Gradually increase difficulty based on the candidate's responses
7. Provide realistic interviewer reactions (interest, clarification, probing deeper)
8. For behavioral questions, gently guide candidates toward STAR method (Situation, Task, Action, Result) by asking follow-up questions like "Can you tell me more about the specific situation?" or "What was the outcome of that approach?"
9. End the interview naturally after covering key areas or if time constraints mentioned

BEHAVIOR:
- Be professional but human-like in your responses
- Show genuine interest in the candidate's experiences
- Ask follow-up questions based on their answers
- Occasionally provide brief context about the role/company when relevant
- Keep the conversation flowing naturally like a real interview

Begin the interview with a warm greeting and brief introduction, then proceed with interview questions appropriate for this stage.`;
  }

  async getResponse(userMessage: string): Promise<string> {
    // Add user message to history
    this.conversationHistory.push({
      role: 'user',
      content: userMessage
    });

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: this.conversationHistory.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        max_tokens: 300,
        temperature: 0.7,
      });

      const assistantResponse = completion.choices[0].message.content || "I'm sorry, could you repeat that?";

      // Add assistant response to history
      this.conversationHistory.push({
        role: 'assistant',
        content: assistantResponse
      });

      return assistantResponse;
    } catch (error) {
      console.error('OpenAI API error:', error);
      throw new Error('Failed to get AI response');
    }
  }

  getConversationHistory(): OpenAIMessage[] {
    return this.conversationHistory.filter(msg => msg.role !== 'system');
  }

  async generateFeedback(): Promise<{
    overallScore: number;
    criteriaScores: Record<string, number>;
    criteriaFeedback: Record<string, { score: number; feedback: string; suggestions: string[] }>;
    starAnalysis: {
      situation: { present: boolean; score: number; feedback: string };
      task: { present: boolean; score: number; feedback: string };
      action: { present: boolean; score: number; feedback: string };
      result: { present: boolean; score: number; feedback: string };
      overallStarScore: number;
    };
    feedback: string;
    improvements: string[];
  }> {
    const conversationText = this.conversationHistory
      .filter(msg => msg.role !== 'system')
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    const feedbackPrompt = `Analyze this interview conversation using the new 7-criteria assessment system (each out of 5, total 35 max):

${conversationText}

Provide feedback in the following JSON format:
{
  "overallScore": <number 1-35 (sum of 7 criteria)>,
  "criteriaScores": {
    "relevance": <number 1-5>,
    "structured": <number 1-5>,
    "specific": <number 1-5>,
    "honest": <number 1-5>,
    "confident": <number 1-5>,
    "aligned": <number 1-5>,
    "outcomeOriented": <number 1-5>
  },
  "criteriaFeedback": {
    "relevance": {
      "score": <number 1-5>,
      "feedback": "<detailed feedback on answer relevance to question>",
      "suggestions": ["<specific suggestion 1>", "<specific suggestion 2>"]
    },
    "structured": {
      "score": <number 1-5>,
      "feedback": "<detailed feedback on STAR structure usage>",
      "suggestions": ["<specific suggestion 1>", "<specific suggestion 2>"]
    },
    "specific": {
      "score": <number 1-5>,
      "feedback": "<detailed feedback on specificity and detail level>",
      "suggestions": ["<specific suggestion 1>", "<specific suggestion 2>"]
    },
    "honest": {
      "score": <number 1-5>,
      "feedback": "<detailed feedback on authenticity and honesty>",
      "suggestions": ["<specific suggestion 1>", "<specific suggestion 2>"]
    },
    "confident": {
      "score": <number 1-5>,
      "feedback": "<detailed feedback on confidence level - not arrogance>",
      "suggestions": ["<specific suggestion 1>", "<specific suggestion 2>"]
    },
    "aligned": {
      "score": <number 1-5>,
      "feedback": "<detailed feedback on role/company alignment>",
      "suggestions": ["<specific suggestion 1>", "<specific suggestion 2>"]
    },
    "outcomeOriented": {
      "score": <number 1-5>,
      "feedback": "<detailed feedback on results and outcome focus>",
      "suggestions": ["<specific suggestion 1>", "<specific suggestion 2>"]
    }
  },
  "starAnalysis": {
    "situation": {
      "present": <boolean>,
      "score": <number 1-5>,
      "feedback": "<specific feedback on situation/context description>"
    },
    "task": {
      "present": <boolean>,
      "score": <number 1-5>,
      "feedback": "<specific feedback on task/objective clarity>"
    },
    "action": {
      "present": <boolean>,
      "score": <number 1-5>,
      "feedback": "<specific feedback on actions taken>"
    },
    "result": {
      "present": <boolean>,
      "score": <number 1-5>,
      "feedback": "<specific feedback on results/outcomes achieved>"
    },
    "overallStarScore": <number 1-5>
  },
  "feedback": "<comprehensive feedback paragraph covering all 7 criteria>",
  "improvements": ["<improvement 1>", "<improvement 2>", "<improvement 3>", "<improvement 4>", "<improvement 5>"]
}

NEW 7-CRITERIA ASSESSMENT SYSTEM:

1. RELEVANCE (1-5): How well did answers directly address the questions asked?
   - 5: Perfect relevance, directly answered every part of the question
   - 4: High relevance, addressed most aspects of the question
   - 3: Moderate relevance, some parts addressed but some tangents
   - 2: Low relevance, partially addressed but significant gaps
   - 1: Poor relevance, answers didn't match the questions

2. STRUCTURED (STAR) (1-5): How well did the candidate use the STAR methodology?
   - 5: Perfect STAR structure with clear Situation, Task, Action, Result
   - 4: Good STAR usage, most elements present and well-organized
   - 3: Basic STAR structure, some elements clear but could be better organized
   - 2: Weak STAR usage, few elements present or poorly structured
   - 1: No STAR structure, answers were unorganized

3. SPECIFIC (1-5): Level of detail and specificity in examples and explanations
   - 5: Highly specific with concrete examples, numbers, dates, outcomes
   - 4: Good specificity with clear examples and some quantifiable details
   - 3: Moderate specificity, some examples but could be more detailed
   - 2: Low specificity, vague examples with little detail
   - 1: Very general, no specific examples or concrete details

4. HONEST (1-5): Authenticity and genuineness of responses
   - 5: Completely authentic, acknowledged challenges and failures appropriately
   - 4: Mostly honest, showed vulnerability and learning from mistakes
   - 3: Generally honest but may have avoided some difficult topics
   - 2: Somewhat evasive, tried to present only positive aspects
   - 1: Overly polished or potentially fabricated responses

5. CONFIDENT (but not arrogant) (1-5): Appropriate level of self-assurance
   - 5: Perfect confidence, articulate and assured without being arrogant
   - 4: Good confidence, spoke with conviction while remaining humble
   - 3: Moderate confidence, some hesitation but generally positive
   - 2: Low confidence, frequent self-doubt or uncertainty
   - 1: Either very insecure or overly arrogant

6. ALIGNED WITH THE ROLE (1-5): How well responses demonstrated fit for the position
   - 5: Perfect alignment, clearly demonstrated role-relevant skills and mindset
   - 4: Strong alignment, most responses showed good role fit
   - 3: Moderate alignment, some relevant connections made
   - 2: Weak alignment, limited connection to role requirements
   - 1: Poor alignment, responses didn't demonstrate role fit

7. OUTCOME ORIENTED (1-5): Focus on results, achievements, and measurable impact
   - 5: Excellent focus on outcomes with specific results and metrics
   - 4: Good outcome focus, clear results mentioned in most examples
   - 3: Moderate outcome focus, some results mentioned
   - 2: Limited outcome focus, mostly process-oriented responses
   - 1: Poor outcome focus, no clear results or achievements mentioned

STAR Framework Analysis (still included for structured feedback):
- Situation: Did the candidate provide clear context and background?
- Task: Was the specific role/objective clearly articulated?
- Action: Were the steps taken described in detail?
- Result: Were outcomes and learnings shared effectively?

Provide comprehensive, constructive feedback focusing on these 7 criteria with specific, actionable suggestions for improvement.`;

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: 'user', content: feedbackPrompt }],
        response_format: { type: "json_object" },
        temperature: 0.3,
      });

      const feedbackData = JSON.parse(completion.choices[0].message.content || '{}');
      
      // New 7-criteria scoring system
      const criteriaScores = {
        relevance: Math.round(feedbackData.criteriaScores?.relevance || 3),
        structured: Math.round(feedbackData.criteriaScores?.structured || 3),
        specific: Math.round(feedbackData.criteriaScores?.specific || 3),
        honest: Math.round(feedbackData.criteriaScores?.honest || 3),
        confident: Math.round(feedbackData.criteriaScores?.confident || 3),
        aligned: Math.round(feedbackData.criteriaScores?.aligned || 3),
        outcomeOriented: Math.round(feedbackData.criteriaScores?.outcomeOriented || 3)
      };
      
      // Calculate overall score as sum of 7 criteria (max 35)
      const calculatedOverallScore = 
        criteriaScores.relevance + 
        criteriaScores.structured + 
        criteriaScores.specific + 
        criteriaScores.honest + 
        criteriaScores.confident + 
        criteriaScores.aligned + 
        criteriaScores.outcomeOriented;
      
      // Create detailed criteria feedback with fallbacks
      const criteriaFeedback = {
        relevance: {
          score: criteriaScores.relevance,
          feedback: feedbackData.criteriaFeedback?.relevance?.feedback || 'Answer relevance needs improvement',
          suggestions: feedbackData.criteriaFeedback?.relevance?.suggestions || ['Be more specific in addressing the question', 'Stay focused on what was asked']
        },
        structured: {
          score: criteriaScores.structured,
          feedback: feedbackData.criteriaFeedback?.structured?.feedback || 'STAR structure could be better organized',
          suggestions: feedbackData.criteriaFeedback?.structured?.suggestions || ['Use clear STAR methodology', 'Organize responses with Situation, Task, Action, Result']
        },
        specific: {
          score: criteriaScores.specific,
          feedback: feedbackData.criteriaFeedback?.specific?.feedback || 'Responses need more specific details',
          suggestions: feedbackData.criteriaFeedback?.specific?.suggestions || ['Include specific examples and numbers', 'Provide concrete details and outcomes']
        },
        honest: {
          score: criteriaScores.honest,
          feedback: feedbackData.criteriaFeedback?.honest?.feedback || 'Authenticity comes through well',
          suggestions: feedbackData.criteriaFeedback?.honest?.suggestions || ['Continue being genuine', 'Share both successes and challenges']
        },
        confident: {
          score: criteriaScores.confident,
          feedback: feedbackData.criteriaFeedback?.confident?.feedback || 'Confidence level is appropriate',
          suggestions: feedbackData.criteriaFeedback?.confident?.suggestions || ['Speak with more conviction', 'Balance confidence with humility']
        },
        aligned: {
          score: criteriaScores.aligned,
          feedback: feedbackData.criteriaFeedback?.aligned?.feedback || 'Role alignment could be stronger',
          suggestions: feedbackData.criteriaFeedback?.aligned?.suggestions || ['Connect experiences to role requirements', 'Demonstrate relevant skills more clearly']
        },
        outcomeOriented: {
          score: criteriaScores.outcomeOriented,
          feedback: feedbackData.criteriaFeedback?.outcomeOriented?.feedback || 'Focus more on results and outcomes',
          suggestions: feedbackData.criteriaFeedback?.outcomeOriented?.suggestions || ['Emphasize measurable results', 'Share specific achievements and impact']
        }
      };
      
      const normalizedData = {
        overallScore: calculatedOverallScore,
        criteriaScores,
        criteriaFeedback,
        starAnalysis: {
          situation: {
            present: feedbackData.starAnalysis?.situation?.present || false,
            score: Math.round(feedbackData.starAnalysis?.situation?.score || 1),
            feedback: feedbackData.starAnalysis?.situation?.feedback || 'No situation context provided'
          },
          task: {
            present: feedbackData.starAnalysis?.task?.present || false,
            score: Math.round(feedbackData.starAnalysis?.task?.score || 1),
            feedback: feedbackData.starAnalysis?.task?.feedback || 'Task/objective not clearly defined'
          },
          action: {
            present: feedbackData.starAnalysis?.action?.present || false,
            score: Math.round(feedbackData.starAnalysis?.action?.score || 1),
            feedback: feedbackData.starAnalysis?.action?.feedback || 'Specific actions not detailed'
          },
          result: {
            present: feedbackData.starAnalysis?.result?.present || false,
            score: Math.round(feedbackData.starAnalysis?.result?.score || 1),
            feedback: feedbackData.starAnalysis?.result?.feedback || 'Results/outcomes not shared'
          },
          overallStarScore: Math.round(feedbackData.starAnalysis?.overallStarScore || 1)
        },
        feedback: feedbackData.feedback || 'No feedback provided',
        improvements: Array.isArray(feedbackData.improvements) ? feedbackData.improvements : []
      };
      
      return normalizedData;
    } catch (error) {
      console.error('Error generating feedback:', error);
      throw new Error('Failed to generate feedback');
    }
  }
}

// Utility function to convert generated interviewer to session context
export function createSessionContext(
  position: string,
  company: string,
  industry: string | undefined,
  interviewStage: string,
  jobDescription: string | undefined,
  interviewer: GeneratedInterviewer
): SessionContext {
  return {
    position,
    company,
    industry,
    interviewStage,
    jobDescription,
    interviewer
  };
}