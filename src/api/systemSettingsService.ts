import { apiClient } from "./apiClient";
import axios from "axios";

export type OllamaStatus = {
  available: boolean;
  serviceRunning: boolean;
  models: string[];
  message: string;
};

export type CreateAsistanSettingsRequest = {
  redmineToken: string;
  wakeWord: string;
  deadWord: string;
  activeProvider: string;
  geminiApiKey: string;
  geminiModel: string;
  openAiApiKey: string;
  openAiModel: string;
  ollamaModel: string;
  aiFallbackProvider: string;
};

export type UpdateAsistanSettingsRequest =
  CreateAsistanSettingsRequest & {
    id: number;
  };

export type AsistanSettingsResponse = {
  id?: number;
  Id?: number;
  redmineToken?: string;
  wakeWord?: string;
  deadWord?: string;
  activeProvider?: string;
  geminiApiKey?: string;
  geminiModel?: string;
  openAiApiKey?: string;
  openAiModel?: string;
  ollamaModel?: string;
  aiFallbackProvider?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

export const GetAllAssistanSetting = async () => {
  const response = await apiClient.get<
    AsistanSettingsResponse | AsistanSettingsResponse[]
  >(
    "http://localhost:5131/Api/AssistanSettings/Get-All",
  );

  return response.data;
};

export const CreateAsistanSetting = async (
  request: CreateAsistanSettingsRequest,
) => {
  const response = await apiClient.post<AsistanSettingsResponse>(
    "http://localhost:5131/Api/AssistanSettings/create",
    request,
  );

  return response.data;
};

export const UpdateAsistanSetting = async (
  request: UpdateAsistanSettingsRequest,
) => {
  const response = await apiClient.put<AsistanSettingsResponse>(
    "http://localhost:5131/Api/AssistanSettings/update",
    request,
  );

  return response.data;
};

export const checkOllamaStatus = async (): Promise<OllamaStatus> => {
  try {
    const response = await apiClient.get<string>("/System/check-ollama");

    return {
      available: true,
      serviceRunning: true,
      models: [],
      message: response.data
        ? `Ollama bulundu: ${response.data}`
        : "Ollama bilgisayarda bulundu.",
    };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      return {
        available: false,
        serviceRunning: false,
        models: [],
        message:
          typeof error.response.data === "string"
            ? error.response.data
            : "Ollama bilgisayarda bulunamadı.",
      };
    }

    throw error;
  }
};

type SaveFilePickerWindow = Window & {
  showSaveFilePicker?: (options: {
    suggestedName: string;
    types: Array<{ description: string; accept: Record<string, string[]> }>;
  }) => Promise<{
    createWritable: () => Promise<WritableStream>;
  }>;
};

export const downloadOllamaInstaller = async (): Promise<void> => {
  const downloadUrl = "http://localhost:5131/Api/System/download-ollama";
  const picker = (window as SaveFilePickerWindow).showSaveFilePicker;

  if (!picker) {
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = "OllamaSetup.exe";
    link.click();
    return;
  }

  const fileHandle = await picker({
    suggestedName: "OllamaSetup.exe",
    types: [
      {
        description: "Windows kurulum dosyası",
        accept: { "application/vnd.microsoft.portable-executable": [".exe"] },
      },
    ],
  });

  const response = await fetch(downloadUrl);
  if (!response.ok || !response.body) {
    throw new Error("Ollama kurulum dosyası indirilemedi.");
  }

  const writable = await fileHandle.createWritable();
  await response.body.pipeTo(writable);
};
