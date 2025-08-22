# Audio API Documentation - P³ Interview Academy

## Overview
The Practice module now supports Text-to-Speech (TTS) and Speech-to-Text (STT) functionality, enabling fully conversational interview experiences with voice input and audio responses.

## Audio Endpoints

### 1. Speech-to-Text (STT)
**Endpoint:** `POST /api/practice/sessions/:id/speech-to-text`

**Purpose:** Convert user's audio recording to text

**Request:**
- Method: POST
- Content-Type: multipart/form-data
- Body: Audio file (field name: "audio")

**Supported Audio Formats:**
- MP3 (.mp3)
- WAV (.wav)
- M4A (.m4a)
- WebM (.webm)
- MP4 (.mp4)

**File Limits:**
- Maximum size: 25MB (OpenAI Whisper limit)
- Language: English (default)

**Response:**
```json
{
  "text": "Hi Emily! I have 5 years of iOS development experience...",
  "sessionId": "session-uuid"
}
```

**Error Responses:**
```json
{
  "error": "No audio file provided"
}
```

### 2. Text-to-Speech (TTS)
**Endpoint:** `POST /api/practice/sessions/:id/text-to-speech`

**Purpose:** Convert AI interviewer's text response to audio

**Request:**
```json
{
  "text": "Thank you for that response. Could you tell me about a time when..."
}
```

**Response:**
- Content-Type: audio/mpeg
- Binary MP3 audio data

**Enhanced Cultural Voice Selection Logic:**
- Asian Female (Emily Tan, Mei Li, etc.) → `nova` voice
- Asian Male (Alex Tan, Wei Chen, etc.) → `echo` voice
- Western Female (Sarah Johnson, Jessica Smith, etc.) → `shimmer` voice
- Western Male (John Smith, Michael Brown, etc.) → `onyx` voice
- Diverse Female (Fatima Hassan, Aisha Kofi, etc.) → `fable` voice
- Diverse Male (Ahmed Ali, Kwame Asante, etc.) → `onyx` voice
- Default/Unknown → `alloy` voice

**Available Voices:**
- `alloy` - Balanced, neutral
- `echo` - Clear, expressive
- `fable` - Warm, engaging
- `onyx` - Deep, authoritative (male)
- `nova` - Professional, clear (female)
- `shimmer` - Bright, energetic

### 3. Complete Voice Message (STT + AI + TTS)
**Endpoint:** `POST /api/practice/sessions/:id/voice-message`

**Purpose:** Complete voice conversation flow - upload audio, get AI response with audio

**Request:**
- Method: POST
- Content-Type: multipart/form-data
- Body: Audio file (field name: "audio")

**Response:**
```json
{
  "userMessage": "Hi Emily! I have 5 years of iOS development experience...",
  "aiResponse": "That's great to hear! With your iOS experience...",
  "audioBuffer": "base64-encoded-mp3-audio-data",
  "voice": "nova"
}
```

**Workflow:**
1. Convert uploaded audio to text (STT)
2. Process text through AI interviewer
3. Generate AI response text
4. Convert AI response to audio (TTS)
5. Return both text and audio

## Audio Service Features

### Enhanced Cultural Voice Selection Algorithm
```typescript
function getInterviewerVoice(interviewerName: string): Voice {
  const fullName = interviewerName.toLowerCase();
  const firstName = fullName.split(' ')[0];
  const lastName = fullName.split(' ').slice(1).join(' ');
  
  // Cultural detection
  const isAsianName = checkAsianNameMarkers(firstName, lastName);
  const isDiverseName = checkDiverseNameMarkers(firstName, lastName);
  const isWesternName = checkWesternNameMarkers(firstName, lastName);
  
  // Gender detection with cultural context
  const isFemale = detectGender(firstName, fullName, 'female');
  const isMale = detectGender(firstName, fullName, 'male');
  
  // Cultural voice mapping
  if (isAsianName) {
    if (isFemale) return 'nova';  // Clear, professional for Asian accents
    if (isMale) return 'echo';    // Authoritative male voice
  }
  
  if (isDiverseName) {
    if (isFemale) return 'fable'; // Expressive, warm female
    if (isMale) return 'onyx';    // Authoritative male
  }
  
  if (isWesternName) {
    if (isFemale) return 'shimmer'; // Warm, engaging female
    if (isMale) return 'onyx';      // Deep, professional male
  }
  
  return 'alloy'; // Default professional voice
}
```

#### Cultural Detection Examples
- **Asian Names**: Dr. Emily Tan → `nova`, Alex Tan → `echo`
- **Western Names**: Sarah Johnson → `shimmer`, John Smith → `onyx`  
- **Diverse Names**: Fatima Hassan → `fable`, Ahmed Ali → `onyx`

### Audio Validation
- File format validation (MIME type checking)
- File size limits (25MB maximum)
- Audio quality optimization
- Error handling for corrupted files

### Error Handling
- Unsupported audio formats
- File size too large
- No speech detected in audio
- OpenAI API errors
- Network connectivity issues

## Integration Examples

### Frontend JavaScript (Web Audio API)
```javascript
// Record audio from microphone
const mediaRecorder = new MediaRecorder(stream);
const audioChunks = [];

mediaRecorder.ondataavailable = (event) => {
  audioChunks.push(event.data);
};

mediaRecorder.onstop = async () => {
  const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
  
  // Send to voice message endpoint
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.wav');
  
  const response = await fetch(`/api/practice/sessions/${sessionId}/voice-message`, {
    method: 'POST',
    body: formData
  });
  
  const result = await response.json();
  
  // Play AI response audio
  const audioData = atob(result.audioBuffer);
  const audioBlob = new Blob([new Uint8Array(audioData.split('').map(c => c.charCodeAt(0)))], {
    type: 'audio/mpeg'
  });
  
  const audio = new Audio(URL.createObjectURL(audioBlob));
  audio.play();
};
```

### Frontend React Component
```jsx
function VoiceChat({ sessionId }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    // ... recording logic
  };
  
  const sendVoiceMessage = async (audioBlob) => {
    const formData = new FormData();
    formData.append('audio', audioBlob);
    
    const response = await fetch(`/api/practice/sessions/${sessionId}/voice-message`, {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    playAIResponse(result.audioBuffer);
  };
  
  return (
    <div>
      <button onClick={startRecording} disabled={isRecording}>
        {isRecording ? 'Recording...' : 'Start Recording'}
      </button>
    </div>
  );
}
```

## Technical Implementation Details

### OpenAI Integration
- **TTS Model:** `tts-1` (optimized for real-time)
- **STT Model:** `whisper-1` (high accuracy)
- **Voice Quality:** Standard (optimized for speed)
- **Language:** English (can be configured)

### Performance Optimizations
- Audio compression for faster uploads
- Streaming audio responses
- Caching of common responses
- Error retry mechanisms

### Security Considerations
- File type validation (prevent malicious uploads)
- File size limits (prevent DoS attacks)
- Audio content filtering (future enhancement)
- Rate limiting (prevent API abuse)

## Database Schema Updates
No database schema changes required - audio processing is stateless and uses existing conversation storage.

## Testing
Audio functionality has been implemented and tested with:
- Multiple voice types and personalities
- Various audio formats and file sizes
- Error handling scenarios
- Complete conversation workflows
- Cross-browser compatibility considerations

## Future Enhancements
- Multiple language support
- Voice cloning for consistent interviewer voices
- Audio quality enhancement
- Background noise reduction
- Voice emotion detection
- Real-time audio streaming