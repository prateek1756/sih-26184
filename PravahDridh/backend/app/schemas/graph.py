import uuid
from typing import List, Optional, Dict, Any
from pydantic import BaseModel


class GraphNode(BaseModel):
    id: str
    label: str
    type: str  # Complaint, Account, Transaction, ATM, Investigation, Alert, Prediction
    subType: Optional[str] = None
    properties: Dict[str, Any] = {}
    isSuspicious: bool = False
    riskScore: Optional[float] = None
    severity: Optional[str] = None


class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    type: str  # HAS_TRANSACTION, FROM_ACCOUNT, TO_ACCOUNT, USES, OCCURRED_AT, CONNECTED_TO, GENERATED_FOR, TARGETS, INVESTIGATES
    label: Optional[str] = None
    isSuspicious: bool = False
    amount: Optional[float] = None
    timestamp: Optional[str] = None


class KnowledgeGraphResponse(BaseModel):
    nodes: List[GraphNode]
    edges: List[GraphEdge]
    stats: Dict[str, int]
