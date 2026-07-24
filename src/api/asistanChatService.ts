import { apiClient } from "./apiClient";

export const AsistanYanitTuru = {
  YANIT: "YANIT",
  KOMUT: "KOMUT",
  CHAT: "CHAT",
  ACIKLAMA: "ACIKLAMA",
  DUZELTME: "DUZELTME",
  REDMINE: "REDMINE",
  PENDING: "PENDING",
  FEEDBACK: "FEEDBACK",
  HATA: "HATA",
} as const;

export type AsistanYanitTuru =
  (typeof AsistanYanitTuru)[keyof typeof AsistanYanitTuru];

export type AsistanChatRequest = {
  message: string;
  asistanYanitTuru: AsistanYanitTuru;
  sessionId: number | null;
};

export type AsistanChatResponse = {
  ok: boolean;
  sessionId: number;
  userText: string;
  assistantResponse: string;
  message: string;

  requiresInput?: boolean;
  waitingFor?: "TASK_ID" | "ACIKLAMA" | "SEARCH" | null;
  calisacakKod?: string | null;
  issueId?: number | null;
};

export const sendAsistanChatMessage = async (
  message: string,
  asistanYanitTuru: AsistanYanitTuru,
  sessionId: number | null,
  signal?: AbortSignal,
) => {
  const payload: AsistanChatRequest = {
    message,
    asistanYanitTuru,
    sessionId,
  };

  const response = await apiClient.post<AsistanChatResponse>(
    "/AsistanChat/send",
    payload,
    { signal },
  );

  return response.data;
};
