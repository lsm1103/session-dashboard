import type { Message } from "./types";

export type SessionDetailRow =
  | {
      key: string;
      type: "date";
      dateLabel: string;
    }
  | {
      key: string;
      type: "message";
      message: Message;
    };

function getDateLabel(timestamp: Date): string {
  return new Date(timestamp).toLocaleDateString("zh-CN");
}

export function buildSessionDetailRows(messages: Message[]): SessionDetailRow[] {
  if (messages.length === 0) {
    return [];
  }

  const rows: SessionDetailRow[] = [];
  let currentDate = "";

  for (const message of messages) {
    const dateLabel = getDateLabel(message.timestamp);

    if (dateLabel !== currentDate) {
      currentDate = dateLabel;
      rows.push({
        key: `date:${dateLabel}`,
        type: "date",
        dateLabel,
      });
    }

    rows.push({
      key: `message:${message.id}`,
      type: "message",
      message,
    });
  }

  return rows;
}

export function findMessageRowIndex(rows: SessionDetailRow[], messageId: string): number {
  return rows.findIndex(row => row.type === "message" && row.message.id === messageId);
}
