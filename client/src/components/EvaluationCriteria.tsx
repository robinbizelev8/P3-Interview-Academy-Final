import { Star } from "lucide-react";
import type { EvaluationCriteria } from "@shared/schema";

interface EvaluationCriteriaProps {
  scores: Partial<EvaluationCriteria>;
}

const criteria = [
  { key: 'technicalDepth', label: 'Technical Depth' },
  { key: 'problemSolving', label: 'Problem Solving' },
  { key: 'communication', label: 'Communication' },
  { key: 'leadershipImpact', label: 'Leadership Impact' },
  { key: 'resultsFocused', label: 'Results Focused' },
];

export default function EvaluationCriteria({ scores }: EvaluationCriteriaProps) {
  const renderStars = (score: number = 0) => {
    return (
      <div className="flex items-center space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${
              star <= score
                ? 'text-warning-yellow fill-current'
                : 'text-gray-300'
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
      <h4 className="text-lg font-semibold text-gray-900 mb-4">Evaluation Criteria</h4>
      
      <div className="space-y-4">
        {criteria.map((criterion) => (
          <div key={criterion.key} className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">{criterion.label}</span>
            {renderStars((scores as any)?.[criterion.key] || 0)}
          </div>
        ))}
      </div>
    </div>
  );
}
