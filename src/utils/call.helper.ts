import crypto from 'crypto';
// Helper to parse current_step as JSON object
function parseCurrentStep(current_step): { workflow_id; step_id } | null {
  if (!current_step) return null;
  if (typeof current_step === 'string') {
    try {
      return JSON.parse(current_step);
    } catch {
      return null;
    }
  }
  if (typeof current_step === 'object' && current_step.step_id !== undefined) {
    return current_step;
  }
  return null;
}

// Hash function for caching TTS
function hash(text: string): string {
  return crypto.createHash('md5').update(text).digest('hex');
}

export { parseCurrentStep, hash };
