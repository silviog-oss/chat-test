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
  grammar: number; // /17
  typingSpeed: number; // /17
  responseSpeed: number; // /17
  professionalism: number; // /17
  tone: number; // /16
  empathy: number; // /16
}

export interface AiFeedback {
  grammar: string;
  typingSpeed: string;
  responseSpeed: string;
  professionalism: string;
  tone: string;
  empathy: string;
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
  // Optional manual grade entered by an admin after reading the transcript.
  // The automated score is a first pass; this is the human's real verdict.
  manualScore?: number | null; // 0-100
  manualNotes?: string;
  manualVerdict?: 'pass' | 'fail' | null;
  manualGradedBy?: string; // admin email
  manualGradedAt?: number; // epoch ms
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
