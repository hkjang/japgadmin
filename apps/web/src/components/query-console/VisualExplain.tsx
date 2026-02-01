import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Clock, Database, Layers, ArrowRight, AlertTriangle } from 'lucide-react';

interface ExplainNode {
  "Node Type": string;
  "Relation Name"?: string;
  "Alias"?: string;
  "Startup Cost": number;
  "Total Cost": number;
  "Plan Rows": number;
  "Plan Width": number;
  "Actual Startup Time"?: number;
  "Actual Total Time"?: number;
  "Actual Rows"?: number;
  "Actual Loops"?: number;
  "Filter"?: string;
  "Join Filter"?: string;
  "Hash Cond"?: string;
  "Index Name"?: string;
  "Index Cond"?: string;
  "Plans"?: ExplainNode[];
  [key: string]: any;
}

interface VisualExplainProps {
  plan: ExplainNode | { Plan: ExplainNode }; // It can be wrapped in "Plan" or direct node
}

const NodeIcon = ({ type }: { type: string }) => {
  if (type.includes('Scan')) return <Database className="w-4 h-4 text-blue-400" />;
  if (type.includes('Join')) return <Layers className="w-4 h-4 text-purple-400" />;
  if (type.includes('Sort')) return <ArrowRight className="w-4 h-4 text-orange-400" />;
  return <div className="w-4 h-4 rounded-full bg-gray-600" />;
};

const PlanNode = ({ node, maxCost, depth = 0 }: { node: ExplainNode; maxCost: number; depth?: number }) => {
  const [expanded, setExpanded] = useState(true);
  
  const costPercentage = (node["Total Cost"] / maxCost) * 100;
  const isExpensive = costPercentage > 50; 
  const isVeryExpensive = costPercentage > 80;

  const hasChildren = node.Plans && node.Plans.length > 0;

  return (
    <div className="flex flex-col">
      <div 
        className={`
          flex items-center gap-2 p-2 rounded-lg border my-1 transition-colors
          ${isVeryExpensive ? 'border-red-500/50 bg-red-900/10' : 'border-gray-700 bg-gray-800/30 hover:bg-gray-800/60'}
          ${depth > 0 ? 'ml-6' : ''}
        `}
      >
        <button 
          onClick={() => setExpanded(!expanded)}
          className={`p-1 rounded hover:bg-gray-700 ${!hasChildren ? 'invisible' : ''}`}
        >
          {expanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
        </button>

        <NodeIcon type={node["Node Type"]} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-200 text-sm">{node["Node Type"]}</span>
            {node["Relation Name"] && (
              <span className="text-gray-400 text-xs">on {node["Relation Name"]}</span>
            )}
            {node["Index Name"] && (
              <span className="text-gray-500 text-xs text-italic">({node["Index Name"]})</span>
            )}
          </div>
          
          <div className="flex items-center gap-4 text-xs text-gray-400 mt-1">
            <span title="Cost">Cost: {node["Total Cost"].toFixed(2)}</span>
            <span title="Rows">Rows: {node["Plan Rows"]}</span>
            {node["Actual Total Time"] && (
              <span className="flex items-center gap-1 text-green-400">
                <Clock className="w-3 h-3" />
                {node["Actual Total Time"].toFixed(3)}ms
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          {isExpensive && (
            <span className={`text-xs px-2 py-0.5 rounded-full ${isVeryExpensive ? 'bg-red-500/20 text-red-400' : 'bg-orange-500/20 text-orange-400'}`}>
              {costPercentage.toFixed(1)}% Cost
            </span>
          )}
        </div>
      </div>

      {expanded && hasChildren && (
        <div className="relative">
          {/* Vertical line for hierarchy visualisation could go here */}
          {node.Plans?.map((child, idx) => (
            <div key={idx} className="relative">
               <PlanNode node={child} maxCost={maxCost} depth={depth + 1} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default function VisualExplain({ plan }: VisualExplainProps) {
  if (!plan) return null;

  const rootNode = 'Plan' in plan ? plan.Plan : plan;

  // Calculate max cost for relative coloring
  const maxCost = rootNode["Total Cost"] || 100;

  return (
    <div className="h-full overflow-auto custom-scrollbar p-4">
       <PlanNode node={rootNode} maxCost={maxCost} />
    </div>
  );
}
