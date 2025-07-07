import { logger } from '../utils/logger';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
export interface WorkflowStep {
  id: number;
  question: string;
  malayalam: string;
  yes_next: number | string;
  no_next: number | string;
}

// Malayalam-focused demo workflow for Entri-like educational institution
const demoWorkflow: WorkflowStep[] = [
  {
    id: 1,
    question: 'Are you interested in joining our educational programs?',
    malayalam: 'നിങ്ങൾക്ക് ഞങ്ങളുടെ വിദ്യാഭ്യാസ പ്രോഗ്രാമുകളിൽ ചേരാൻ താല്പര്യമുണ്ടോ?',
    yes_next: 2,
    no_next: 'end'
  },
  {
    id: 2,
    question: 'Which field are you interested in? (Technology/Healthcare/Business)',
    malayalam: 'ഏത് മേഖലയിലാണ് നിങ്ങൾക്ക് താല്പര്യം? (ടെക്നോളജി/ഹെൽത്ത്‌കെയർ/ബിസിനസ്)',
    yes_next: 3,
    no_next: 4
  },
  {
    id: 3,
    question: "Great! We have excellent tech courses. What's your current education level?",
    malayalam: 'കൊള്ളാം! ഞങ്ങൾക്ക് മികച്ച ടെക് കോഴ്സുകൾ ഉണ്ട്. നിങ്ങളുടെ നിലവിലെ വിദ്യാഭ്യാസ നില എന്താണ്?',
    yes_next: 5,
    no_next: 6
  },
  {
    id: 4,
    question: "Excellent choice! We have healthcare courses. What's your current education level?",
    malayalam: 'മികച്ച തിരഞ്ഞെടുപ്പ്! ഞങ്ങൾക്ക് ഹെൽത്ത്‌കെയർ കോഴ്സുകൾ ഉണ്ട്. നിങ്ങളുടെ നിലവിലെ വിദ്യാഭ്യാസ നില എന്താണ്?',
    yes_next: 7,
    no_next: 8
  },
  {
    id: 5,
    question: 'Perfect! We recommend our Full Stack Development course. Are you interested?',
    malayalam: 'തികഞ്ഞത്! ഞങ്ങൾ ഫുൾ സ്റ്റാക്ക് ഡെവലപ്മെന്റ് കോഴ്സ് ശുപാർശ ചെയ്യുന്നു. നിങ്ങൾക്ക് താല്പര്യമുണ്ടോ?',
    yes_next: 9,
    no_next: 10
  },
  {
    id: 6,
    question: 'Great! We recommend our Advanced Software Engineering course. Are you interested?',
    malayalam: 'കൊള്ളാം! ഞങ്ങൾ അഡ്വാൻസ്ഡ് സോഫ്റ്റ്വെയർ എഞ്ചിനീയറിംഗ് കോഴ്സ് ശുപാർശ ചെയ്യുന്നു. നിങ്ങൾക്ക് താല്പര്യമുണ്ടോ?',
    yes_next: 11,
    no_next: 10
  },
  {
    id: 7,
    question: 'Perfect! We recommend our Nursing Assistant course. Are you interested?',
    malayalam: 'തികഞ്ഞത്! ഞങ്ങൾ നഴ്സിംഗ് അസിസ്റ്റന്റ് കോഴ്സ് ശുപാർശ ചെയ്യുന്നു. നിങ്ങൾക്ക് താല്പര്യമുണ്ടോ?',
    yes_next: 12,
    no_next: 10
  },
  {
    id: 8,
    question: 'Great! We recommend our Medical Coding course. Are you interested?',
    malayalam: 'കൊള്ളാം! ഞങ്ങൾ മെഡിക്കൽ കോഡിംഗ് കോഴ്സ് ശുപാർശ ചെയ്യുന്നു. നിങ്ങൾക്ക് താല്പര്യമുണ്ടോ?',
    yes_next: 13,
    no_next: 10
  },
  {
    id: 9,
    question: 'Excellent! Our Full Stack course costs ₹25,000. Can you afford this?',
    malayalam: 'മികച്ചത്! ഞങ്ങളുടെ ഫുൾ സ്റ്റാക്ക് കോഴ്സിന് ₹25,000 ചിലവാകും. നിങ്ങൾക്ക് ഇത് വഹിക്കാൻ കഴിയുമോ?',
    yes_next: 14,
    no_next: 15
  },
  {
    id: 10,
    question: 'No problem! We have many other courses. Would you like to speak with our counselor?',
    malayalam: 'പ്രശ്നമില്ല! ഞങ്ങൾക്ക് മറ്റ് പല കോഴ്സുകളും ഉണ്ട്. ഞങ്ങളുടെ കൗൺസിലറുമായി സംസാരിക്കാൻ താല്പര്യമുണ്ടോ?',
    yes_next: 16,
    no_next: 'end'
  },
  {
    id: 11,
    question: 'Excellent! Our Advanced Software Engineering course costs ₹35,000. Can you afford this?',
    malayalam: 'മികച്ചത്! ഞങ്ങളുടെ അഡ്വാൻസ്ഡ് സോഫ്റ്റ്വെയർ എഞ്ചിനീയറിംഗ് കോഴ്സിന് ₹35,000 ചിലവാകും. നിങ്ങൾക്ക് ഇത് വഹിക്കാൻ കഴിയുമോ?',
    yes_next: 17,
    no_next: 15
  },
  {
    id: 12,
    question: 'Excellent! Our Nursing Assistant course costs ₹20,000. Can you afford this?',
    malayalam: 'മികച്ചത്! ഞങ്ങളുടെ നഴ്സിംഗ് അസിസ്റ്റന്റ് കോഴ്സിന് ₹20,000 ചിലവാകും. നിങ്ങൾക്ക് ഇത് വഹിക്കാൻ കഴിയുമോ?',
    yes_next: 18,
    no_next: 15
  },
  {
    id: 13,
    question: 'Excellent! Our Medical Coding course costs ₹30,000. Can you afford this?',
    malayalam: 'മികച്ചത്! ഞങ്ങളുടെ മെഡിക്കൽ കോഡിംഗ് കോഴ്സിന് ₹30,000 ചിലവാകും. നിങ്ങൾക്ക് ഇത് വഹിക്കാൻ കഴിയുമോ?',
    yes_next: 19,
    no_next: 15
  },
  {
    id: 14,
    question: "Perfect! We'll send you enrollment details via WhatsApp. What's your name?",
    malayalam: 'തികഞ്ഞത്! ഞങ്ങൾ വാട്സ്ആപ്പ് വഴി എൻ‌റോൾമെന്റ് വിവരങ്ങൾ അയയ്ക്കും. നിങ്ങളുടെ പേര് എന്താണ്?',
    yes_next: 20,
    no_next: 20
  },
  {
    id: 15,
    question: 'No problem! We offer EMI options starting from ₹2,000/month. Would you like to know more?',
    malayalam: 'പ്രശ്നമില്ല! ഞങ്ങൾ ₹2,000/മാസം മുതൽ EMI ഓപ്ഷനുകൾ വാഗ്ദാനം ചെയ്യുന്നു. കൂടുതൽ അറിയാൻ താല്പര്യമുണ്ടോ?',
    yes_next: 21,
    no_next: 'end'
  },
  {
    id: 16,
    question: "Great! Our counselor will call you within 24 hours. What's your name?",
    malayalam: 'കൊള്ളാം! ഞങ്ങളുടെ കൗൺസിലർ 24 മണിക്കൂറിനുള്ളിൽ നിങ്ങളെ വിളിക്കും. നിങ്ങളുടെ പേര് എന്താണ്?',
    yes_next: 22,
    no_next: 22
  },
  {
    id: 17,
    question: "Perfect! We'll send you enrollment details via WhatsApp. What's your name?",
    malayalam: 'തികഞ്ഞത്! ഞങ്ങൾ വാട്സ്ആപ്പ് വഴി എൻ‌റോൾമെന്റ് വിവരങ്ങൾ അയയ്ക്കും. നിങ്ങളുടെ പേര് എന്താണ്?',
    yes_next: 23,
    no_next: 23
  },
  {
    id: 18,
    question: "Perfect! We'll send you enrollment details via WhatsApp. What's your name?",
    malayalam: 'തികഞ്ഞത്! ഞങ്ങൾ വാട്സ്ആപ്പ് വഴി എൻ‌റോൾമെന്റ് വിവരങ്ങൾ അയയ്ക്കും. നിങ്ങളുടെ പേര് എന്താണ്?',
    yes_next: 24,
    no_next: 24
  },
  {
    id: 19,
    question: "Perfect! We'll send you enrollment details via WhatsApp. What's your name?",
    malayalam: 'തികഞ്ഞത്! ഞങ്ങൾ വാട്സ്ആപ്പ് വഴി എൻ‌റോൾമെന്റ് വിവരങ്ങൾ അയയ്ക്കും. നിങ്ങളുടെ പേര് എന്താണ്?',
    yes_next: 25,
    no_next: 25
  },
  {
    id: 20,
    question: "Thank you! We'll send Full Stack Development course details to your WhatsApp. Have a great day!",
    malayalam: 'നന്ദി! ഞങ്ങൾ ഫുൾ സ്റ്റാക്ക് ഡെവലപ്മെന്റ് കോഴ്സ് വിവരങ്ങൾ നിങ്ങളുടെ വാട്സ്ആപ്പിലേക്ക് അയയ്ക്കും. ഒരു നല്ല ദിവസം ആശംസിക്കുന്നു!',
    yes_next: 'end',
    no_next: 'end'
  },
  {
    id: 21,
    question: "Great! We'll send EMI details via WhatsApp. What's your name?",
    malayalam: 'കൊള്ളാം! ഞങ്ങൾ EMI വിവരങ്ങൾ വാട്സ്ആപ്പ് വഴി അയയ്ക്കും. നിങ്ങളുടെ പേര് എന്താണ്?',
    yes_next: 26,
    no_next: 26
  },
  {
    id: 22,
    question: 'Thank you! Our counselor will call you soon. Have a great day!',
    malayalam: 'നന്ദി! ഞങ്ങളുടെ കൗൺസിലർ ഉടൻ നിങ്ങളെ വിളിക്കും. ഒരു നല്ല ദിവസം ആശംസിക്കുന്നു!',
    yes_next: 'end',
    no_next: 'end'
  },
  {
    id: 23,
    question: "Thank you! We'll send Advanced Software Engineering course details to your WhatsApp. Have a great day!",
    malayalam: 'നന്ദി! ഞങ്ങൾ അഡ്വാൻസ്ഡ് സോഫ്റ്റ്വെയർ എഞ്ചിനീയറിംഗ് കോഴ്സ് വിവരങ്ങൾ നിങ്ങളുടെ വാട്സ്ആപ്പിലേക്ക് അയയ്ക്കും. ഒരു നല്ല ദിവസം ആശംസിക്കുന്നു!',
    yes_next: 'end',
    no_next: 'end'
  },
  {
    id: 24,
    question: "Thank you! We'll send Nursing Assistant course details to your WhatsApp. Have a great day!",
    malayalam: 'നന്ദി! ഞങ്ങൾ നഴ്സിംഗ് അസിസ്റ്റന്റ് കോഴ്സ് വിവരങ്ങൾ നിങ്ങളുടെ വാട്സ്ആപ്പിലേക്ക് അയയ്ക്കും. ഒരു നല്ല ദിവസം ആശംസിക്കുന്നു!',
    yes_next: 'end',
    no_next: 'end'
  },
  {
    id: 25,
    question: "Thank you! We'll send Medical Coding course details to your WhatsApp. Have a great day!",
    malayalam: 'നന്ദി! ഞങ്ങൾ മെഡിക്കൽ കോഡിംഗ് കോഴ്സ് വിവരങ്ങൾ നിങ്ങളുടെ വാട്സ്ആപ്പിലേക്ക് വഴി അയയ്ക്കും. ഒരു നല്ല ദിവസം ആശംസിക്കുന്നു!',
    yes_next: 'end',
    no_next: 'end'
  },
  {
    id: 26,
    question: "Thank you! We'll send EMI details to your WhatsApp. Have a great day!",
    malayalam: 'നന്ദി! ഞങ്ങൾ EMI വിവരങ്ങൾ നിങ്ങളുടെ വാട്സ്ആപ്പിലേക്ക് അയയ്ക്കും. ഒരു നല്ല ദിവസം ആശംസിക്കുന്നു!',
    yes_next: 'end',
    no_next: 'end'
  }
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


// export async function getWorkflowSteps(groupId: number | null): Promise<WorkflowStep[]> {
//   // Fetch the group and its workflow
//   const group = await prisma.groups.findUnique({
//     where: { id: groupId },
//     include: { workflows: true },
//   });

//   if (!group || !group.workflows) {
//     throw new Error('Group or workflow not found');
//   }

//   // Assuming steps is stored as JSON in the workflows table
//   return group.workflows.steps as WorkflowStep[];
// }

logger.success('Malayalam Workflow Service initialized with demo Entri-like educational institution workflow');
logger.log('NOTE: This Malayalam workflow will be given to Gemini as a NORMAL PROMPT (not system prompt)');
logger.log('NOTE: In production, Malayalam workflow will come from database based on groupId');
