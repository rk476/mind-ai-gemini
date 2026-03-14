import { NextRequest, NextResponse } from 'next/server';
import {
  getMission,
  addConversationMessage,
  updateMissionStatus,
  setRequirements,
} from '@/lib/db/missionStore';
import { processConversation, getGreeting } from '@/lib/ai/requirementAgent';
import type { ConversationMessage } from '@/lib/config';

export async function POST(
  req: NextRequest,
  { params }: { params: { missionId: string } }
) {
  try {
    const mission = await getMission(params.missionId);
    if (!mission) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }

    const body = await req.json();
    const userMessage: string = body.message;

    // If this is the first interaction, get the AI greeting
    if (mission.conversation.length === 0 && !userMessage) {
      await updateMissionStatus(params.missionId, 'listening');
      const greeting = await getGreeting();

      const aiMsg: ConversationMessage = {
        role: 'ai',
        content: greeting.message,
        timestamp: new Date(),
        inputRequest: greeting.inputRequest ?? undefined,
      };
      await addConversationMessage(params.missionId, aiMsg);

      return NextResponse.json({
        message: greeting.message,
        inputRequest: greeting.inputRequest,
        complete: false,
      });
    }

    // Add user message to conversation
    if (userMessage) {
      const userMsg: ConversationMessage = {
        role: 'user',
        content: userMessage,
        timestamp: new Date(),
      };
      await addConversationMessage(params.missionId, userMsg);
    }

    // If requirements are passed directly (from /mission-live), save them
    if (body.requirements) {
      await setRequirements(params.missionId, body.requirements);
      await updateMissionStatus(params.missionId, 'planning');
      return NextResponse.json({
        message: 'Requirements saved',
        complete: true,
        requirements: body.requirements,
      });
    }

    // Get updated mission with new message
    const updatedMission = await getMission(params.missionId);
    if (!updatedMission) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }

    // Process conversation with AI
    const aiResponse = await processConversation(updatedMission.conversation);

    // Add AI response to conversation
    const aiMsg: ConversationMessage = {
      role: 'ai',
      content: aiResponse.message,
      timestamp: new Date(),
      inputRequest: aiResponse.inputRequest ?? undefined,
    };
    await addConversationMessage(params.missionId, aiMsg);

    // If requirements are complete, save them
    if (aiResponse.complete && aiResponse.requirements) {
      await setRequirements(params.missionId, aiResponse.requirements);
      await updateMissionStatus(params.missionId, 'planning');
    }

    return NextResponse.json({
      message: aiResponse.message,
      inputRequest: aiResponse.inputRequest,
      complete: aiResponse.complete,
      requirements: aiResponse.requirements,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Chat error';
    console.error('[Chat API]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
