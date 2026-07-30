export type Priority = 'low' | 'medium' | 'high';

export interface ChatTurn {
  role: 'agent' | 'customer';
  text: string;
  ts: number;
}

export interface ConversationTranscript {
  personaId: string;
  personaName: string;
  turns: ChatTurn[];
  resolved: boolean;
}

export interface TypingResult {
  wpm: number;
  accuracy: number; // percent 0-100
  completionSeconds: number;
}

export interface CategoryScores {
  responseTime: number; // /20
  grammar: number; // /10
  professionalTone: number; // /15
  accuracy: number; // /20
  conversationManagement: number; // /20
  prioritization: number; // /15
}

export interface AiFeedback {
  professionalism: string;
  grammar: string;
  empathy: string;
  problemSolving: string;
  accuracy: string;
  conversationManagement: string;
  summary: string;
}

export interface AssessmentResult {
  uid: string;
  name: string;
  email: string;
  dateTaken: number; // epoch ms
  typing: TypingResult;
  categories: CategoryScores;
  overall: number; // /100
  aiFeedback: AiFeedback;
  transcripts: ConversationTranscript[];
  timeSpentSeconds: number;
  passed: boolean;
}

export type AttemptStatus = 'in_progress' | 'completed';

export interface AttemptDoc {
  uid: string;
  email: string;
  name: string;
  status: AttemptStatus;
  startedAt?: unknown;
  completedAt?: unknown;
}
