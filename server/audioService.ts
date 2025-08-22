import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export class AudioService {
  private uploadsDir: string;

  constructor() {
    this.uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  /**
   * Convert speech to text using OpenAI Whisper
   */
  async speechToText(audioBuffer: Buffer, filename: string): Promise<string> {
    let tempFilePath: string | null = null;
    
    try {
      // Validate file extension and normalize
      const originalExt = path.extname(filename).toLowerCase();
      let normalizedExt = originalExt;
      
      // Map common browser formats to supported formats
      if (originalExt === '.webm') {
        normalizedExt = '.webm';
      } else if (originalExt === '.m4a' || originalExt === '.mp4') {
        normalizedExt = '.m4a';
      } else if (originalExt === '.wav') {
        normalizedExt = '.wav';
      } else if (originalExt === '.mp3') {
        normalizedExt = '.mp3';
      } else if (!originalExt) {
        // Default to webm if no extension
        normalizedExt = '.webm';
      }
      
      // Create temporary file with proper extension
      const tempFilename = `${randomUUID()}-${Date.now()}${normalizedExt}`;
      tempFilePath = path.join(this.uploadsDir, tempFilename);
      
      // Write buffer to file
      fs.writeFileSync(tempFilePath, audioBuffer);
      
      // Verify file was written correctly
      const stats = fs.statSync(tempFilePath);
      if (stats.size === 0) {
        throw new Error('Audio file is empty');
      }
      
      console.log(`Processing audio file: ${tempFilename}, size: ${stats.size} bytes, type: ${normalizedExt}`);

      // Create readable stream for OpenAI
      const audioStream = fs.createReadStream(tempFilePath);

      // Call OpenAI Whisper API with proper error handling
      const transcription = await openai.audio.transcriptions.create({
        file: audioStream,
        model: 'whisper-1',
        language: 'en',
        response_format: 'text',
        temperature: 0.2 // Lower temperature for more consistent results
      });

      // Clean up temporary file
      fs.unlinkSync(tempFilePath);
      tempFilePath = null;

      const result = transcription.trim();
      
      if (!result || result.length === 0) {
        throw new Error('No speech detected in the audio file');
      }
      
      console.log(`Transcription successful: "${result.substring(0, 100)}${result.length > 100 ? '...' : ''}"`);
      return result;
      
    } catch (error) {
      // Clean up temporary file if it exists
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
        } catch (cleanupError) {
          console.error('Failed to clean up temp file:', cleanupError);
        }
      }
      
      console.error('Speech-to-text error:', error);
      
      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes('Invalid file format')) {
          throw new Error('Audio format not supported. Please try recording again.');
        } else if (error.message.includes('file_size_exceeded')) {
          throw new Error('Audio file too large. Please record a shorter message.');
        } else if (error.message.includes('No speech detected')) {
          throw new Error('No speech detected in the audio file. Please try speaking more clearly.');
        } else {
          throw new Error(`Transcription failed: ${error.message}`);
        }
      }
      
      throw new Error('Failed to transcribe audio. Please try again.');
    }
  }

  /**
   * Convert text to speech using OpenAI TTS
   */
  async textToSpeech(text: string, voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' = 'nova'): Promise<Buffer> {
    try {
      const mp3 = await openai.audio.speech.create({
        model: 'tts-1',
        voice: voice,
        input: text,
        speed: 1.0
      });

      const buffer = Buffer.from(await mp3.arrayBuffer());
      return buffer;
    } catch (error) {
      console.error('Text-to-speech error:', error);
      throw new Error('Failed to generate speech');
    }
  }

  /**
   * Get appropriate voice for interviewer based on cultural background, gender, and personality
   */
  getInterviewerVoice(interviewerName: string, personality?: string, background?: string): 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' {
    const fullName = interviewerName.toLowerCase();
    const firstName = fullName.split(' ')[0];
    const lastName = fullName.split(' ').slice(1).join(' ');
    
    // Enhanced cultural and demographic voice mapping
    const voiceMapping = {
      // Asian Female Names (Chinese, Japanese, Korean, Southeast Asian)
      asianFemale: {
        names: [
          'emily', 'mei', 'lin', 'wei', 'yan', 'li', 'chen', 'wang', 'zhang', 'liu', 'tan', 'lim', 'ng', 'ong',
          'akiko', 'yuki', 'sakura', 'hiroko', 'keiko', 'miyuki',
          'soo', 'min', 'ji', 'hye', 'jung', 'kim', 'park', 'lee',
          'priya', 'anita', 'meera', 'kavitha', 'siti', 'lian', 'hui'
        ],
        surnames: ['tan', 'lim', 'ng', 'ong', 'chen', 'wang', 'zhang', 'liu', 'lee', 'kim', 'park', 'wong', 'ho', 'chan'],
        voice: 'nova' // Clear, professional female voice suitable for Asian accents
      },
      
      // Asian Male Names
      asianMale: {
        names: [
          'david', 'michael', 'james', 'daniel', 'alex', 'kevin', 'brian', 'steven', 'jason', 'ryan',
          'wei', 'ming', 'jun', 'hao', 'bin', 'kai', 'cheng', 'xiong', 'feng',
          'hiroshi', 'takeshi', 'kenji', 'yuki', 'satoshi',
          'jin', 'sung', 'hyun', 'woo', 'dong',
          'raj', 'kumar', 'aman', 'vikram'
        ],
        surnames: ['tan', 'lim', 'ng', 'ong', 'chen', 'wang', 'zhang', 'liu', 'lee', 'kim', 'park', 'wong', 'ho', 'chan'],
        voice: 'echo' // Clear, authoritative male voice
      },
      
      // Western Female Names
      westernFemale: {
        names: [
          'sarah', 'jessica', 'jennifer', 'michelle', 'amanda', 'stephanie', 'melissa', 'nicole', 'elizabeth', 'rachel',
          'maria', 'anna', 'lisa', 'laura', 'karen', 'nancy', 'helen', 'patricia', 'barbara', 'susan'
        ],
        surnames: ['smith', 'johnson', 'williams', 'brown', 'jones', 'garcia', 'miller', 'davis', 'rodriguez', 'martinez'],
        voice: 'shimmer' // Warm, engaging female voice
      },
      
      // Western Male Names
      westernMale: {
        names: [
          'john', 'robert', 'william', 'richard', 'christopher', 'thomas', 'charles', 'matthew', 'anthony', 'mark',
          'donald', 'steven', 'paul', 'andrew', 'joshua', 'kenneth', 'kevin', 'brian', 'george', 'edward'
        ],
        surnames: ['smith', 'johnson', 'williams', 'brown', 'jones', 'garcia', 'miller', 'davis', 'rodriguez', 'martinez'],
        voice: 'onyx' // Deep, professional male voice
      },
      
      // African/Middle Eastern Female Names
      diverseFemale: {
        names: [
          'fatima', 'aisha', 'zara', 'layla', 'amina', 'khadija', 'yasmin', 'nadia', 'sara', 'dina',
          'asha', 'kemi', 'ada', 'chioma', 'ngozi', 'funmi', 'tola', 'bisi'
        ],
        surnames: ['hassan', 'ali', 'ahmed', 'ibrahim', 'mohammed', 'omar', 'okafor', 'adebayo', 'williams', 'johnson'],
        voice: 'fable' // Warm, expressive female voice
      },
      
      // African/Middle Eastern Male Names
      diverseMale: {
        names: [
          'ahmed', 'hassan', 'ali', 'omar', 'ibrahim', 'mohammed', 'khalid', 'tariq', 'samir', 'yusuf',
          'kofi', 'kwame', 'ade', 'tunde', 'emeka', 'chidi', 'kelechi', 'obinna'
        ],
        surnames: ['hassan', 'ali', 'ahmed', 'ibrahim', 'mohammed', 'omar', 'okafor', 'adebayo', 'williams', 'johnson'],
        voice: 'onyx' // Authoritative male voice
      }
    };
    
    // Check for cultural markers in name
    const isAsianName = this.checkAsianNameMarkers(firstName, lastName);
    const isDiverseName = this.checkDiverseNameMarkers(firstName, lastName);
    const isWesternName = this.checkWesternNameMarkers(firstName, lastName);
    
    // Gender detection with cultural context
    const isFemale = this.detectGender(firstName, fullName, 'female');
    const isMale = this.detectGender(firstName, fullName, 'male');
    
    // Assign voice based on cultural background and gender
    if (isAsianName) {
      if (isFemale) return voiceMapping.asianFemale.voice as 'nova';
      if (isMale) return voiceMapping.asianMale.voice as 'echo';
    }
    
    if (isDiverseName) {
      if (isFemale) return voiceMapping.diverseFemale.voice as 'fable';
      if (isMale) return voiceMapping.diverseMale.voice as 'onyx';
    }
    
    if (isWesternName || (!isAsianName && !isDiverseName)) {
      if (isFemale) return voiceMapping.westernFemale.voice as 'shimmer';
      if (isMale) return voiceMapping.westernMale.voice as 'onyx';
    }
    
    // Default to neutral professional voice
    return 'alloy';
  }
  
  /**
   * Check for Asian name markers (Chinese, Japanese, Korean, Southeast Asian)
   */
  private checkAsianNameMarkers(firstName: string, lastName: string): boolean {
    const asianSurnames = ['tan', 'lim', 'ng', 'ong', 'chen', 'wang', 'zhang', 'liu', 'lee', 'kim', 'park', 'wong', 'ho', 'chan', 'li', 'wu', 'huang', 'lin', 'yang', 'xu', 'ma', 'sun'];
    const asianFirstNames = ['wei', 'ming', 'jun', 'hao', 'bin', 'kai', 'cheng', 'mei', 'lin', 'yan', 'li', 'hui', 'akiko', 'yuki', 'hiroshi', 'takeshi', 'jin', 'sung', 'min', 'ji'];
    
    return asianSurnames.some(surname => lastName.includes(surname)) || 
           asianFirstNames.some(name => firstName.includes(name)) ||
           lastName.length <= 3; // Short surnames often Asian
  }
  
  /**
   * Check for diverse name markers (African, Middle Eastern, etc.)
   */
  private checkDiverseNameMarkers(firstName: string, lastName: string): boolean {
    const diverseNames = ['ahmed', 'hassan', 'ali', 'omar', 'fatima', 'aisha', 'zara', 'amina', 'kofi', 'kwame', 'ade', 'asha', 'kemi'];
    const diverseSurnames = ['hassan', 'ali', 'ahmed', 'ibrahim', 'mohammed', 'omar', 'okafor', 'adebayo'];
    
    return diverseNames.some(name => firstName.includes(name)) ||
           diverseSurnames.some(surname => lastName.includes(surname));
  }
  
  /**
   * Check for Western name markers
   */
  private checkWesternNameMarkers(firstName: string, lastName: string): boolean {
    const westernNames = ['john', 'robert', 'william', 'sarah', 'jessica', 'jennifer', 'michael', 'david', 'christopher', 'maria'];
    const westernSurnames = ['smith', 'johnson', 'williams', 'brown', 'jones', 'garcia', 'miller', 'davis'];
    
    return westernNames.some(name => firstName.includes(name)) ||
           westernSurnames.some(surname => lastName.includes(surname)) ||
           lastName.length > 5; // Longer surnames often Western
  }
  
  /**
   * Enhanced gender detection
   */
  private detectGender(firstName: string, fullName: string, targetGender: 'male' | 'female'): boolean {
    const femaleNames = [
      'emily', 'sarah', 'jessica', 'jennifer', 'michelle', 'amanda', 'stephanie', 'melissa', 'nicole', 'elizabeth',
      'maria', 'anna', 'lisa', 'laura', 'karen', 'nancy', 'helen', 'patricia', 'barbara', 'susan',
      'mei', 'lin', 'wei', 'yan', 'li', 'hui', 'akiko', 'yuki', 'sakura', 'soo', 'min', 'ji', 'hye',
      'fatima', 'aisha', 'zara', 'layla', 'amina', 'yasmin', 'nadia', 'asha', 'kemi', 'ada', 'priya'
    ];
    
    const maleNames = [
      'john', 'robert', 'william', 'richard', 'christopher', 'thomas', 'charles', 'matthew', 'anthony', 'mark',
      'michael', 'david', 'james', 'daniel', 'alex', 'kevin', 'brian', 'steven', 'jason', 'ryan',
      'wei', 'ming', 'jun', 'hao', 'bin', 'kai', 'cheng', 'hiroshi', 'takeshi', 'jin', 'sung',
      'ahmed', 'hassan', 'ali', 'omar', 'ibrahim', 'mohammed', 'khalid', 'kofi', 'kwame', 'ade'
    ];
    
    // Check for title indicators
    const doctorTitles = ['dr.', 'dr', 'doctor'];
    const hasDocTitle = doctorTitles.some(title => fullName.includes(title));
    
    if (targetGender === 'female') {
      return femaleNames.some(name => firstName.includes(name)) ||
             fullName.includes('ms.') || fullName.includes('mrs.') || fullName.includes('miss');
    } else {
      return maleNames.some(name => firstName.includes(name)) ||
             fullName.includes('mr.') || fullName.includes('sir');
    }
  }

  /**
   * Validate audio file format and size
   */
  validateAudioFile(buffer: Buffer, filename: string): { valid: boolean; error?: string } {
    const maxSize = 25 * 1024 * 1024; // 25MB limit (OpenAI's limit)
    const allowedExtensions = ['.mp3', '.mp4', '.mpeg', '.mpga', '.m4a', '.wav', '.webm'];
    
    if (buffer.length > maxSize) {
      return { valid: false, error: 'Audio file too large. Maximum size is 25MB.' };
    }

    const extension = path.extname(filename).toLowerCase();
    if (!allowedExtensions.includes(extension)) {
      return { valid: false, error: `Unsupported audio format. Supported formats: ${allowedExtensions.join(', ')}` };
    }

    return { valid: true };
  }
}

export const audioService = new AudioService();