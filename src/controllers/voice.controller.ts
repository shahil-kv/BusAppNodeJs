import { asyncHandler } from '../utils/asyncHandler';
// import { ApiResponse } from '../utils/ApiResponse';
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import twilio from 'twilio';
import { CallStatusEnum } from '../constant';
import { generateNextStep, getWorkflowSteps } from '../services/workflow.service';
import { parseCurrentStep } from '../utils/call.helper';
import {
  generateSpeech,
  transcribeAudio,
  getOrCreateAudioUrl,
} from '../services/speech.service';
import { fetchAudioBuffer } from '../services/audio.service';
const { classifyIntent } = require('../services/dialogflow.service');
const { generateMalayalamAnswer } = require('../services/gemini.service'); // TODO: Add your Gemini API key to your environment variables (.env)
const { queryPineconeWithCache } = require('../utils/pinecone.utils');

const prisma = new PrismaClient();
const NGROK_BASE_URL = process.env.NGROK_BASE_URL;
// Handle voice interaction
const voiceHandler = asyncHandler(async (req, res: Response) => {
  const twiml = new twilio.twiml.VoiceResponse();

  try {
    const { sessionId, contactId } = req.query;

    if (!sessionId || !contactId) {
      console.error('Missing sessionId or contactId in voice handler');
      twiml.say('Sorry, there was an error. Goodbye.');
      return res.type('text/xml').send(twiml.toString());
    }

    const session = await prisma.call_session.findUnique({
      where: { id: Number(sessionId) },
      include: { call_history: true },
    });

    if (!session) {
      console.error('Session not found:', sessionId);
      twiml.say('Sorry, session not found. Goodbye.');
      return res.type('text/xml').send(twiml.toString());
    }

    const callHistory = session.call_history.find(
      (ch) => ch.contact_id === Number(contactId),
    );
    if (!callHistory) {
      console.error('Call history not found for contact:', contactId);
      twiml.say('Sorry, call record not found. Goodbye.');
      return res.type('text/xml').send(twiml.toString());
    }

    const group = session.group_id
      ? await prisma.groups.findUnique({
        where: { id: session.group_id },
        include: { workflows: true },
      })
      : null;
    const workflow = await getWorkflowSteps(group);
    const currentStepObj = parseCurrentStep(callHistory.current_step);
    const currentStep = workflow.find(
      (s) => s.step_id === (currentStepObj?.step_id || 1),
    );

    if (!currentStep) {
      console.error('No step found for step_id:', currentStepObj?.step_id);
      twiml.say('Thank you for your time. Goodbye.');
      twiml.hangup();
      return res.type('text/xml').send(twiml.toString());
    }

    const questionText = currentStep.malayalam || currentStep.question;
    try {
      const audioPath = await generateSpeech(questionText);
      const audioUrl = await getOrCreateAudioUrl(questionText, audioPath);
      twiml.play(audioUrl);
    } catch (error) {
      console.error('TTS failed, falling back to Twilio say:', error);
      twiml.say({ voice: 'alice', language: 'en-IN' }, currentStep.question);
    }

    twiml.record({
      action: `${NGROK_BASE_URL}/voice-update/response?sessionId=${sessionId}&contactId=${contactId}`,
      method: 'POST',
      maxLength: 30,
      playBeep: true,
      timeout: 2,
      transcribe: false,
      recordingStatusCallback: `${NGROK_BASE_URL}/recording-status?sessionId=${sessionId}&contactId=${contactId}`,
      recordingStatusCallbackMethod: 'POST',
    });

    res.type('text/xml').send(twiml.toString());
  } catch (error) {
    console.error('Error in voice handler:', error);
    twiml.say('Sorry, there was a technical error. Please try again later. Goodbye.');
    twiml.hangup();
    res.type('text/xml').send(twiml.toString());
  }
});
const voiceResponseHandler = asyncHandler(async (req: Request, res: Response) => {
  const twiml = new twilio.twiml.VoiceResponse();

  try {
    const { sessionId, contactId } = req.query;
    console.log(`=== Voice Response Handler Started ===`, { sessionId, contactId });

    if (!sessionId || !contactId) {
      console.error('Missing sessionId or contactId in voice response handler');
      twiml.say('Sorry, there was an error. Goodbye.');
      twiml.hangup();
      return res.type('text/xml').send(twiml.toString());
    }

    const session = await prisma.call_session.findUnique({
      where: { id: Number(sessionId) },
      include: { call_history: true },
    });

    if (!session) {
      console.error('Session not found:', sessionId);
      twiml.say('Sorry, session not found. Goodbye.');
      twiml.hangup();
      return res.type('text/xml').send(twiml.toString());
    }

    const callHistory = session.call_history.find(
      (ch) => ch.contact_id === Number(contactId),
    );
    if (!callHistory) {
      console.error('Call history not found for contact:', contactId);
      twiml.say('Sorry, call record not found. Goodbye.');
      twiml.hangup();
      return res.type('text/xml').send(twiml.toString());
    }

    const recordingUrl = req.body.RecordingUrl;
    if (!recordingUrl) {
      console.error('No recording URL provided');
      return await handleNoResponse(req, res, session, callHistory, twiml);
    }

    const audioBuffer = await fetchAudioBuffer(recordingUrl);
    const userResponse = await transcribeAudio(audioBuffer);
    if (!userResponse || userResponse.trim().length === 0) {
      console.error('Transcription returned empty result');
      return await handleNoResponse(req, res, session, callHistory, twiml);
    }

    console.log('User response:', userResponse);
    await prisma.call_history.update({
      where: { id: callHistory.id },
      data: { transcription: userResponse, updated_at: new Date() },
    });

    // === New: Intent classification ===
    // TODO: Use a unique session ID for Dialogflow session
    let dialogflowResult;
    try {
      console.log('started dialog flow ');

      dialogflowResult = await classifyIntent(userResponse, String(sessionId));
      console.log(dialogflowResult);
    } catch (error) {
      console.error(error);
    }
    if (dialogflowResult.intent === 'workflow_intent') {
      // Proceed as before (workflow logic)
      const group = session.group_id
        ? await prisma.groups.findUnique({
          where: { id: session.group_id },
          include: { workflows: true },
        })
        : null;
      const workflow = await getWorkflowSteps(group);
      const currentStepObj = parseCurrentStep(callHistory.current_step);
      const currentStep = workflow.find(
        (s) => s.step_id === (currentStepObj?.step_id || 1),
      );

      if (!currentStep) {
        console.error('Current step not found in workflow:', currentStepObj?.step_id);
        twiml.say('Thank you for your time. Goodbye.');
        twiml.hangup();
        console.log('TwiML for missing step:', twiml.toString());
        return res.type('text/xml').send(twiml.toString());
      }

      console.log('Current step:', currentStep);
      const { nextStep, shouldEnd } = await generateNextStep(
        currentStep,
        userResponse,
        workflow,
      );
      console.log('Next step result:', { nextStep, shouldEnd });

      if (shouldEnd || !nextStep) {
        const endMessage = 'Thank you for your time. Have a great day!';
        // const endMessageMalayalam = 'നിങ്ങളുടെ സമയത്തിന് നന്ദി. നല്ല ദിവസം!';
        try {
          const audioPath = await generateSpeech(endMessage);
          const audioUrl = await getOrCreateAudioUrl(endMessage, audioPath);
          console.log('Playing end message:', audioUrl);
          twiml.play(audioUrl);
        } catch (error) {
          console.error('TTS failed for end message:', error);
          twiml.say({ voice: 'alice', language: 'en-IN' }, endMessage);
        }
        twiml.hangup();
        console.log('Ending call with TwiML:', twiml.toString());

        await prisma.call_history.update({
          where: { id: callHistory.id },
          data: {
            status: CallStatusEnum.ACCEPTED,
            ended_at: new Date(),
            updated_at: new Date(),
          },
        });
      } else {
        await prisma.call_history.update({
          where: { id: callHistory.id },
          data: {
            current_step: JSON.stringify({
              workflow_id: group?.workflows?.id || null,
              step_id: nextStep.step_id,
            }),
            updated_at: new Date(),
          },
        });

        const questionText = nextStep.malayalam || nextStep.question;
        try {
          const audioPath = await generateSpeech(questionText);
          const audioUrl = await getOrCreateAudioUrl(questionText, audioPath);
          console.log('Playing next question:', audioUrl);
          twiml.play(audioUrl);
        } catch (error) {
          console.error('TTS failed:', error);
          twiml.say({ voice: 'alice', language: 'en-IN' }, nextStep.question);
        }

        twiml.record({
          action: `${NGROK_BASE_URL}/voice-update/response?sessionId=${sessionId}&contactId=${contactId}`,
          method: 'POST',
          maxLength: 30,
          playBeep: true,
          timeout: 2,
          transcribe: false,
          recordingStatusCallback: `${NGROK_BASE_URL}/recording-status?sessionId=${sessionId}&contactId=${contactId}`,
          recordingStatusCallbackMethod: 'POST',
        });
      }

      console.log('Final TwiML Response:', twiml.toString());
      res.type('text/xml').send(twiml.toString());
    } else if (dialogflowResult.intent === undefined) {
      // === New: Document-based Q&A ===
      // 1. Query Pinecone for relevant context
      const context = await queryPineconeWithCache(userResponse, 3);
      // 2. Generate answer in Malayalam with OpenAI
      const answer = await generateMalayalamAnswer(userResponse, context);
      // 3. Fallback if no answer
      const finalAnswer =
        answer && answer.trim() !== ''
          ? answer
          : 'ക്ഷമിക്കണം, അതിനുള്ള വിവരം എനിക്ക് ലഭ്യമല്ല.';
      // 4. Generate TTS with ElevenLabs
      const audioPath = await generateSpeech(finalAnswer);
      const audioUrl = await getOrCreateAudioUrl(finalAnswer, audioPath);
      // 5. Return to workflow by appending the next workflow step/question
      const group = session.group_id
        ? await prisma.groups.findUnique({
          where: { id: session.group_id },
          include: { workflows: true },
        })
        : null;
      const workflow = await getWorkflowSteps(group);
      const currentStepObj = parseCurrentStep(callHistory.current_step);
      const currentStep = workflow.find(
        (s) => s.step_id === (currentStepObj?.step_id || 1),
      );
      const nextPrompt = currentStep?.malayalam || currentStep?.question || '';
      const combinedText = `${finalAnswer} ${nextPrompt}`;
      // Play the answer and next workflow prompt
      twiml.play(audioUrl);
      // ... existing code for recording next response ...
      twiml.record({
        action: `${NGROK_BASE_URL}/voice-update/response?sessionId=${sessionId}&contactId=${contactId}`,
        method: 'POST',
        maxLength: 30,
        playBeep: true,
        timeout: 2,
        transcribe: false,
        recordingStatusCallback: `${NGROK_BASE_URL}/recording-status?sessionId=${sessionId}&contactId=${contactId}`,
        recordingStatusCallbackMethod: 'POST',
      });
      // Save to call history
      await prisma.call_history.update({
        where: { id: callHistory.id },
        data: { transcription: userResponse, updated_at: new Date() },
      });
      return res.type('text/xml').send(twiml.toString());
    } else {
      // Unknown intent fallback
      const fallback = 'sorry i didnt understand ';
      const audioPath = await generateSpeech(fallback);
      const audioUrl = await getOrCreateAudioUrl(fallback, audioPath);
      twiml.play(audioUrl);
      twiml.hangup();
      return res.type('text/xml').send(twiml.toString());
    }
  } catch (error) {
    console.error('Error in voice response handler:', error);
    twiml.say('Sorry, there was a technical error. Please try again later. Goodbye.');
    twiml.hangup();
    console.log('Error TwiML Response:', twiml.toString());
    res.type('text/xml').send(twiml.toString());
  }
});

async function handleNoResponse(
  req: Request,
  res: Response,
  session,
  callHistory,
  twiml,
) {
  console.log('Handling no response case');

  const group = session.group_id
    ? await prisma.groups.findUnique({
      where: { id: session.group_id },
      include: { workflows: true },
    })
    : null;

  const workflow = await getWorkflowSteps(group);
  const currentStepObj = parseCurrentStep(callHistory.current_step);
  const currentStep = workflow.find((s) => s.step_id === (currentStepObj?.step_id || 1));

  if (currentStep) {
    // Check if the current step is terminal
    if (currentStep.yes_next === null && currentStep.no_next === null) {
      twiml.say('Thank you for your time. Goodbye.');
      twiml.hangup();
      await prisma.call_history.update({
        where: { id: callHistory.id },
        data: {
          status: CallStatusEnum.ACCEPTED,
          ended_at: new Date(),
          updated_at: new Date(),
        },
      });
    } else {
      twiml.say("I didn't hear your response. Let me repeat the question.");
      try {
        const responseText = currentStep.malayalam || currentStep.question;
        const audioPath = await generateSpeech(responseText);
        const audioUrl = await getOrCreateAudioUrl(responseText, audioPath);
        twiml.play(audioUrl);
      } catch (error) {
        console.error('TTS failed in handleNoResponse:', error);
        twiml.say({ voice: 'alice', language: 'en-IN' }, currentStep.question);
      }

      const { sessionId, contactId } = req.query; // Fix: Use req.query instead of req.app.get('io')
      twiml.record({
        action: `${NGROK_BASE_URL}/voice-update/response?sessionId=${sessionId}&contactId=${contactId}`,
        method: 'POST',
        maxLength: 30,
        playBeep: true,
        timeout: 2,
        transcribe: false,
        recordingStatusCallback: `${NGROK_BASE_URL}/recording-status?sessionId=${sessionId}&contactId=${contactId}`,
        recordingStatusCallbackMethod: 'POST',
      });
    }
  } else {
    twiml.say('Sorry, there was an error. Goodbye.');
    twiml.hangup();
  }

  return res.type('text/xml').send(twiml.toString());
}
export { voiceHandler, voiceResponseHandler };

// TODO: Add your Dialogflow and OpenAI API keys to your environment variables (.env)
// TODO: Ensure Dialogflow agent has workflow and document intents set up
// TODO: Ensure Pinecone is populated with document vectors
