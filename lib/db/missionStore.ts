import { nanoid } from 'nanoid';
import { getCollection } from './db';
import type {
  MissionDoc,
  MissionStatus,
  ConversationMessage,
  TestRequirement,
  MissionPlan,
} from '@/lib/config';
import type { Collection } from 'mongodb';

export function missions(): Promise<Collection<MissionDoc>> {
  return getCollection<MissionDoc>('missions');
}

export async function createMission(): Promise<MissionDoc> {
  const col = await missions();
  const doc: MissionDoc = {
    _id: nanoid(16),
    status: 'idle',
    conversation: [],
    requirements: null,
    plan: null,
    runId: null,
    results: null,
    reasoning: [],
    created_at: new Date(),
    updated_at: new Date(),
  };
  await col.insertOne(doc);
  return doc;
}

export async function getMission(id: string): Promise<MissionDoc | null> {
  const col = await missions();
  return col.findOne({ _id: id });
}

export async function listMissions(limit = 20): Promise<MissionDoc[]> {
  const col = await missions();
  return col.find().sort({ created_at: -1 }).limit(limit).toArray();
}

export async function updateMissionStatus(
  id: string,
  status: MissionStatus
): Promise<void> {
  const col = await missions();
  await col.updateOne({ _id: id }, { $set: { status, updated_at: new Date() } });
}

export async function addConversationMessage(
  id: string,
  message: ConversationMessage
): Promise<void> {
  const col = await missions();
  await col.updateOne(
    { _id: id },
    { $push: { conversation: message }, $set: { updated_at: new Date() } }
  );
}

export async function setRequirements(
  id: string,
  requirements: TestRequirement
): Promise<void> {
  const col = await missions();
  await col.updateOne(
    { _id: id },
    { $set: { requirements, updated_at: new Date() } }
  );
}

export async function setMissionPlan(
  id: string,
  plan: MissionPlan
): Promise<void> {
  const col = await missions();
  await col.updateOne(
    { _id: id },
    { $set: { plan, updated_at: new Date() } }
  );
}

export async function setMissionResults(
  id: string,
  results: MissionDoc['results']
): Promise<void> {
  const col = await missions();
  await col.updateOne(
    { _id: id },
    { $set: { results, status: 'completed', updated_at: new Date() } }
  );
}

export async function addReasoning(id: string, line: string): Promise<void> {
  const col = await missions();
  await col.updateOne(
    { _id: id },
    { $push: { reasoning: line }, $set: { updated_at: new Date() } }
  );
}

export async function setMissionRunId(
  id: string,
  runId: string
): Promise<void> {
  const col = await missions();
  await col.updateOne(
    { _id: id },
    { $set: { runId, updated_at: new Date() } }
  );
}

export async function deleteMission(id: string): Promise<void> {
  const col = await missions();
  await col.deleteOne({ _id: id });
}
