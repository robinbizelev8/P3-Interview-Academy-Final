# Interview Preparation Platform (P³ Interview Academy)

## Overview
P³ Interview Academy is a full-stack interview preparation platform designed to help users excel in job interviews. It offers structured practice sessions with voice/text input, real-time feedback, and performance analytics across five critical interview stages: Phone/Initial Screening, Functional/Team, Hiring Manager, Technical/Specialist, and Executive/Final Round. The platform aims to provide a comprehensive and personalized interview preparation experience.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript and Vite.
- **UI/UX**: Shadcn/ui components (based on Radix UI) styled with Tailwind CSS, utilizing custom design tokens.
- **State Management**: React Context for session state, TanStack Query for server state.
- **Routing**: Wouter for client-side routing.
- **Form Handling**: React Hook Form with Zod validation.

### Backend
- **Runtime**: Node.js with Express.js.
- **Language**: TypeScript with ES modules.
- **API Design**: RESTful APIs with structured error handling.
- **Development**: Vite integration for SSR and HMR during development.

### Database
- **ORM**: Drizzle ORM with PostgreSQL dialect.
- **Database**: PostgreSQL (configured for Neon serverless).
- **Migrations**: Drizzle Kit for schema management.
- **Schema**: Strongly typed with Zod integration for validation.

### Core Features

#### Prepare Module (Existing)
- **Session Management**: Multi-stage interview sessions (setup → practice → review → complete) with progress tracking and auto-save. Supports 5 distinct interview stages with specific questions and difficulty levels.
- **Question System**: Pre-seeded question bank organized by the 5 interview stages, providing 15 questions per stage for a total of 75 high-quality questions. Questions are personalized based on job descriptions using AI.
- **Response Handling**: Supports dual input modes (text and voice recording) with auto-save. Tracks performance metrics and provides AI-generated feedback and evaluation scores.
- **Audio Recording**: Utilizes Web Audio API for voice responses, including compression and storage.
- **Data Flow**: Manages the flow from session creation and question retrieval to practice, auto-saving, AI evaluation, and final review with performance analytics.
- **WGLL Content**: Provides "What Good Looks Like" (WGLL) content with expert model answers and unique success factors for all 75 questions across all 5 interview stages.
- **Job Description Upload**: Allows users to upload job descriptions (PDF, TXT, DOC, DOCX) for AI-tailored feedback and question customization, with file management capabilities.

#### Practice Module (Updated - Jan 2025)
- **Dynamic AI Interview Simulations**: AI-powered interactive interviews using OpenAI GPT-4o that generate personalized interviewer personas based on user inputs.
- **User-Driven Personalization**: Creates custom simulations based on 5 key inputs: position being interviewed for, company name, interview stage, uploaded job description, and company industry.
- **Dynamic Persona Generation**: AI generates unique interviewer personas with specific names, roles, personalities, communication styles, backgrounds, and objectives tailored to the user's specific interview context.
- **Flexible Interview Stages**: Supports all 5 interview stages (phone-screening, functional-team, hiring-manager, technical-specialist, executive-final) with stage-appropriate persona generation.
- **Job Description Integration**: Optional job description upload that enhances persona generation and question customization for maximum relevance.
- **Session Flow**: User Input Collection → Dynamic Persona Generation → Setup → Active Conversation → AI-Generated Feedback & Scoring.
- **Real-time Conversational AI**: Natural back-and-forth conversations with AI interviewers that maintain context and provide realistic interview experiences.
- **Voice Integration (NEW)**: Complete Text-to-Speech (TTS) and Speech-to-Text (STT) functionality using OpenAI's Whisper and TTS models with culturally-aware intelligent voice selection.
- **Cultural Voice Mapping**: Advanced voice assignment system that respects cultural backgrounds and demographics (Asian, Western, Diverse) with gender-appropriate voice selection for authentic interview experiences.
- **Audio Features**: Voice recording input, AI audio responses, 6 professional voice options with cultural mapping, multi-format audio support (MP3, WAV, M4A, WebM), and complete voice conversation workflows.
- **Enhanced Assessment System**: New 7-criteria scoring system requested by stakeholders (Relevance, Structured STAR, Specific, Honest, Confident but not arrogant, Aligned with role, Outcome Oriented) with detailed feedback and suggestions for each criterion (total max 35 points).
- **STAR Framework Integration**: Comprehensive analysis of candidate responses using the STAR methodology (Situation, Task, Action, Result) adapted from the Prepare module, providing structured feedback on storytelling effectiveness.
- **Conversation History**: Full transcript storage with replay capabilities and downloadable records.
- **OpenAI Integration**: Utilizes GPT-4o for dynamic persona creation, natural conversation flow, intelligent feedback generation, Whisper for STT, and TTS-1 for voice synthesis.
- **Conversation Flow Management**: Sophisticated system prompt engineering prevents duplicate introductions and ensures natural interview progression with context awareness.

## External Dependencies

### Core
- **@neondatabase/serverless**: PostgreSQL connection for serverless environments.
- **drizzle-orm**: Type-safe database ORM.
- **@tanstack/react-query**: Server state management and caching.
- **wouter**: Lightweight React router.
- **class-variance-authority**: Component variant management.

### UI
- **@radix-ui/***: Accessible UI primitives.
- **tailwindcss**: Utility-first CSS framework.
- **lucide-react**: Icon library.
- **embla-carousel-react**: Touch-friendly carousel component.

### AI/Cloud Services
- **AWS Bedrock**: Used for enhanced AI capabilities and feedback generation (Claude 3 Sonnet model) in the Prepare module.
- **OpenAI**: Used for real-time conversational interviews in the Practice module (GPT-4o model).

### Development Tools
- **vite**: Fast build tool and development server.
- **typescript**: Static type checking.
- **@replit/vite-plugin-***: Replit-specific development enhancements.