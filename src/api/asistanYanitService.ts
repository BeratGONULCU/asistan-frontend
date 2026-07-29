import axios from "axios";
import { apiClient } from "./apiClient";

// bu dosya python içerisinden gelen asistan yanıtlarını göstermek için kullanılacak.
// yani değiştirilecek 

export type CreateAsistanYanitRequest = {
  AsistanYanit: string
  YanitTuru: string
  KomutId: number | null
}

export type AsistanYanitResponse = {
  id?: number
  asistanYanit?: string
  yanitTuru?: string
  createdAt?: string
  updatedAt?: string
  komutId?: number | null
}

export const createPendingAsistanYanit = async (
  asistanYanit: string,
  komutId: number | null = null
) => {
  const payload: CreateAsistanYanitRequest = {
    AsistanYanit: asistanYanit,
    YanitTuru: 'PENDING',
    KomutId: komutId,
  }

  const response = await apiClient.post<AsistanYanitResponse>(
    'http://localhost:5131/Api/AsistanYanit/send-asistan-yanit',
    payload
  )

  return response.data
}

export const deleteAsistanSession = async (sessionId: number) => {
  const response = await apiClient.post<boolean>(
    "/AsistanYanit/delete-by-sessionID",
    { sessionID: sessionId },
  )

  if (response.data !== true) {
    throw new Error("Backend sohbetin silindiğini doğrulamadı.")
  }

  return response.data
}

export const archiveAsistanSession = async (sessionId: number) => {
  try {
    const response = await apiClient.patch(
      `/AsistanYanit/archive-session/${sessionId}`,
    );

    return response.data;
  } catch (error) {
    throw new Error(getBackendErrorMessage(error, "Sohbet arşivlenemedi."), {
      cause: error,
    });
  }
}

export const unarchiveAsistanSession = async (sessionId: number) => {
  try {
    const response = await apiClient.patch(
      `/AsistanYanit/unarchive-session/${sessionId}`,
    );

    return response.data;
  } catch (error) {
    throw new Error(
      getBackendErrorMessage(error, "Sohbet arşivden kaldırılamadı."),
      { cause: error },
    );
  }
}

const getBackendErrorMessage = (error: unknown, fallback: string) => {
  if (!axios.isAxiosError(error)) return fallback;

  const data = error.response?.data;
  if (typeof data === "string" && data.trim()) return data;
  if (data && typeof data === "object") {
    const response = data as {
      message?: unknown;
      detail?: unknown;
      title?: unknown;
    };
    const message = response.message ?? response.detail ?? response.title;
    if (typeof message === "string" && message.trim()) return message;
  }

  return fallback;
};
