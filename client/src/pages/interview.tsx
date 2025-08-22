import { useState, useEffect, useRef } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Send, 
  User, 
  Bot, 
  Star,
  Clock,
  Building,
  Briefcase,
  ChevronLeft
} from "lucide-react";
import { useLocation } from "wouter";

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  messageOrder: number;
}

interface PracticeSession {
  id: string;
  userId: string;
  stage: string;
  position: string;
  company: string;
  industry?: string;
  interviewStage: string;
  interviewerName?: string;
  interviewerRole?: string;
  interviewerPersonality?: string;
  conversationHistory: Message[];
  startedAt?: string;
  completedAt?: string;
  duration?: number;
  overallScore?: number;
  feedback?: string;
}

export default function Interview() {
  const { sessionId } = useParams();
  const [, setLocation] = useLocation();
  const [message, setMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState<string | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch session data
  const { data: session, isLoading: sessionLoading } = useQuery<PracticeSession>({
    queryKey: ['/api/practice/sessions', sessionId],
    enabled: !!sessionId,
  });

  // Fetch conversation messages
  const { data: messages = [], isLoading: messagesLoading } = useQuery<Message[]>({
    queryKey: ['/api/practice/sessions', sessionId, 'messages'],
    enabled: !!sessionId,
  });

  // Send text message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async ({ message }: { message: string }) => {
      const response = await apiRequest('POST', `/api/practice/sessions/${sessionId}/message`, {
        message
      });
      return response.json();
    },
    onSuccess: (data) => {
      // Invalidate messages to refresh the conversation
      queryClient.invalidateQueries({ queryKey: ['/api/practice/sessions', sessionId, 'messages'] });
      setMessage('');
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Send voice message mutation
  const sendVoiceMessageMutation = useMutation({
    mutationFn: async ({ audioBlob }: { audioBlob: Blob | File }) => {
      const formData = new FormData();
      
      // Handle both File and Blob objects
      if (audioBlob instanceof File) {
        formData.append('audio', audioBlob);
      } else {
        // Fallback for Blob - determine format from type
        const fileExtension = audioBlob.type.includes('webm') ? 'webm' :
                             audioBlob.type.includes('mp4') ? 'm4a' :
                             audioBlob.type.includes('wav') ? 'wav' : 'webm';
        formData.append('audio', audioBlob, `recording.${fileExtension}`);
      }
      
      const response = await fetch(`/api/practice/sessions/${sessionId}/voice-message`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to send voice message');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/practice/sessions', sessionId, 'messages'] });
      setAudioChunks([]);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send voice message. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Text-to-speech mutation
  const textToSpeechMutation = useMutation({
    mutationFn: async ({ text }: { text: string }) => {
      const response = await fetch(`/api/practice/sessions/${sessionId}/text-to-speech`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to convert text to speech');
      }
      
      return response.arrayBuffer();
    },
    onSuccess: (audioBuffer, variables) => {
      // Play the audio
      const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      setIsPlaying(variables.text);
      audio.play();
      
      audio.onended = () => {
        setIsPlaying(null);
        URL.revokeObjectURL(audioUrl);
      };
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to play audio. Please try again.",
        variant: "destructive",
      });
      setIsPlaying(null);
    },
  });

  // End interview mutation
  const endInterviewMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/practice/sessions/${sessionId}/end`, {});
      return response.json();
    },
    onSuccess: (data) => {
      // Invalidate session to get updated feedback
      queryClient.invalidateQueries({ queryKey: ['/api/practice/sessions', sessionId] });
      
      // Navigate to feedback page
      setLocation(`/interview/${sessionId}/feedback`);
      
      toast({
        title: "Interview Completed",
        description: "Your performance feedback has been generated!"
      });
    },
    onError: (error) => {
      console.error('End interview error:', error);
      toast({
        title: "Error Ending Interview",
        description: "Failed to end interview and generate feedback",
        variant: "destructive"
      });
    }
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Start recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      });
      
      // Try multiple MIME types for better compatibility
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'audio/mp4';
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'audio/wav';
          }
        }
      }
      
      const recorder = new MediaRecorder(stream, { mimeType });
      
      setMediaRecorder(recorder);
      const chunks: Blob[] = [];
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      
      recorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        
        // Create audio blob with proper format
        let audioBlob: Blob;
        if (mimeType.includes('webm')) {
          audioBlob = new Blob(chunks, { type: 'audio/webm' });
        } else if (mimeType.includes('mp4')) {
          audioBlob = new Blob(chunks, { type: 'audio/mp4' });
        } else {
          audioBlob = new Blob(chunks, { type: 'audio/wav' });
        }
        
        // Determine file extension for proper naming
        const extension = mimeType.includes('webm') ? 'webm' : 
                         mimeType.includes('mp4') ? 'm4a' : 'wav';
        
        // Create a proper File object for better compatibility
        const audioFile = new File([audioBlob], `recording.${extension}`, { 
          type: audioBlob.type 
        });
        
        sendVoiceMessageMutation.mutate({ audioBlob: audioFile });
      };
      
      recorder.start(100); // Collect data every 100ms
      setIsRecording(true);
    } catch (error) {
      console.error('Recording error:', error);
      toast({
        title: "Error",
        description: "Failed to access microphone. Please check permissions.",
        variant: "destructive",
      });
    }
  };

  // Stop recording and send
  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  // Handle text message send
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !sendMessageMutation.isPending) {
      sendMessageMutation.mutate({ message: message.trim() });
    }
  };

  // Handle listen to AI response
  const handleListen = (text: string) => {
    if (isPlaying === text) {
      setIsPlaying(null);
      // Stop current audio
      return;
    }
    textToSpeechMutation.mutate({ text });
  };

  if (sessionLoading || messagesLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto p-4">
          <Skeleton className="h-16 mb-4" />
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="p-8">
          <CardContent className="text-center">
            <h2 className="text-xl font-semibold mb-2">Session Not Found</h2>
            <p className="text-gray-600 mb-4">The interview session you're looking for doesn't exist.</p>
            <Button onClick={() => setLocation('/')}>
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stageLabels = {
    'phone-screening': 'Phone/Initial Screening',
    'functional-team': 'Functional/Team Interview',
    'hiring-manager': 'Hiring Manager Interview', 
    'technical-specialist': 'Technical/Specialist Interview',
    'executive-final': 'Executive/Final Round'
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation('/')}
                className="text-gray-600 hover:text-gray-900"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">
                  Interview Simulation
                </h1>
                <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                  <div className="flex items-center space-x-1">
                    <Building className="w-4 h-4" />
                    <span>{session.company}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Briefcase className="w-4 h-4" />
                    <span>{session.position}</span>
                  </div>
                  <Badge variant="outline">
                    {stageLabels[session.interviewStage as keyof typeof stageLabels]}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Interviewer Info */}
      {session.interviewerName && (
        <div className="bg-blue-50 border-b border-blue-200">
          <div className="max-w-4xl mx-auto px-4 py-3">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="font-medium text-blue-900">
                  {session.interviewerName}
                </div>
                <div className="text-sm text-blue-700">
                  {session.interviewerRole}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Messages Container */}
      <div className="max-w-4xl mx-auto px-4 pb-32">
        <div className="space-y-6 py-6">
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <Bot className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Ready to start your interview?
              </h3>
              <p className="text-gray-600">
                Your interviewer {session.interviewerName} is ready. Type a message or click the microphone to speak.
              </p>
            </div>
          ) : (
            messages.map((msg: Message) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex max-w-3xl ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} space-x-3`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    msg.role === 'user' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-600 text-white'
                  }`}>
                    {msg.role === 'user' ? (
                      <User className="w-4 h-4" />
                    ) : (
                      <Bot className="w-4 h-4" />
                    )}
                  </div>
                  <div className={`flex-1 ${msg.role === 'user' ? 'mr-3' : 'ml-3'}`}>
                    <div className={`p-4 rounded-lg ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white border border-gray-200'
                    }`}>
                      <p className="text-sm">{msg.content}</p>
                      {msg.role === 'assistant' && (
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                          <div className="text-xs text-gray-500">
                            {new Date(msg.timestamp).toLocaleTimeString()}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleListen(msg.content)}
                            disabled={textToSpeechMutation.isPending}
                            className="text-gray-600 hover:text-gray-900"
                          >
                            {isPlaying === msg.content ? (
                              <VolumeX className="w-4 h-4" />
                            ) : (
                              <Volume2 className="w-4 h-4" />
                            )}
                            <span className="ml-1 text-xs">
                              {isPlaying === msg.content ? 'Stop' : 'Listen'}
                            </span>
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area - Fixed at bottom */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <form onSubmit={handleSendMessage} className="flex items-end space-x-3">
            <div className="flex-1">
              <div className="relative">
                <Input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type your response or click the microphone to speak..."
                  disabled={sendMessageMutation.isPending || sendVoiceMessageMutation.isPending}
                  className="pr-12 min-h-[48px] resize-none"
                />
                {/* Recording indicator */}
                {isRecording && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Voice Button */}
            <Button
              type="button"
              variant={isRecording ? "destructive" : "outline"}
              size="icon"
              onClick={isRecording ? stopRecording : startRecording}
              disabled={sendMessageMutation.isPending || sendVoiceMessageMutation.isPending}
              className="min-w-[48px] h-[48px]"
            >
              {isRecording ? (
                <MicOff className="w-5 h-5" />
              ) : (
                <Mic className="w-5 h-5" />
              )}
            </Button>

            {/* Send Button */}
            <Button
              type="submit"
              disabled={!message.trim() || sendMessageMutation.isPending || sendVoiceMessageMutation.isPending}
              className="min-w-[48px] h-[48px]"
            >
              <Send className="w-5 h-5" />
            </Button>
          </form>
          
          {/* End Interview Button */}
          {messages.length > 2 && (
            <div className="flex justify-center mt-4">
              <Button
                variant="outline"
                onClick={() => endInterviewMutation.mutate()}
                disabled={endInterviewMutation.isPending}
                className="px-6 py-2 text-sm"
              >
                {endInterviewMutation.isPending ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full mr-2"></div>
                    Ending Interview...
                  </>
                ) : (
                  'End Interview & Get Feedback'
                )}
              </Button>
            </div>
          )}
          
          {/* Loading indicator */}
          {(sendMessageMutation.isPending || sendVoiceMessageMutation.isPending) && (
            <div className="flex items-center justify-center mt-2 text-sm text-gray-600">
              <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full mr-2"></div>
              {sendVoiceMessageMutation.isPending ? 'Processing voice message...' : 'Sending...'}
            </div>
          )}
        </div>
      </div>

      {/* Hidden file input for audio recording fallback */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            sendVoiceMessageMutation.mutate({ audioBlob: file });
          }
        }}
      />
    </div>
  );
}