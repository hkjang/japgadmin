import React from 'react';
import { Lightbulb, AlertTriangle, CheckCircle } from 'lucide-react';

interface ExplainNode {
  "Node Type": string;
  "Relation Name"?: string;
  "Total Cost": number;
  "Plan Rows": number;
  "Plans"?: ExplainNode[];
  "Filter"?: string;
  [key: string]: any;
}

interface PerformanceInsightsProps {
  plan: any;
}

export default function PerformanceInsights({ plan }: PerformanceInsightsProps) {
  if (!plan) return null;

  const root = 'Plan' in plan ? plan.Plan : plan;
  const insights: { type: 'warning' | 'info' | 'success'; message: string; details?: string }[] = [];

  // Recursive function to analyze the plan
  const analyzeNode = (node: ExplainNode) => {
    const nodeType = node["Node Type"] || '';
    const totalCost = node["Total Cost"] || 0;

    // Check for Sequential Scans on potentially large tables (heuristic: cost > 1000)
    if (nodeType === 'Seq Scan' && totalCost > 1000) {
      insights.push({
        type: 'warning',
        message: `Sequential Scan detected on ${node["Relation Name"] || 'table'}`,
        details: `Cost: ${totalCost.toFixed(2)}. Consider adding an index to avoid full table scan if filtering is used.`
      });
    }

    // Check for Filter without Index
    if (node["Filter"] && nodeType === 'Seq Scan') {
       insights.push({
        type: 'info',
        message: `Filtering is happening after data retrieval on ${node["Relation Name"]}`,
        details: `Filter: ${node["Filter"]}. An index covering these columns might improve performance.`
      });
    }

    // Check for nested loops with high cost
    if (nodeType === 'Nested Loop' && totalCost > 5000) {
      insights.push({
        type: 'warning',
        message: 'High-cost Nested Loop detected',
        details: 'Nested loops can be slow for large datasets. Check if join columns are indexed.'
      });
    }
    
    // Sort operations
    if (nodeType.includes('Sort') && totalCost > 1000) {
        insights.push({
            type: 'info',
            message: 'Expensive Sort operation',
            details: 'Consider using an index that provides the desired order to avoid explicit sorting.'
        });
    }

    if (node.Plans) {
      node.Plans.forEach(analyzeNode);
    }
  };

  analyzeNode(root);

  if (insights.length === 0) {
    insights.push({
      type: 'success',
      message: 'No obvious performance issues detected',
      details: 'The query plan looks reasonable based on basic heuristics.'
    });
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-400 flex items-center gap-2">
        <Lightbulb className="w-4 h-4 text-yellow-500" />
        성능 분석 인사이트
      </h3>
      
      <div className="space-y-2">
        {insights.map((insight, idx) => (
          <div 
            key={idx} 
            className={`
              p-3 rounded-lg border text-sm
              ${insight.type === 'warning' ? 'bg-orange-900/10 border-orange-500/30' : ''}
              ${insight.type === 'info' ? 'bg-blue-900/10 border-blue-500/30' : ''}
              ${insight.type === 'success' ? 'bg-green-900/10 border-green-500/30' : ''}
            `}
          >
            <div className="flex items-start gap-2">
              {insight.type === 'warning' && <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />}
              {insight.type === 'info' && <Lightbulb className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />}
              {insight.type === 'success' && <CheckCircle className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />}
              
              <div>
                <p className={`font-medium ${
                    insight.type === 'warning' ? 'text-orange-200' :
                    insight.type === 'info' ? 'text-blue-200' : 'text-green-200'
                }`}>
                  {insight.message}
                </p>
                {insight.details && (
                  <p className="text-gray-400 mt-1 text-xs">
                    {insight.details}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
