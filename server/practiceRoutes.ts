import { Router } from 'express';
import multer from 'multer';
import { storage } from './storage';
import { insertConversationMessageSchema } from '@shared/schema';
import { 
  OpenAIInterviewer,
  generateInterviewerPersona,
  createSessionContext,
  validateUserInput,
  truncateInput,
  optimizeConversationHistory,
  type SimulationRequest 
} from './openai';
import { audioService } from './audioService';
import { z } from 'zod';

const router = Router();

// Configure multer for audio file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit (OpenAI's limit)
  },
  fileFilter: (req, file, cb) => {
    // Expand allowed MIME types to include common browser recording formats
    const allowedMimes = [
      // Standard audio formats
      'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/mp4',
      // WebM audio (common in browsers)
      'audio/webm', 'audio/webm;codecs=opus',
      // Fallback for browsers that report video MIME for audio recordings
      'video/webm', 'video/mp4',
      // Generic audio types
      'audio/ogg', 'audio/x-wav', 'audio/vnd.wav'
    ];
    
    console.log(`Received file: ${file.originalname}, MIME: ${file.mimetype}`);
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      console.error(`Unsupported audio format: ${file.mimetype}`);
      cb(new Error(`Unsupported audio format: ${file.mimetype}. Supported formats: MP3, WAV, M4A, WebM`));
    }
  }
});

// Schema for creating a new practice session with user inputs
const createSessionSchema = z.object({
  userId: z.string(),
  position: z.string(),
  company: z.string(),
  industry: z.string().optional(),
  interviewStage: z.enum(['phone-screening', 'functional-team', 'hiring-manager', 'technical-specialist', 'executive-final']),
  jobDescriptionId: z.string().optional()
});

// Create a new practice session with dynamic persona generation
router.post('/sessions', async (req, res) => {
  try {
    const sessionData = createSessionSchema.parse(req.body);
    
    // Get job description if provided
    let jobDescription: string | undefined;
    if (sessionData.jobDescriptionId) {
      const jd = await storage.getJobDescription(sessionData.jobDescriptionId);
      jobDescription = jd?.extractedText || undefined;
    }
    
    // Generate interviewer persona based on user inputs
    const simulationRequest: SimulationRequest = {
      position: sessionData.position,
      company: sessionData.company,
      industry: sessionData.industry,
      interviewStage: sessionData.interviewStage,
      jobDescription
    };
    
    const interviewer = await generateInterviewerPersona(simulationRequest);
    
    // Create session with generated persona - start as active
    const session = await storage.createPracticeSession({
      userId: sessionData.userId,
      position: sessionData.position,
      company: sessionData.company,
      industry: sessionData.industry,
      interviewStage: sessionData.interviewStage,
      jobDescriptionId: sessionData.jobDescriptionId,
      stage: 'active', // Start sessions as active so they can receive messages
      interviewerName: interviewer.name,
      interviewerRole: interviewer.role,
      interviewerPersonality: interviewer.personality,
      interviewerCommunicationStyle: interviewer.communicationStyle,
      interviewerBackground: interviewer.background,
      interviewObjectives: interviewer.objectives,
      startedAt: new Date() // Mark when the interview started
    });

    // Generate automatic interviewer greeting message
    const sessionContext = createSessionContext(
      sessionData.position,
      sessionData.company,
      sessionData.industry,
      sessionData.interviewStage,
      jobDescription,
      interviewer
    );

    const aiInterviewer = new OpenAIInterviewer(sessionContext);
    
    // Generate opening greeting
    const greetingPrompt = `You are ${interviewer.name}, ${interviewer.role} at ${sessionData.company}. 
    This is the start of a ${sessionData.interviewStage} interview for the ${sessionData.position} position.
    
    Generate a warm, professional opening greeting that:
    1. Introduces yourself briefly
    2. Acknowledges the candidate's interest in the position
    3. Sets a positive, encouraging tone
    4. Transitions smoothly into the first interview question
    
    Keep it conversational and authentic to your personality: ${interviewer.personality}
    Communication style: ${interviewer.communicationStyle}
    
    This should be 2-3 sentences maximum.`;

    try {
      const greeting = await aiInterviewer.getResponse(greetingPrompt);
      
      // Save the greeting message
      const greetingMsgData = {
        sessionId: session.id,
        role: 'assistant' as const,
        content: greeting,
        timestamp: new Date(),
        messageOrder: 1
      };

      await storage.addConversationMessage(greetingMsgData);
      
      // Return session with the greeting included
      res.json({
        ...session,
        hasGreeting: true
      });
    } catch (greetingError) {
      console.error('Error generating greeting:', greetingError);
      // If greeting fails, still return the session successfully
      res.json(session);
    }
  } catch (error) {
    console.error('Error creating practice session:', error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to create practice session' });
  }
});

// Get practice session
router.get('/sessions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const session = await storage.getPracticeSession(id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Include conversation messages
    const messages = await storage.getConversationMessages(session.id);

    res.json({
      ...session,
      messages
    });
  } catch (error) {
    console.error('Error fetching practice session:', error);
    res.status(500).json({ error: 'Failed to fetch practice session' });
  }
});

// Update practice session
router.patch('/sessions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const session = await storage.updatePracticeSession(id, updates);
    res.json(session);
  } catch (error) {
    console.error('Error updating practice session:', error);
    res.status(500).json({ error: 'Failed to update practice session' });
  }
});

// Get user's practice sessions
router.get('/sessions/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const sessions = await storage.getPracticeSessionsByUser(userId);
    res.json(sessions);
  } catch (error) {
    console.error('Error fetching user sessions:', error);
    res.status(500).json({ error: 'Failed to fetch user sessions' });
  }
});

// Start interview conversation
router.post('/sessions/:id/start', async (req, res) => {
  try {
    const { id } = req.params;
    const session = await storage.getPracticeSession(id);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.stage !== 'setup') {
      return res.status(400).json({ error: 'Session must be in setup stage to start' });
    }

    // Get job description if provided
    let jobDescription: string | undefined;
    if (session.jobDescriptionId) {
      const jd = await storage.getJobDescription(session.jobDescriptionId);
      jobDescription = jd?.extractedText || undefined;
    }

    // Create session context with generated interviewer persona
    const interviewer = {
      name: session.interviewerName || 'Interviewer',
      role: session.interviewerRole || 'Interviewer',
      personality: session.interviewerPersonality || 'Professional and engaging',
      communicationStyle: session.interviewerCommunicationStyle || 'Direct and friendly',
      background: session.interviewerBackground || 'Experienced professional',
      objectives: Array.isArray(session.interviewObjectives) ? session.interviewObjectives : []
    };

    const sessionContext = createSessionContext(
      session.position,
      session.company,
      session.industry || undefined,
      session.interviewStage,
      jobDescription,
      interviewer
    );

    // Create AI interviewer
    const aiInterviewer = new OpenAIInterviewer(sessionContext);
    
    // Get initial greeting
    const greeting = await aiInterviewer.getResponse("Hello! I'm ready to start the interview.");

    // Save the greeting as the first message
    await storage.addConversationMessage({
      sessionId: id,
      role: 'assistant',
      content: greeting,
      messageOrder: 1
    });

    // Update session to active state
    const updatedSession = await storage.updatePracticeSession(id, {
      stage: 'active',
      startedAt: new Date()
    });

    res.json({
      session: updatedSession,
      greeting
    });

  } catch (error) {
    console.error('Error starting session:', error);
    res.status(500).json({ error: 'Failed to start session' });
  }
});

// Send message to AI interviewer
router.post('/sessions/:id/message', async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Validate and optimize user input for token efficiency
    const validation = validateUserInput(message);
    if (!validation.isValid) {
      return res.status(400).json({ error: validation.message });
    }

    // Truncate input if necessary (with user notification)
    const optimizedMessage = truncateInput(message);
    const wasTruncated = optimizedMessage !== message;

    const session = await storage.getPracticeSession(id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Auto-activate session if it's in setup stage (for immediate usability)
    if (session.stage === 'setup') {
      await storage.updatePracticeSession(id, { stage: 'active', startedAt: new Date() });
      session.stage = 'active'; // Update local session object
    }
    
    if (session.stage !== 'active') {
      return res.status(400).json({ error: 'Session must be active to send messages' });
    }

    // Get job description if provided
    let jobDescription: string | undefined;
    if (session.jobDescriptionId) {
      const jd = await storage.getJobDescription(session.jobDescriptionId);
      jobDescription = jd?.extractedText || undefined;
    }

    // Create session context
    const interviewer = {
      name: session.interviewerName || 'Interviewer',
      role: session.interviewerRole || 'Interviewer',
      personality: session.interviewerPersonality || 'Professional and engaging',
      communicationStyle: session.interviewerCommunicationStyle || 'Direct and friendly',
      background: session.interviewerBackground || 'Experienced professional',
      objectives: Array.isArray(session.interviewObjectives) ? session.interviewObjectives : []
    };

    const sessionContext = createSessionContext(
      session.position,
      session.company,
      session.industry || undefined,
      session.interviewStage,
      jobDescription,
      interviewer
    );

    // Create AI interviewer and restore conversation history
    const aiInterviewer = new OpenAIInterviewer(sessionContext);
    const messages = await storage.getConversationMessages(id);
    
    // Optimize conversation history for token efficiency
    const optimizedMessages = optimizeConversationHistory(messages);
    
    // Restore optimized conversation history (skip system message which is already included)
    for (const msg of optimizedMessages) {
      if (msg.role === 'user') {
        await aiInterviewer.getResponse(msg.content);
      }
    }

    // Get next message order
    const nextOrder = messages.length + 1;

    // Save user message (use optimized version)
    await storage.addConversationMessage({
      sessionId: id,
      role: 'user',
      content: optimizedMessage,
      messageOrder: nextOrder
    });

    // Get AI response
    const aiResponse = await aiInterviewer.getResponse(optimizedMessage);

    // Save AI response
    await storage.addConversationMessage({
      sessionId: id,
      role: 'assistant',
      content: aiResponse,
      messageOrder: nextOrder + 1
    });

    res.json({
      userMessage: optimizedMessage,
      aiResponse,
      ...(wasTruncated && { 
        warning: `Message was truncated to ${optimizedMessage.length} characters for optimal performance.` 
      })
    });

  } catch (error) {
    console.error('Error processing message:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

// End session and generate feedback
router.post('/sessions/:id/end', async (req, res) => {
  try {
    const { id } = req.params;
    const session = await storage.getPracticeSession(id);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.stage !== 'active') {
      return res.status(400).json({ error: 'Session must be active to end' });
    }

    // Get conversation messages for feedback generation
    const messages = await storage.getConversationMessages(id);

    // Get job description if provided
    let jobDescription: string | undefined;
    if (session.jobDescriptionId) {
      const jd = await storage.getJobDescription(session.jobDescriptionId);
      jobDescription = jd?.extractedText || undefined;
    }

    // Create session context for feedback generation
    const interviewer = {
      name: session.interviewerName || 'Interviewer',
      role: session.interviewerRole || 'Interviewer',
      personality: session.interviewerPersonality || 'Professional and engaging',
      communicationStyle: session.interviewerCommunicationStyle || 'Direct and friendly',
      background: session.interviewerBackground || 'Experienced professional',
      objectives: Array.isArray(session.interviewObjectives) ? session.interviewObjectives : []
    };

    const sessionContext = createSessionContext(
      session.position,
      session.company,
      session.industry || undefined,
      session.interviewStage,
      jobDescription,
      interviewer
    );

    const aiInterviewer = new OpenAIInterviewer(sessionContext);

    // Optimize conversation history for token efficiency in feedback generation
    const optimizedMessages = optimizeConversationHistory(messages);

    // Restore optimized conversation history for feedback generation
    for (const msg of optimizedMessages) {
      if (msg.role === 'user') {
        await aiInterviewer.getResponse(msg.content);
      }
    }

    // Generate feedback
    const feedback = await aiInterviewer.generateFeedback();

    // Calculate duration
    const duration = session.startedAt 
      ? Math.floor((new Date().getTime() - session.startedAt.getTime()) / 1000)
      : 0;

    // Update session with completion data including new criteria feedback
    const updatedSession = await storage.updatePracticeSession(id, {
      stage: 'completed',
      completedAt: new Date(),
      duration,
      overallScore: feedback.overallScore,
      criteriaScores: feedback.criteriaScores,
      criteriaFeedback: feedback.criteriaFeedback,
      feedback: feedback.feedback,
      improvements: feedback.improvements
    });

    res.json({
      session: updatedSession,
      feedback
    });

  } catch (error) {
    console.error('Error ending session:', error);
    res.status(500).json({ error: 'Failed to end session' });
  }
});

// Get conversation history
router.get('/sessions/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;
    const messages = await storage.getConversationMessages(id);
    res.json(messages);
  } catch (error) {
    console.error('Error fetching conversation messages:', error);
    res.status(500).json({ error: 'Failed to fetch conversation messages' });
  }
});

// Download conversation transcript as text file
router.get('/sessions/:id/transcript/download', async (req, res) => {
  try {
    const { id } = req.params;
    const session = await storage.getPracticeSession(id);
    const messages = await storage.getConversationMessages(id);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Generate formatted transcript
    const transcript = generateTranscript(session, messages);
    const filename = `interview-transcript-${session.position.replace(/\s+/g, '-')}-${session.company.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.txt`;
    
    // Set headers for file download
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(transcript);
  } catch (error) {
    console.error('Error downloading transcript:', error);
    res.status(500).json({ error: 'Failed to download transcript' });
  }
});

// Generate conversation transcript (returns JSON with transcript content)
router.post('/sessions/:id/transcript', async (req, res) => {
  try {
    const { id } = req.params;
    const session = await storage.getPracticeSession(id);
    const messages = await storage.getConversationMessages(id);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Generate formatted transcript
    const transcript = generateTranscript(session, messages);
    const filename = `interview-transcript-${session.position.replace(/\s+/g, '-')}-${session.company.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.txt`;
    
    res.json({
      transcript,
      filename,
      session: {
        position: session.position,
        company: session.company,
        date: session.startedAt,
        duration: session.duration
      }
    });
  } catch (error) {
    console.error('Error generating transcript:', error);
    res.status(500).json({ error: 'Failed to generate transcript' });
  }
});

// Helper function to generate formatted transcript
function generateTranscript(session: any, messages: any[]): string {
  const header = `
INTERVIEW TRANSCRIPT
===================

Interview Details:
------------------
Position: ${session.position}
Company: ${session.company}
Industry: ${session.industry || 'Not specified'}
Interview Stage: ${session.interviewStage}
Date: ${new Date(session.startedAt).toLocaleDateString()}
Duration: ${session.duration ? Math.floor(session.duration / 60) : 'N/A'} minutes

Interviewer Profile:
-------------------
Name: ${session.interviewerName}
Role: ${session.interviewerRole}
Background: ${session.interviewerBackground}

Interview Objectives:
--------------------
${session.interviewObjectives?.map((obj: string, index: number) => `${index + 1}. ${obj}`).join('\n') || 'No objectives specified'}

CONVERSATION TRANSCRIPT:
========================

`;

  const conversation = messages
    .sort((a, b) => a.messageOrder - b.messageOrder)
    .map(msg => {
      const timestamp = new Date(msg.timestamp).toLocaleTimeString();
      const speaker = msg.role === 'assistant' ? session.interviewerName : 'Candidate';
      return `[${timestamp}] ${speaker}: ${msg.content}\n`;
    }).join('\n');

  const footer = `
========================
END OF TRANSCRIPT

Performance Summary:
-------------------
Overall Score: ${session.overallScore}/5
Individual Scores:
${Object.entries(session.criteriaScores || {})
  .map(([criteria, score]) => `- ${criteria}: ${score}/5`)
  .join('\n')}

Feedback:
---------
${session.feedback || 'No feedback provided'}

Suggested Improvements:
----------------------
${session.improvements?.map((improvement: string, index: number) => `${index + 1}. ${improvement}`).join('\n') || 'No improvements suggested'}

Generated by P³ Interview Academy
Interview Preparation Platform
`;

  return header + conversation + footer;
}

// Speech-to-Text: Convert audio to text message
router.post('/sessions/:id/speech-to-text', upload.single('audio'), async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    // Validate session exists
    const session = await storage.getPracticeSession(id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.stage !== 'active') {
      return res.status(400).json({ error: 'Session is not active' });
    }

    // Validate audio file
    const validation = audioService.validateAudioFile(req.file.buffer, req.file.originalname);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    // Convert speech to text
    const transcribedText = await audioService.speechToText(req.file.buffer, req.file.originalname);
    
    if (!transcribedText || transcribedText.trim().length === 0) {
      return res.status(400).json({ error: 'No speech detected in audio' });
    }

    res.json({ 
      text: transcribedText,
      sessionId: id 
    });
  } catch (error) {
    console.error('Speech-to-text error:', error);
    res.status(500).json({ error: 'Failed to process audio' });
  }
});

// Text-to-Speech: Convert AI response to audio
router.post('/sessions/:id/text-to-speech', async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text is required' });
    }

    // Validate session exists
    const session = await storage.getPracticeSession(id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Get appropriate voice for interviewer
    const voice = audioService.getInterviewerVoice(session.interviewerName || 'Interviewer', session.interviewerPersonality || undefined);

    // Convert text to speech
    const audioBuffer = await audioService.textToSpeech(text, voice);

    // Set headers for audio response
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': audioBuffer.length.toString(),
      'Cache-Control': 'no-cache'
    });

    res.send(audioBuffer);
  } catch (error) {
    console.error('Text-to-speech error:', error);
    res.status(500).json({ error: 'Failed to generate audio' });
  }
});

// Send voice message (combines STT, AI response, and TTS)
router.post('/sessions/:id/voice-message', upload.single('audio'), async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    // Validate session exists and is active
    const session = await storage.getPracticeSession(id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.stage !== 'active') {
      return res.status(400).json({ error: 'Session is not active' });
    }

    // Validate audio file
    const validation = audioService.validateAudioFile(req.file.buffer, req.file.originalname);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    // Step 1: Convert speech to text
    const userMessage = await audioService.speechToText(req.file.buffer, req.file.originalname);
    
    if (!userMessage || userMessage.trim().length === 0) {
      return res.status(400).json({ error: 'No speech detected in audio' });
    }

    // Step 2: Process the text message normally (same as text message endpoint)
    const validated = validateUserInput(userMessage);
    if (!validated.isValid) {
      return res.status(400).json({ error: validated.message });
    }

    const truncatedMessage = truncateInput(userMessage);

    // Get conversation history for context
    const messages = await storage.getConversationMessages(id);
    const optimizedHistory = optimizeConversationHistory(messages);

    // Save user message
    const userMsgData = {
      sessionId: id,
      role: 'user' as const,
      content: truncatedMessage,
      timestamp: new Date(),
      messageOrder: messages.length + 1
    };

    await storage.addConversationMessage(userMsgData);

    // Generate AI response using the same logic as text message endpoint
    // Get job description if provided
    let jobDescription: string | undefined;
    if (session.jobDescriptionId) {
      const jd = await storage.getJobDescription(session.jobDescriptionId);
      jobDescription = jd?.extractedText || undefined;
    }

    // Create session context
    const interviewer = {
      name: session.interviewerName || 'Interviewer',
      role: session.interviewerRole || 'Interviewer',
      personality: session.interviewerPersonality || 'Professional and engaging',
      communicationStyle: session.interviewerCommunicationStyle || 'Direct and friendly',
      background: session.interviewerBackground || 'Experienced professional',
      objectives: Array.isArray(session.interviewObjectives) ? session.interviewObjectives : []
    };

    const sessionContext = createSessionContext(
      session.position,
      session.company,
      session.industry || undefined,
      session.interviewStage,
      jobDescription,
      interviewer
    );

    // Create AI interviewer and restore conversation history
    const aiInterviewer = new OpenAIInterviewer(sessionContext);
    
    // Restore optimized conversation history
    for (const msg of optimizedHistory) {
      if (msg.role === 'user') {
        await aiInterviewer.getResponse(msg.content);
      }
    }

    // Get AI response
    const aiResponse = await aiInterviewer.getResponse(truncatedMessage);

    // Save AI response
    const aiMsgData = {
      sessionId: id,
      role: 'assistant' as const,
      content: aiResponse,
      messageOrder: messages.length + 2
    };

    await storage.addConversationMessage(aiMsgData);

    // Step 3: Convert AI response to speech
    const voice = audioService.getInterviewerVoice(session.interviewerName || 'Interviewer', session.interviewerPersonality || undefined);
    const audioBuffer = await audioService.textToSpeech(aiResponse, voice);

    res.json({
      userMessage: truncatedMessage,
      aiResponse: aiResponse,
      audioBuffer: audioBuffer.toString('base64'), // Base64 encoded audio
      voice: voice
    });
  } catch (error) {
    console.error('Voice message error:', error);
    res.status(500).json({ error: 'Failed to process voice message' });
  }
});

export default router;