import { apiClient, unwrapResponse } from './client';
import { StandardResponse } from '../types/common';

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  subType?: string;
  properties: Record<string, any>;
  isSuspicious: boolean;
  riskScore?: number;
  severity?: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  label?: string;
  isSuspicious: boolean;
  amount?: number;
  timestamp?: string;
}

export interface KnowledgeGraphResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: Record<string, number>;
}

export const graphApi = {
  getGraph: async (limit: number = 200): Promise<KnowledgeGraphResponse> => {
    return unwrapResponse<KnowledgeGraphResponse>(
      apiClient.get<StandardResponse<KnowledgeGraphResponse>>('/graph', { params: { limit } })
    );
  },

  getCaseGraph: async (caseId: string): Promise<KnowledgeGraphResponse> => {
    return unwrapResponse<KnowledgeGraphResponse>(
      apiClient.get<StandardResponse<KnowledgeGraphResponse>>(`/graph/case/${caseId}`)
    );
  },
};
