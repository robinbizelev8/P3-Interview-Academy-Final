import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, jsonb, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const sessions = pgTable("sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  stage: text("stage").notNull(), // 'setup', 'stage-selection', 'practice', 'review', 'complete'
  currentQuestionIndex: integer("current_question_index").default(0),
  totalQuestions: integer("total_questions").default(12),
  interviewType: text("interview_type"), // 'phone-screening', 'functional-team', 'hiring-manager', 'technical-specialist', 'executive-final'
  position: text("position"),
  company: text("company"),
  jobDescriptionId: varchar("job_description_id"), // Reference to uploaded JD
  responses: jsonb("responses").default([]), // Array of question responses
  evaluationScores: jsonb("evaluation_scores").default({}), // Star ratings for criteria
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const jobDescriptions = pgTable("job_descriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(), // URL to stored file
  extractedText: text("extracted_text"), // Extracted text content for AI processing
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

export const questions = pgTable("questions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(), // 'phone-screening', 'functional-team', 'hiring-manager', 'technical-specialist', 'executive-final'
  question: text("question").notNull(),
  tags: jsonb("tags").default([]), // Array of skill tags
  difficulty: text("difficulty").notNull(), // 'easy', 'medium', 'hard'
  starGuidance: jsonb("star_guidance").default({}), // STAR framework guidance
});

export const responses = pgTable("responses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").references(() => sessions.id).notNull(),
  questionId: varchar("question_id").references(() => questions.id).notNull(),
  responseText: text("response_text"),
  responseAudio: text("response_audio"), // URL to audio file
  inputMode: text("input_mode").notNull(), // 'text' or 'voice'
  feedback: jsonb("feedback").default({}), // AI-generated feedback
  evaluationScores: jsonb("evaluation_scores").default({}), // Individual question scores
  timeSpent: integer("time_spent"), // seconds
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const wgllContent = pgTable("wgll_content", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  questionId: varchar("question_id").references(() => questions.id).notNull(),
  modelAnswer: text("model_answer").notNull(),
  expertTips: jsonb("expert_tips").default([]), // Array of tips
  performanceMetrics: jsonb("performance_metrics").default({}),
});

// Practice Module Tables
export const practiceScenarios = pgTable("practice_scenarios", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  category: text("category").notNull(), // 'phone-screening', 'functional-team', etc.
  description: text("description").notNull(),
  personaName: text("persona_name").notNull(),
  personaRole: text("persona_role").notNull(),
  personaPersonality: text("persona_personality").notNull(),
  personaCommunicationStyle: text("persona_communication_style").notNull(),
  personaBackground: text("persona_background").notNull(),
  objectives: jsonb("objectives").default([]), // Array of objectives
  duration: integer("duration").default(10), // minutes
  difficulty: text("difficulty").notNull(), // 'easy', 'medium', 'hard'
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const practiceSessions = pgTable("practice_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  stage: text("stage").notNull(), // 'setup', 'briefing', 'active', 'completed'
  
  // User inputs for dynamic simulation
  position: text("position").notNull(),
  company: text("company").notNull(),
  industry: text("industry"),
  interviewStage: text("interview_stage").notNull(), // 'phone-screening', etc.
  jobDescriptionId: varchar("job_description_id").references(() => jobDescriptions.id),
  
  // Generated interviewer persona (created dynamically by AI)
  interviewerName: text("interviewer_name"),
  interviewerRole: text("interviewer_role"),
  interviewerPersonality: text("interviewer_personality"),
  interviewerCommunicationStyle: text("interviewer_communication_style"),
  interviewerBackground: text("interviewer_background"),
  interviewObjectives: jsonb("interview_objectives").default([]), // Array of strings
  
  // Session tracking
  language: text("language").default('English'),
  conversationHistory: jsonb("conversation_history").default([]), // Array of messages
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  duration: integer("duration"), // actual duration in seconds
  overallScore: integer("overall_score"), // 1-35 (7 criteria x 5 points each)
  criteriaScores: jsonb("criteria_scores").default({}), // Individual criteria scores (7 criteria)
  criteriaFeedback: jsonb("criteria_feedback").default({}), // Detailed feedback for each criteria
  feedback: text("feedback"),
  improvements: jsonb("improvements").default([]), // Array of improvement suggestions
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const conversationMessages = pgTable("conversation_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").references(() => practiceSessions.id).notNull(),
  role: text("role").notNull(), // 'user', 'assistant'
  content: text("content").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
  messageOrder: integer("message_order").notNull(),
});

// Insert schemas
export const insertSessionSchema = createInsertSchema(sessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  jobDescriptionId: z.string().nullable().optional(),
});

export const insertQuestionSchema = createInsertSchema(questions).omit({
  id: true,
});

export const insertResponseSchema = createInsertSchema(responses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWgllContentSchema = createInsertSchema(wgllContent).omit({
  id: true,
});

export const insertJobDescriptionSchema = createInsertSchema(jobDescriptions).omit({
  id: true,
  uploadedAt: true,
});

export const insertPracticeScenarioSchema = createInsertSchema(practiceScenarios).omit({
  id: true,
  createdAt: true,
});

export const insertPracticeSessionSchema = createInsertSchema(practiceSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertConversationMessageSchema = createInsertSchema(conversationMessages).omit({
  id: true,
  timestamp: true,
});

// Types
export type Session = typeof sessions.$inferSelect;
export type Question = typeof questions.$inferSelect;
export type Response = typeof responses.$inferSelect;
export type WgllContent = typeof wgllContent.$inferSelect;
export type JobDescription = typeof jobDescriptions.$inferSelect;
export type PracticeScenario = typeof practiceScenarios.$inferSelect;
export type PracticeSession = typeof practiceSessions.$inferSelect;
export type ConversationMessage = typeof conversationMessages.$inferSelect;

export type InsertSession = z.infer<typeof insertSessionSchema>;
export type InsertQuestion = z.infer<typeof insertQuestionSchema>;
export type InsertResponse = z.infer<typeof insertResponseSchema>;
export type InsertWgllContent = z.infer<typeof insertWgllContentSchema>;
export type InsertJobDescription = z.infer<typeof insertJobDescriptionSchema>;
export type InsertPracticeScenario = z.infer<typeof insertPracticeScenarioSchema>;
export type InsertPracticeSession = z.infer<typeof insertPracticeSessionSchema>;
export type InsertConversationMessage = z.infer<typeof insertConversationMessageSchema>;

// Additional types for frontend
export type InterviewStage = 'setup' | 'stage-selection' | 'practice' | 'review' | 'complete';
export type InterviewType = 'phone-screening' | 'functional-team' | 'hiring-manager' | 'technical-specialist' | 'executive-final';
export type InputMode = 'text' | 'voice';
export type Difficulty = 'easy' | 'medium' | 'hard';

export type EvaluationCriteria = {
  technicalDepth: number;
  problemSolving: number;
  communication: number;
  leadershipImpact: number;
  resultsFocused: number;
};

export type STARGuidance = {
  situation: string;
  task: string;
  action: string;
  result: string;
};

export type FeedbackItem = {
  type: 'positive' | 'improvement';
  message: string;
};

export type SessionData = Session & {
  currentQuestion?: Question;
  allQuestions?: Question[];
  currentResponse?: Response;
};

// Practice module types
export type PracticeStage = 'setup' | 'briefing' | 'active' | 'completed';
export type PracticeCategory = 'phone-screening' | 'functional-team' | 'hiring-manager' | 'technical-specialist' | 'executive-final';

export type PracticeSessionData = PracticeSession & {
  scenario?: PracticeScenario;
  messages?: ConversationMessage[];
};

export type ConversationHistoryItem = {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
};

export type PracticeFeedback = {
  overallScore: number;
  criteriaScores: {
    communication: number;
    technicalDepth: number;
    problemSolving: number;
    culturalFit: number;
    experience: number;
  };
  starAnalysis: {
    situation: { present: boolean; score: number; feedback: string };
    task: { present: boolean; score: number; feedback: string };
    action: { present: boolean; score: number; feedback: string };
    result: { present: boolean; score: number; feedback: string };
    overallStarScore: number;
  };
  feedback: string;
  improvements: string[];
};
