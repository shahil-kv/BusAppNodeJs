interface WorkflowStep {
  step_id: number | string;
  question: string;
  malayalam?: string;
  yes_next?: number | string | null;
  no_next?: number | string | null;
}

interface NextStepResponse {
  nextStep: WorkflowStep | null;
  shouldEnd: boolean;
}

export type { WorkflowStep, NextStepResponse };
