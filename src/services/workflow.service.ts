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

// Get workflow steps for a group by groupId (database-backed only)
export async function getWorkflowStepsByGroupId(groupId: number | null): Promise<WorkflowStep[]> {
  if (!groupId) {
    logger.error('No groupId provided, cannot fetch workflow');
    throw new Error('groupId is required to fetch workflow');
  }

  try {
    logger.log(`[WorkflowService] Fetching workflow for groupId: ${groupId}`);
    const group = await prisma.groups.findUnique({
      where: { id: groupId },
      include: { workflows: true },
    });

    if (group && group.workflows && Array.isArray(group.workflows.steps)) {
      logger.log(`[WorkflowService] Workflow found with ${group.workflows.steps.length} steps`);
      return group.workflows.steps as unknown as WorkflowStep[];
    } else {
      logger.error(`[WorkflowService] No workflow found for groupId: ${groupId}`);
      throw new Error(`No workflow found for groupId: ${groupId}`);
    }
  } catch (err) {
    logger.error(`[WorkflowService] Error fetching workflow for groupId: ${groupId}`, err);
    throw err;
  }
}
