import { DBSchema, IDBPDatabase, openDB } from "idb";

export interface QueuedAnswerMutation {
  snapshotId: string;
  selectedIds?: string[] | null;
  writtenText?: string | null;
  markedForReview: boolean;
  clientSeq: number;
  capturedAt: string;
}

interface PendingMutationRecord extends QueuedAnswerMutation {
  key: string;
  attemptId: string;
}

export interface ScratchpadRecord {
  attemptId: string;
  notes: string;
  drawingDataUrl: string | null;
  updatedAt: string;
}

interface WorkspaceDb extends DBSchema {
  pendingMutations: {
    key: string;
    value: PendingMutationRecord;
    indexes: { attemptId: string; clientSeq: number };
  };
  scratchpads: {
    key: string;
    value: ScratchpadRecord;
  };
}

let databasePromise: Promise<IDBPDatabase<WorkspaceDb>> | null = null;

function getDatabase(): Promise<IDBPDatabase<WorkspaceDb>> {
  if (!databasePromise) {
    databasePromise = openDB<WorkspaceDb>("aegis-exam-workspace", 1, {
      upgrade(database) {
        const pending = database.createObjectStore("pendingMutations", { keyPath: "key" });
        pending.createIndex("attemptId", "attemptId");
        pending.createIndex("clientSeq", "clientSeq");
        database.createObjectStore("scratchpads", { keyPath: "attemptId" });
      },
    });
  }
  return databasePromise;
}

export async function queueAnswerMutation(
  attemptId: string,
  mutation: QueuedAnswerMutation,
): Promise<void> {
  const database = await getDatabase();
  await database.put("pendingMutations", {
    ...mutation,
    attemptId,
    key: `${attemptId}:${mutation.snapshotId}`,
  });
}

export async function getQueuedMutations(attemptId: string): Promise<QueuedAnswerMutation[]> {
  const database = await getDatabase();
  const records = await database.getAllFromIndex("pendingMutations", "attemptId", attemptId);
  return records.sort((left, right) => left.clientSeq - right.clientSeq).map((record) => ({
    snapshotId: record.snapshotId,
    selectedIds: record.selectedIds,
    writtenText: record.writtenText,
    markedForReview: record.markedForReview,
    clientSeq: record.clientSeq,
    capturedAt: record.capturedAt,
  }));
}

export async function removeAcknowledgedMutations(
  attemptId: string,
  acknowledged: QueuedAnswerMutation[],
): Promise<void> {
  const database = await getDatabase();
  const transaction = database.transaction("pendingMutations", "readwrite");
  for (const mutation of acknowledged) {
    const key = `${attemptId}:${mutation.snapshotId}`;
    const current = await transaction.store.get(key);
    if (current && current.clientSeq <= mutation.clientSeq) {
      await transaction.store.delete(key);
    }
  }
  await transaction.done;
}

export async function loadScratchpad(attemptId: string): Promise<ScratchpadRecord | null> {
  const database = await getDatabase();
  return (await database.get("scratchpads", attemptId)) ?? null;
}

export async function saveScratchpad(
  attemptId: string,
  value: Pick<ScratchpadRecord, "notes" | "drawingDataUrl">,
): Promise<void> {
  const database = await getDatabase();
  await database.put("scratchpads", {
    attemptId,
    ...value,
    updatedAt: new Date().toISOString(),
  });
}

export async function clearAttemptLocalData(attemptId: string): Promise<void> {
  const database = await getDatabase();
  const transaction = database.transaction(["pendingMutations", "scratchpads"], "readwrite");
  const keys = await transaction.objectStore("pendingMutations").index("attemptId").getAllKeys(attemptId);
  await Promise.all(keys.map((key) => transaction.objectStore("pendingMutations").delete(key)));
  await transaction.objectStore("scratchpads").delete(attemptId);
  await transaction.done;
}
