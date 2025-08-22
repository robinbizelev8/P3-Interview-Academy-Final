import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { Phone, Users, TrendingUp, Code, Building, Play, CheckCircle, Star, ArrowRight } from "lucide-react";
import type { InterviewType, JobDescription } from "@shared/schema";
import JobDescriptionUpload from "@/components/JobDescriptionUpload";
import heroImage from "@assets/generated_images/Professional_interview_scene_5a39200f.png";
import aiConceptImage from "@assets/generated_images/AI_interview_technology_concept_f5b99eb1.png";
import stagesImage from "@assets/generated_images/Interview_stages_infographic_3f48a0af.png";

const interviewTypes = [
  { value: 'phone-screening' as InterviewType, label: 'Stage 1: Phone/Initial Screening (HR)', icon: Phone, description: 'Basic qualifications, culture fit, salary expectations' },
  { value: 'functional-team' as InterviewType, label: 'Stage 2: Functional/Team Interview', icon: Users, description: 'Team dynamics, collaboration, role-specific skills' },
  { value: 'hiring-manager' as InterviewType, label: 'Stage 3: Hiring Manager Interview', icon: TrendingUp, description: 'Leadership assessment, strategic thinking, team fit' },
  { value: 'technical-specialist' as InterviewType, label: 'Stage 4: Industry Specialist Interview', icon: Code, description: 'Industry-specific expertise, domain knowledge, specialized skills' },
  { value: 'executive-final' as InterviewType, label: 'Stage 5: Executive/Final Round', icon: Building, description: 'Vision alignment, cultural impact, final decision' },
];

// Helper function to suggest appropriate interview stage based on job role
function getSuggestedInterviewStage(position: string): InterviewType {
  const positionLower = position.toLowerCase();
  
  // IMPORTANT: Business Development roles should NEVER get technical questions
  // These are business-focused roles, even in tech/pharma companies
  const businessDevelopmentKeywords = ['business development', 'bd', 'biz dev', 'business dev', 'commercial', 'sales', 'partnerships', 'alliances'];
  if (businessDevelopmentKeywords.some(keyword => positionLower.includes(keyword))) {
    return 'hiring-manager'; // Always use hiring manager for business roles
  }
  
  // Industry specialist roles should use technical-specialist for domain expertise
  const industrySpecialistKeywords = ['regulatory affairs', 'clinical research', 'medical affairs', 'market access', 'pharmacovigilance', 'drug development', 'clinical operations', 'financial analyst', 'risk management', 'compliance', 'auditor', 'quality assurance', 'research scientist', 'product specialist'];
  if (industrySpecialistKeywords.some(keyword => positionLower.includes(keyword))) {
    return 'technical-specialist'; // These roles need industry-specific expertise
  }
  
  // Pure technical roles (software/IT) should use technical-specialist
  const pureTechnicalKeywords = ['software engineer', 'software developer', 'full stack', 'backend', 'frontend', 'devops engineer', 'system administrator', 'network engineer', 'cybersecurity', 'it specialist'];
  if (pureTechnicalKeywords.some(keyword => positionLower.includes(keyword))) {
    return 'technical-specialist';
  }
  
  // Data roles can be technical
  const dataKeywords = ['data scientist', 'data engineer', 'machine learning', 'ai engineer', 'data analyst'];
  if (dataKeywords.some(keyword => positionLower.includes(keyword))) {
    return 'technical-specialist';
  }
  
  // Executive/C-level roles should use executive-final for actual C-suite
  const executiveKeywords = ['ceo', 'cto', 'cfo', 'cmo', 'coo', 'chief', 'president'];
  if (executiveKeywords.some(keyword => positionLower.includes(keyword))) {
    return 'executive-final';
  }
  
  // Director-level and VP roles use hiring-manager (leadership focused, not technical)
  const leadershipKeywords = ['director', 'vp', 'vice president', 'head of', 'team lead', 'manager'];
  if (leadershipKeywords.some(keyword => positionLower.includes(keyword))) {
    return 'hiring-manager';
  }
  
  // HR/People roles should use functional-team
  const hrKeywords = ['hr', 'human resources', 'people', 'talent', 'recruiting', 'recruiter'];
  if (hrKeywords.some(keyword => positionLower.includes(keyword))) {
    return 'functional-team';
  }
  
  // Business/commercial roles should use hiring-manager
  const businessKeywords = ['marketing', 'product manager', 'strategy', 'consultant', 'analyst', 'coordinator', 'specialist'];
  if (businessKeywords.some(keyword => positionLower.includes(keyword))) {
    return 'hiring-manager';
  }
  
  // Default to hiring-manager for most professional roles (safer than technical)
  return 'hiring-manager';
}

// Industry options for better interview personalization
const industryOptions = [
  'Technology/Software',
  'Healthcare/Pharmaceuticals',
  'Financial Services/Banking',
  'Consulting',
  'Manufacturing',
  'Energy/Oil & Gas',
  'Retail/E-commerce',
  'Education',
  'Government/Public Sector',
  'Non-profit',
  'Media/Entertainment',
  'Real Estate',
  'Transportation/Logistics',
  'Automotive',
  'Aerospace/Defense',
  'Telecommunications',
  'Biotechnology',
  'Food & Beverage',
  'Other'
];

export default function Home() {
  const [, setLocation] = useLocation();
  const [selectedType, setSelectedType] = useState<InterviewType | ''>('');
  const [position, setPosition] = useState('');
  const [company, setCompany] = useState('');
  const [industry, setIndustry] = useState('');
  const [selectedJobDescription, setSelectedJobDescription] = useState<JobDescription | null>(null);

  // Auto-suggest interview stage when position changes
  const handlePositionChange = (value: string) => {
    setPosition(value);
    if (value && !selectedType) {
      const suggested = getSuggestedInterviewStage(value);
      setSelectedType(suggested);
    }
  };

  const createSessionMutation = useMutation({
    mutationFn: async (sessionData: any) => {
      const response = await apiRequest('POST', '/api/practice/sessions', sessionData);
      return response.json();
    },
    onSuccess: (session) => {
      toast({
        title: "Session Created",
        description: "Your interview preparation session has been started.",
      });
      setLocation(`/interview/${session.id}`);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create session. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleStartSession = () => {
    if (!selectedType || !position || !company) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields to continue.",
        variant: "destructive",
      });
      return;
    }

    createSessionMutation.mutate({
      userId: 'user-1', // In production, this would come from authentication
      position,
      company,
      industry: industry || 'Technology/Software', // Default industry if not selected
      interviewStage: selectedType,
      jobDescriptionId: selectedJobDescription?.id || undefined,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-xl">P³</span>
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Interview Academy
              </h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <section className="py-16 lg:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="space-y-4">
                <h2 className="text-4xl lg:text-6xl font-bold text-gray-900 leading-tight">
                  Master Your
                  <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent block">
                    Interview Skills
                  </span>
                </h2>
                <p className="text-xl text-gray-600 leading-relaxed">
                  Practice with AI-powered interviewers across 5 interview stages. Get personalized feedback, 
                  industry-specific questions, and expert insights to ace your next opportunity.
                </p>
              </div>
              
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center space-x-2 bg-white rounded-full px-4 py-2 shadow-sm border">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="text-sm font-medium">AI-Powered Interviews</span>
                </div>
                <div className="flex items-center space-x-2 bg-white rounded-full px-4 py-2 shadow-sm border">
                  <Star className="w-5 h-5 text-yellow-500" />
                  <span className="text-sm font-medium">Expert Feedback</span>
                </div>
                <div className="flex items-center space-x-2 bg-white rounded-full px-4 py-2 shadow-sm border">
                  <Code className="w-5 h-5 text-blue-500" />
                  <span className="text-sm font-medium">19+ Industries</span>
                </div>
              </div>
            </div>
            
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-600 rounded-2xl blur-3xl opacity-20"></div>
              <img 
src={heroImage} 
                alt="Professional interview scene"
                className="relative w-full h-auto rounded-2xl shadow-2xl border border-white/20"
              />
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="py-16 bg-white rounded-3xl shadow-lg mb-16">
          <div className="px-8 lg:px-16">
            <div className="text-center mb-12">
              <h3 className="text-3xl font-bold text-gray-900 mb-4">How It Works</h3>
              <p className="text-lg text-gray-600">Master interviews in 3 simple steps</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg">
                  <span className="text-white font-bold text-2xl">1</span>
                </div>
                <h4 className="text-xl font-semibold text-gray-900">Setup Your Session</h4>
                <p className="text-gray-600">Enter your position, company, and select from 19 industries to create a personalized interview experience.</p>
              </div>
              
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg">
                  <Play className="w-8 h-8 text-white" />
                </div>
                <h4 className="text-xl font-semibold text-gray-900">Practice with AI</h4>
                <p className="text-gray-600">Engage in realistic conversations with AI interviewers tailored to your specific role and industry.</p>
              </div>
              
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg">
                  <Star className="w-8 h-8 text-white" />
                </div>
                <h4 className="text-xl font-semibold text-gray-900">Get Expert Feedback</h4>
                <p className="text-gray-600">Receive detailed performance scores and improvement suggestions to enhance your interview skills.</p>
              </div>
            </div>
          </div>
        </section>



        {/* Start Practice Section */}
        <section className="py-16">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold text-gray-900 mb-4">Start Your Practice Session</h3>
            <p className="text-lg text-gray-600">Set up your personalized AI interview simulation</p>
          </div>
          
        <Card className="shadow-xl border-0 bg-gradient-to-br from-white to-gray-50">
          <CardHeader>
            <CardTitle>Setup Your Practice Session</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Position and Company */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="position">Position</Label>
                <Input
                  id="position"
                  placeholder="e.g., Business Development Director"
                  value={position}
                  onChange={(e) => handlePositionChange(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">Company</Label>
                <Input
                  id="company"
                  placeholder="e.g., Microsoft"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                />
              </div>
            </div>

            {/* Industry Selection */}
            <div className="space-y-2">
              <Label htmlFor="industry">Industry (Optional)</Label>
              <Select value={industry} onValueChange={(value) => setIndustry(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select industry for specialized questions" />
                </SelectTrigger>
                <SelectContent>
                  {industryOptions.map((industryOption) => (
                    <SelectItem key={industryOption} value={industryOption}>
                      {industryOption}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedType === 'technical-specialist' && (
                <p className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                  💡 Industry selection helps generate more relevant specialist questions for your field
                </p>
              )}
            </div>

            {/* Interview Stage Selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Interview Stage</Label>
                {position && selectedType && (
                  <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                    Recommended for {position}
                  </span>
                )}
              </div>
              <Select value={selectedType} onValueChange={(value) => setSelectedType(value as InterviewType)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select interview stage" />
                </SelectTrigger>
                <SelectContent>
                  {interviewTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Interview Type Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {interviewTypes.map((type) => {
                const Icon = type.icon;
                const isSelected = selectedType === type.value;
                
                return (
                  <Card
                    key={type.value}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      isSelected ? 'ring-2 ring-primary-blue bg-blue-50' : ''
                    }`}
                    onClick={() => setSelectedType(type.value)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start space-x-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          isSelected ? 'bg-primary-blue' : 'bg-gray-100'
                        }`}>
                          <Icon className={`w-5 h-5 ${isSelected ? 'text-white' : 'text-gray-600'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-gray-900 mb-1">
                            {type.label}
                          </h3>
                          <p className="text-xs text-gray-600">
                            {type.description}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Job Description Upload - Positioned before Start Button */}
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-blue-900 mb-2">
                  📄 Supercharge Your Practice with Your Job Description
                </h3>
                <p className="text-sm text-blue-800 mb-3">
                  Upload your job description to get <strong>personalized AI feedback</strong> tailored specifically to your target role. 
                  Our AI will analyze the required skills and responsibilities to provide more relevant interview questions and targeted improvement suggestions.
                </p>
                <div className="text-xs text-blue-700">
                  <span className="font-medium">Benefits:</span> Role-specific questions • Tailored feedback • Skills-focused coaching • Higher success rate
                </div>
              </div>
              
              <JobDescriptionUpload
                userId="user-1"
                selectedJobDescriptionId={selectedJobDescription?.id}
                onJobDescriptionSelect={setSelectedJobDescription}
              />
            </div>

            <Button
              className="w-full py-3 text-lg"
              onClick={handleStartSession}
              disabled={createSessionMutation.isPending || !selectedType || !position || !company}
            >
              {createSessionMutation.isPending ? "Starting Session..." : "Start Practice Session"}
            </Button>
          </CardContent>
        </Card>
        </section>

        {/* Features Preview */}
        <section className="py-16">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold text-gray-900 mb-4">Why Choose P³ Interview Academy?</h3>
            <p className="text-lg text-gray-600">Advanced AI technology meets proven interview methodology</p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-12">
            <div>
              <img 
src={aiConceptImage} 
                alt="AI interview technology"
                className="w-full h-auto rounded-2xl shadow-lg"
              />
            </div>
            <div className="space-y-6">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h4 className="text-xl font-semibold text-gray-900 mb-2">Personalized AI Interviewers</h4>
                  <p className="text-gray-600">Each session creates a unique interviewer persona based on your industry, role, and company context.</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Star className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h4 className="text-xl font-semibold text-gray-900 mb-2">Industry-Specific Expertise</h4>
                  <p className="text-gray-600">From healthcare regulations to financial compliance, our AI understands your industry's unique requirements.</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h4 className="text-xl font-semibold text-gray-900 mb-2">Performance Analytics</h4>
                  <p className="text-gray-600">Get detailed scoring across 5 key criteria with actionable feedback for continuous improvement.</p>
                </div>
              </div>
            </div>
          </div>
          
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="text-center bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Phone className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Voice & Text Support</h3>
              <p className="text-sm text-gray-600">
                Practice with both speaking and typing - switch seamlessly during conversations for natural interview flow.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Smart Feedback System</h3>
              <p className="text-sm text-gray-600">
                Get detailed scoring on communication, technical depth, problem solving, cultural fit, and experience.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Building className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Complete Interview Journey</h3>
              <p className="text-sm text-gray-600">
                Practice all 5 stages from initial screening to final executive interviews with role-appropriate scenarios.
              </p>
            </CardContent>
          </Card>
        </div>
        </section>
      </main>
    </div>
  );
}
