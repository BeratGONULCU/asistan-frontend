import { apiClient } from "./apiClient";
import { AsistanYanitTuru } from "./asistanChatService";

export type CreateAsistanSessionRequest = {
  asistanYanit: string;
  yanitTuru: AsistanYanitTuru;
  // yanitTuru: 2,
};

export type AsistanSessionResponse = {
  id?: number;
  asistanYanit?: string;
  yanitTuru?: AsistanYanitTuru;
  sessionID?: number;
  sessionId?: number;
  feedback?: string | null;
  createdAt?: string;
  updatedAt?: string;
  komutId?: number | null;
};

export const createAsistanSession = async (asistanYanit: string) => {
  const payload: CreateAsistanSessionRequest = {
    asistanYanit,
    yanitTuru: AsistanYanitTuru.KOMUT,
  };

  const response = await apiClient.post<AsistanSessionResponse>(
    "/AsistanYanit/create-sessionID",
    payload,
  );

  return response.data;
};