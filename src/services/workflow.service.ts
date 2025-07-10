import { logger } from '../utils/logger';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
export interface WorkflowStep {
  id: string; // was number | string
  question: string;
  malayalam?: string;
  answerType?: string;
  branch?: { [answer: string]: string };
}


const demoWorkflow: WorkflowStep[] = [
  {
    id: 'greet',
    question: 'Hello, contact shahil?',
    malayalam: 'ഹലോ, panniii paaaaliiiii contact shahil ?',
    answerType: 'yes_no',
    branch: { yes: 'qualify_interest', no: 'end_call' }
  },
  // ... more steps ...
];

// Get workflow steps for a group
export async function getWorkflowSteps(groupId: number | null): Promise<WorkflowStep[]> {
  logger.error("Using Default Workflow what happenedd i don't know " + groupId)
  return demoWorkflow;
}

// Get workflow steps for a group by groupId (dynamic, DB-backed)
export async function getWorkflowStepsByGroupId(groupId: number | null): Promise<WorkflowStep[]> {
  if (!groupId) return demoWorkflow;
  try {
    const group = await prisma.groups.findUnique({
      where: { id: groupId },
      include: { workflows: true },
    });
    if (group && group.workflows && Array.isArray(group.workflows.steps)) {
      return group.workflows.steps as unknown as WorkflowStep[];
    } else {
      logger.error('No workflow found for group, using demoWorkflow');
      return demoWorkflow;
    }
  } catch (err) {
    logger.error('Error fetching workflow for group:', groupId, err);
    return demoWorkflow;
  }
}
