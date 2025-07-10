interface WorkflowStep {
  id: string; // was number | string
  question: string;
  malayalam?: string;
  answerType?: string;
  branch?: { [answer: string]: string };
}

interface NextStepResponse {
  nextStep: WorkflowStep | null;
  shouldEnd: boolean;
}

export type { WorkflowStep, NextStepResponse };
