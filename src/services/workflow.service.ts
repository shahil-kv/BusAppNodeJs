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
    question: 'Hello, can I ask you a few questions?',
    malayalam: 'ഹലോ, ഞാൻ നിങ്ങൾക്ക് കുറച്ച് ചോദ്യങ്ങൾ ചോദിക്കാമോ?',
    answerType: 'yes_no',
    branch: { yes: 'qualify_interest', no: 'end_call' }
  },
  // ... more steps ...
];

// Get workflow steps for a group
export async function getWorkflowSteps(groupId: number | null): Promise<WorkflowStep[]> {
  logger.log('Getting Malayalam workflow steps for group ID:', groupId);

  // For now, return demo workflow (simulating database fetch)
  // TODO: In production, fetch from database based on groupId
  logger.log('Using Malayalam demo Entri-like educational institution workflow');
  logger.log('Malayalam demo workflow steps count:', demoWorkflow.length);

  return demoWorkflow;
}

// Get workflow steps for a group by groupId (dynamic, DB-backed)
export async function getWorkflowStepsByGroupId(groupId: number | null): Promise<WorkflowStep[]> {
  logger.log('Getting workflow steps for group ID:', groupId);
  if (!groupId) return demoWorkflow;
  try {
    const group = await prisma.groups.findUnique({
      where: { id: groupId },
      include: { workflows: true },
    });
    if (group && group.workflows && Array.isArray(group.workflows.steps)) {
      logger.log('Fetched workflow from DB for group:', groupId);
      return group.workflows.steps as unknown as WorkflowStep[];
    } else {
      logger.warn('No workflow found for group, using demoWorkflow');
      return demoWorkflow;
    }
  } catch (err) {
    logger.error('Error fetching workflow for group:', groupId, err);
    return demoWorkflow;
  }
}
