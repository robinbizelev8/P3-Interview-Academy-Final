import { useParams, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { 
  Star, 
  Clock, 
  Building, 
  Briefcase, 
  ChevronLeft,
  MessageSquare,
  Trophy,
  Target,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  Users,
  MapPin,
  Zap,
  BarChart3
} from 'lucide-react';

interface FeedbackData {
  id: string;
  position: string;
  company: string;
  interviewStage: string;
  duration: number;
  overallScore: number;
  criteriaScores: {
    relevance: number;
    structured: number;
    specific: number;
    honest: number;
    confident: number;
    aligned: number;
    outcomeOriented: number;
  };
  criteriaFeedback?: {
    relevance: { score: number; feedback: string; suggestions: string[] };
    structured: { score: number; feedback: string; suggestions: string[] };
    specific: { score: number; feedback: string; suggestions: string[] };
    honest: { score: number; feedback: string; suggestions: string[] };
    confident: { score: number; feedback: string; suggestions: string[] };
    aligned: { score: number; feedback: string; suggestions: string[] };
    outcomeOriented: { score: number; feedback: string; suggestions: string[] };
  };
  starAnalysis?: {
    situation: { present: boolean; score: number; feedback: string };
    task: { present: boolean; score: number; feedback: string };
    action: { present: boolean; score: number; feedback: string };
    result: { present: boolean; score: number; feedback: string };
    overallStarScore: number;
  };
  feedback: string;
  improvements: string[];
  completedAt: string;
}

export default function Feedback() {
  const { sessionId } = useParams();
  const [, setLocation] = useLocation();

  // Fetch session feedback data
  const { data: feedback, isLoading } = useQuery<FeedbackData>({
    queryKey: ['/api/practice/sessions', sessionId],
    enabled: !!sessionId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Skeleton className="h-8 w-64 mb-6" />
          <div className="space-y-6">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!feedback || !feedback.feedback) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="p-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Feedback Not Available</h3>
            <p className="text-gray-600 mb-4">
              The interview feedback is not ready yet or the session was not found.
            </p>
            <Button onClick={() => setLocation('/practice')}>
              Back to Practice
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const criteriaLabels = {
    relevance: 'Relevance',
    structured: 'Structured (STAR)',
    specific: 'Specific',
    honest: 'Honest',
    confident: 'Confident - but not arrogant',
    aligned: 'Aligned with the role',
    outcomeOriented: 'Outcome Orientated'
  };

  const getScoreColor = (score: number) => {
    if (score >= 4) return 'text-green-600';
    if (score >= 3) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBadgeVariant = (score: number) => {
    if (score >= 4) return 'default';
    if (score >= 3) return 'secondary';
    return 'destructive';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button 
            variant="ghost" 
            onClick={() => setLocation('/practice')}
            className="mb-4"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back to Practice
          </Button>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Interview Performance Feedback
              </h1>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <Briefcase className="w-4 h-4" />
                  {feedback.position}
                </div>
                <div className="flex items-center gap-1">
                  <Building className="w-4 h-4" />
                  {feedback.company}
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {Math.round((feedback.duration || 0) / 60)}m duration
                </div>
              </div>
            </div>
            
            <div className="text-center">
              <div className="flex items-center gap-2 mb-1">
                <Trophy className="w-5 h-5 text-yellow-500" />
                <span className="text-sm font-medium text-gray-600">Overall Score</span>
              </div>
              <div className={`text-3xl font-bold ${getScoreColor((feedback.overallScore || 0) / 7)}`}>
                {feedback.overallScore || 0}/35
              </div>
            </div>
          </div>
        </div>

        {/* Assessment Display - 7 Criteria Breakdown */}
        {feedback.criteriaScores && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5" />
                Assessment Criteria (Each out of 5 - Total 35 max)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4">
                {Object.entries(feedback.criteriaScores).map(([key, score]) => {
                  const criteriaKey = key as keyof typeof criteriaLabels;
                  const detailedFeedback = feedback.criteriaFeedback?.[criteriaKey];
                  
                  return (
                    <div key={key} className="border-l-4 border-blue-200 pl-4 py-2">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-gray-800">
                          {criteriaLabels[criteriaKey]}
                        </span>
                        <div className="flex items-center gap-2">
                          <Progress value={score * 20} className="w-20" />
                          <Badge variant={getScoreBadgeVariant(score)} className="min-w-[3rem] justify-center">
                            {score}/5
                          </Badge>
                        </div>
                      </div>
                      
                      {detailedFeedback && (
                        <div className="mt-2 space-y-2">
                          <p className="text-sm text-gray-600 leading-relaxed">
                            {detailedFeedback.feedback}
                          </p>
                          {detailedFeedback.suggestions.length > 0 && (
                            <div className="ml-4">
                              <p className="text-xs font-medium text-blue-700 mb-1">Suggestions:</p>
                              <ul className="text-xs text-gray-600 space-y-1">
                                {detailedFeedback.suggestions.map((suggestion, idx) => (
                                  <li key={idx} className="flex items-start gap-2">
                                    <span className="text-blue-500 mt-1">•</span>
                                    <span>{suggestion}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* STAR Framework Analysis */}
        {feedback.starAnalysis && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="w-5 h-5" />
                STAR Framework Analysis
              </CardTitle>
              <p className="text-sm text-gray-600">
                Assessment of your responses using the STAR method (Situation, Task, Action, Result)
              </p>
            </CardHeader>
            <CardContent>
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium text-gray-700">Overall STAR Score</span>
                  <div className="flex items-center gap-2">
                    <Progress value={feedback.starAnalysis.overallStarScore * 20} className="w-24" />
                    <Badge variant={getScoreBadgeVariant(feedback.starAnalysis.overallStarScore)}>
                      {feedback.starAnalysis.overallStarScore.toFixed(1)}/5.0
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Situation */}
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2 mb-3">
                    <MapPin className="w-5 h-5 text-blue-600" />
                    <h4 className="font-semibold text-blue-900">Situation</h4>
                    <Badge variant={feedback.starAnalysis.situation.present ? "default" : "destructive"}>
                      {feedback.starAnalysis.situation.score.toFixed(1)}
                    </Badge>
                  </div>
                  <p className="text-sm text-blue-800">
                    {feedback.starAnalysis.situation.feedback}
                  </p>
                </div>

                {/* Task */}
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center gap-2 mb-3">
                    <Target className="w-5 h-5 text-green-600" />
                    <h4 className="font-semibold text-green-900">Task</h4>
                    <Badge variant={feedback.starAnalysis.task.present ? "default" : "destructive"}>
                      {feedback.starAnalysis.task.score.toFixed(1)}
                    </Badge>
                  </div>
                  <p className="text-sm text-green-800">
                    {feedback.starAnalysis.task.feedback}
                  </p>
                </div>

                {/* Action */}
                <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="w-5 h-5 text-purple-600" />
                    <h4 className="font-semibold text-purple-900">Action</h4>
                    <Badge variant={feedback.starAnalysis.action.present ? "default" : "destructive"}>
                      {feedback.starAnalysis.action.score.toFixed(1)}
                    </Badge>
                  </div>
                  <p className="text-sm text-purple-800">
                    {feedback.starAnalysis.action.feedback}
                  </p>
                </div>

                {/* Result */}
                <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                  <div className="flex items-center gap-2 mb-3">
                    <BarChart3 className="w-5 h-5 text-orange-600" />
                    <h4 className="font-semibold text-orange-900">Result</h4>
                    <Badge variant={feedback.starAnalysis.result.present ? "default" : "destructive"}>
                      {feedback.starAnalysis.result.score.toFixed(1)}
                    </Badge>
                  </div>
                  <p className="text-sm text-orange-800">
                    {feedback.starAnalysis.result.feedback}
                  </p>
                </div>
              </div>

              {/* STAR Guidance */}
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-semibold text-gray-900 mb-3">💡 STAR Method Quick Guide</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="font-medium text-blue-700">Situation:</span> Describe the context and background
                  </div>
                  <div>
                    <span className="font-medium text-green-700">Task:</span> Explain your specific role and objectives
                  </div>
                  <div>
                    <span className="font-medium text-purple-700">Action:</span> Detail the steps you took
                  </div>
                  <div>
                    <span className="font-medium text-orange-700">Result:</span> Share the outcomes and what you learned
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Detailed Feedback */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Detailed Feedback
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose max-w-none text-gray-700">
              {feedback.feedback.split('\n').map((paragraph, index) => (
                <p key={index} className="mb-3 leading-relaxed">
                  {paragraph}
                </p>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Improvement Suggestions */}
        {feedback.improvements && feedback.improvements.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Areas for Improvement
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {feedback.improvements.map((improvement, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">{improvement}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex gap-4 flex-wrap">
          <Button onClick={() => setLocation('/practice')} variant="outline">
            Practice More Interviews
          </Button>
          <Button onClick={() => setLocation('/prepare')} variant="default">
            Review Preparation Materials
          </Button>
          <Button 
            onClick={() => {
              window.open(`/api/practice/sessions/${sessionId}/transcript/download`, '_blank');
            }}
            variant="secondary"
          >
            Download Transcript
          </Button>
        </div>
      </div>
    </div>
  );
}