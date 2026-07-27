import { useEffect, useRef, useState } from "react";
import { apiClient } from "./api/apiClient";
import "./App.css";
import { createPendingAsistanYanit } from "./api/asistanYanitService";
//import { createAsistanSession } from "./api/asistanSessionCreateService";
import AsistanSessionsScreen from "./screens/AsistanSessionsScreen";
import { sendAsistanChatMessage } from "./api/asistanChatService";
import { cancelSession } from "./api/asistanCancelService";
import { checkSession } from "./api/asistanCheckService";
import { AsistanYanitTuru } from "./api/asistanChatService";
import { handleApiError } from "./api/apiErrorHandler";
import SettingsScreen, { type AppSettings } from "./screens/SettingsScreen";
import {
  checkPythonInputStatus,
  GetAllAssistanSetting,
  type AsistanSettingsResponse,
} from "./api/systemSettingsService";

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: { transcript: string };
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionErrorEventLike = {
  error: string;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

const DEFAULT_SETTINGS: AppSettings = {
  redmineToken: "",
  wakeWord: "asistan",
  deadWord: "kapat",
  activeProvider: "gemini",
  geminiApiKey: "",
  geminiModel: "gemini-2.5-flash",
  openAiApiKey: "",
  openAiModel: "gpt-4o-mini",
  ollamaModel: "llama3.1:8b",
  voiceInputEnabled: false,
};

const loadSettings = (): AppSettings => {
  try {
    const saved = JSON.parse(localStorage.getItem("asistan-settings") ?? "{}") as Partial<AppSettings> & { activeProvider?: string };
    return {
      ...DEFAULT_SETTINGS,
      ...saved,
      activeProvider: saved.activeProvider === "llama" ? "llama" : (saved.activeProvider ?? DEFAULT_SETTINGS.activeProvider) as AppSettings["activeProvider"],
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
};

const mapDatabaseSettings = (
  saved: AsistanSettingsResponse,
): AppSettings => {
  const provider = saved.activeProvider?.toLowerCase();

  return {
    ...DEFAULT_SETTINGS,
    redmineToken: saved.redmineToken ?? "",
    wakeWord: saved.wakeWord ?? DEFAULT_SETTINGS.wakeWord,
    deadWord: saved.deadWord ?? DEFAULT_SETTINGS.deadWord,
    activeProvider:
      provider === "llama" || provider === "openai" || provider === "gemini"
        ? provider
        : DEFAULT_SETTINGS.activeProvider,
    geminiApiKey: saved.geminiApiKey ?? "",
    geminiModel: saved.geminiModel ?? DEFAULT_SETTINGS.geminiModel,
    openAiApiKey: saved.openAiApiKey ?? "",
    openAiModel: saved.openAiModel ?? DEFAULT_SETTINGS.openAiModel,
    ollamaModel: saved.ollamaModel ?? DEFAULT_SETTINGS.ollamaModel,
    voiceInputEnabled:
      saved.voiceInputEnabled ?? DEFAULT_SETTINGS.voiceInputEnabled,
    aiFallbackProvider: saved.aiFallbackProvider,
    createdAt: saved.createdAt,
    updatedAt: saved.updatedAt,
  };
};

type MessageRole = "user" | "assistant" | "system";

type ChatMessage = {
  id: number;
  role: MessageRole;
  text: string;
};

type TruncatedMessage = {
  text: string;
  isTruncated: boolean;
};

type PendingResult = {
  requestId: string;
  userInput: string;
  generatedAnswer: string;
};

function App() {
  const [keyboardMode, setKeyboardMode] = useState(false);
  const [message, setMessage] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const requestAbortControllerRef = useRef<AbortController | null>(null);
  const speechRecognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [pendingResult, setPendingResult] = useState<PendingResult | null>(
    null,
  );
  const [screen, setScreen] = useState<"home" | "sessions" | "settings">("home");
  const [previousScreen, setPreviousScreen] = useState<"home" | "sessions">("home");
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [pythonInputStatus, setPythonInputStatus] = useState<
    "checking" | "running" | "stopped"
  >("checking");
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [waitingExplanation, setWaitingExplanation] = useState(false);
  type WaitingFor = "TASK_ID" | "ACIKLAMA" | "SEARCH" | null;

  const [waitingFor, setWaitingFor] = useState<WaitingFor>(null);
  const [pendingRedmineAction, setPendingRedmineAction] = useState<
    string | null
  >(null);

  // error component

  type UiError = {
    title: string;
    message: string;
    status?: number;
  };

  const [uiError, setUiError] = useState<UiError | null>(null);

  useEffect(() => {
    localStorage.setItem("asistan-settings", JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    let isMounted = true;

    const refreshPythonInputStatus = async () => {
      try {
        const status = await checkPythonInputStatus();
        if (isMounted) {
          setPythonInputStatus(status.running ? "running" : "stopped");
        }
      } catch {
        if (isMounted) setPythonInputStatus("stopped");
      }
    };

    void refreshPythonInputStatus();
    const intervalId = window.setInterval(refreshPythonInputStatus, 5000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!settings.voiceInputEnabled) {
      speechRecognitionRef.current?.abort();
      speechRecognitionRef.current = null;
    }
  }, [settings.voiceInputEnabled]);

  useEffect(
    () => () => {
      speechRecognitionRef.current?.abort();
    },
    [],
  );

  useEffect(() => {
    let isMounted = true;

    const loadDatabaseSettings = async () => {
      try {
        const response = await GetAllAssistanSetting();
        const records = Array.isArray(response) ? response : [response];
        const saved = records.at(-1);

        if (isMounted && saved) {
          setSettings(mapDatabaseSettings(saved));
        }
      } catch (error) {
        console.error(
          "Veritabanındaki ayarlar yüklenemedi; yerel ayarlar kullanılacak.",
          error,
        );
      }
    };

    void loadDatabaseSettings();

    return () => {
      isMounted = false;
    };
  }, []);

  const openSettings = () => {
    if (screen !== "settings") setPreviousScreen(screen);
    setScreen("settings");
  };

  // # ID gerektirmeyen ve ek parametre gerektirmeyen işlemler listesi
  const WAITING_FOR = [
    "SEARCH",
    "SEARCH-ERROR",
    "WEEKLYREPORT",
    "QUALITY",
    "SPENT",
    "MOST",
    "WEEKLYHOURS",
  ] as const;

  // Elemanların kendisini TypeScript tipi yapmak için:
  type RedmineActionKey = (typeof WAITING_FOR)[number];

  function HomeScreen({ onOpenSessions }: { onOpenSessions: () => void }) {
    return (
      <nav className="assistant-nav" aria-label="Ana menü">
        <button className="assistant-nav-button" onClick={onOpenSessions}>
          <span aria-hidden="true">☰</span>
          Sohbetler
        </button>
      </nav>
    );
  }

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 1,
      role: "assistant",
      text: "Merhaba, bir komut yazabilir veya mikrofon ile sesli komut verebilirsin.",
    },
  ]);
  const [expandedMessage, setExpandedMessage] = useState<ChatMessage | null>(
    null,
  );
  const shouldLimitMessageList = messages.length > 8;
  const messageListStyle = shouldLimitMessageList
    ? {
        maxHeight: "min(60vh, 620px)",
        overflowY: "auto" as const,
      }
    : undefined;

  // bu kısım smoothscroll olduğunda nereye gideceğini göstermek için
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const chatMessagesRef = useRef<HTMLDivElement | null>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);

  const addMessage = (role: MessageRole, text: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        role,
        text,
      },
    ]);
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ 
      behavior: "smooth",
      block: "center",
    });
  }, [messages.length]);

  const handleChatScroll = () => {
    const element = chatMessagesRef.current;
    if (!element) return;
    setShowScrollDown(
      element.scrollHeight - element.scrollTop - element.clientHeight > 80,
    );
  };

  const scrollToLatestMessage = () => {
    chatMessagesRef.current?.scrollTo({
      top: chatMessagesRef.current.scrollHeight,
      behavior: "smooth",
    });
  };


  const getPreviewText = (value: string): TruncatedMessage => {
    const trimmed = value.trim();

    if (trimmed.length <= 300) {
      return { text: value, isTruncated: false };
    }

    const previewLength = Math.max(1, Math.ceil(trimmed.length * 0.1));

    return {
      text: `${trimmed.slice(0, previewLength).trimEnd()}...`,
      isTruncated: true,
    };
  };

  const isJsonMessage = (value: string) => {
    try {
      const parsed = JSON.parse(value);
      return parsed !== null && typeof parsed === "object";
    } catch {
      return false;
    }
  };

  const handleMicClick = () => {
    if (!settings.voiceInputEnabled) return;

    if (isListening) {
      speechRecognitionRef.current?.stop();
      return;
    }

    const recognitionWindow = window as SpeechRecognitionWindow;
    const Recognition =
      recognitionWindow.SpeechRecognition ??
      recognitionWindow.webkitSpeechRecognition;

    if (!Recognition) {
      setUiError({
        title: "Sesli giriş desteklenmiyor",
        message:
          "Bu tarayıcı konuşmayı metne dönüştürme özelliğini desteklemiyor. Chrome veya Edge ile tekrar deneyin.",
      });
      return;
    }

    const recognition = new Recognition();
    recognition.lang = "tr-TR";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let transcript = "";
      let hasFinalResult = false;

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        transcript += event.results[index][0]?.transcript ?? "";
        hasFinalResult ||= event.results[index].isFinal;
      }

      const normalizedTranscript = transcript.trim();
      if (normalizedTranscript) setMessage(normalizedTranscript);
      if (hasFinalResult && normalizedTranscript) setKeyboardMode(true);
    };
    recognition.onerror = (event) => {
      setIsListening(false);
      speechRecognitionRef.current = null;

      if (event.error === "aborted") return;

      setUiError({
        title: "Mikrofon kullanılamadı",
        message:
          event.error === "not-allowed"
            ? "Mikrofon izni verilmedi. Tarayıcı site izinlerinden mikrofon erişimini açın."
            : "Ses algılanamadı. Mikrofon bağlantısını kontrol edip tekrar deneyin.",
      });
    };
    recognition.onend = () => {
      setIsListening(false);
      speechRecognitionRef.current = null;
    };

    setKeyboardMode(false);
    setUiError(null);
    speechRecognitionRef.current = recognition;

    try {
      recognition.start();
      setIsListening(true);
    } catch {
      speechRecognitionRef.current = null;
      setIsListening(false);
      setUiError({
        title: "Mikrofon başlatılamadı",
        message: "Mikrofon zaten kullanımda olabilir. Birkaç saniye sonra tekrar deneyin.",
      });
    }

    // Sonradan burada ses dinleme veya backend'e ses gÃ¶nderme iÅŸlemi olacak.
  };

  // buraya bir kere basÄ±ldÄ±ktan sonra createcommandhandler Ã§alÄ±ÅŸacak ve sohbet kaydÄ± girilecek.
  // sonrasÄ±nda her komut iÃ§in sendCommandHandler iÃ§erisine gÃ¶ndermeli.
  const handleKeyboardClick = () => {
    speechRecognitionRef.current?.abort();
    speechRecognitionRef.current = null;
    setKeyboardMode(true);
    setIsListening(false);
  };

  const handleSend = async () => {
    const trimmedMessage = message.trim();

    if (!trimmedMessage || isProcessing) return;

    addMessage("user", trimmedMessage);
    setMessage("");
    setIsProcessing(true);

    try {
      const result = await createPendingAsistanYanit(trimmedMessage);

      console.log("Backend kaydet sonucu:", result);

      addMessage(
        "assistant",
        "Mesaj PENDING olarak kaydedildi. Python agent bu kaydÄ± iÅŸleyebilir.",
      );

      setKeyboardMode(false);
    } catch (error: any) {
      console.error("Backend hata detayÄ±:", error);

      if (error.response) {
        console.error("Status:", error.response.status);
        console.error("Data:", error.response.data);

        addMessage(
          "system",
          `Backend hata verdi. Status: ${error.response.status}`,
        );
      } else if (error.request) {
        addMessage(
          "system",
          "Backend cevap vermedi. Backend Ã§alÄ±ÅŸÄ±yor mu veya port doÄŸru mu kontrol et.",
        );
      } else {
        addMessage("system", "Ä°stek oluÅŸturulurken hata oluÅŸtu.");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelSession = async () => {
    try {
      setUiError(null);

      const result = await cancelSession();

      setCurrentSessionId(null);
      setWaitingFor(null);
      setPendingRedmineAction(null);
      setKeyboardMode(false);

      addMessage("system", result.message);
    } catch (error: unknown) {
      const handledError = handleApiError(error);

      setUiError(handledError);
      addMessage("system", `${handledError.title}: ${handledError.message}`);
    }
  };

  const handleCheckSession = async () => {
    try {
      const isSessionActive = await checkSession();
      if (!isSessionActive) {
        return false;
      } else {
        return true;
      }
    } catch (error: any) {
      console.error("Session check error:", error);
      addMessage("system", "Oturum kontrol edilirken hata oluÅŸtu.");
      return false;
    }
  };

  // burada mesaj atmadan Ã¶nce handleCheckSession ile kontrol edecek.
  const handleSessionSend = async () => {
    const trimmedMessage = message.trim();

    if (!trimmedMessage || isProcessing) return;

    addMessage("user", trimmedMessage);
    setMessage("");
    setIsProcessing(true);
    const requestController = new AbortController();
    requestAbortControllerRef.current = requestController;

    try {
      const yanitTuruToSend =
        waitingFor === "TASK_ID" ||
        waitingFor === "ACIKLAMA" ||
        waitingFor === "SEARCH"
          ? AsistanYanitTuru.ACIKLAMA
          : AsistanYanitTuru.KOMUT;

      // Ä°lk mesajda currentSessionId null gider.
      // Backend session oluÅŸturup yeni ID dÃ¶ndÃ¼rÃ¼r.
      const result = await sendAsistanChatMessage(
        trimmedMessage,
        yanitTuruToSend,
        currentSessionId,
        requestController.signal,
      );

      console.log("Asistan chat sonucu:", result);

      if (!result.ok) {
        addMessage(
          "system",
          result.message || "Komut işlenirken hata oluştu.",
        );
        return;
      }

      // Ä°lk mesajda backend'den gelen ID burada saklanÄ±r.
      // Sonraki mesajlar aynÄ± ID ile gÃ¶nderilir.
      setCurrentSessionId(result.sessionId);

      /*
      const asistanText =
        typeof result.assistantResponse === "string"
          ? result.assistantResponse
          : formatAssistantResponse(result.assistantResponse);

      
      const asistanText =
        typeof result.assistantResponse === "string"
          ? result.assistantResponse
          : JSON.stringify(result.assistantResponse, null, 2);
      */

      const asistanText =
        formatAssistantResponse(result.assistantResponse) ||
        formatAssistantResponse(result.message) ||
        (await loadLatestAssistantTextForSession(
          result.sessionId,
          requestController.signal,
        ));

      addMessage("assistant", asistanText || "Asistan boş cevap döndürdü.");
      
      // burada ok , usertext kısımları gösteriliyor. 
      // addMessage("assistant", JSON.stringify(result, null, 2));

      console.log("RAW RESULT:", result);
      console.log("ASSISTANT RESPONSE:", result.assistantResponse);

      if (result.requiresInput) {
        setWaitingFor(result.waitingFor ?? null);
        setPendingRedmineAction(result.calisacakKod ?? null);
      } else {
        setWaitingFor(null);
        setPendingRedmineAction(null);
      }

      setKeyboardMode(true);
    } catch (error: unknown) {
      if (requestController.signal.aborted) {
        addMessage("system", "İstek iptal edildi.");
        return;
      }

      console.error("Asistan chat hatası:", error);

      const handledError = handleApiError(error);

      setUiError(handledError);

      addMessage("system", `${handledError.title}: ${handledError.message}`);
    } finally {
      if (requestAbortControllerRef.current === requestController) {
        requestAbortControllerRef.current = null;
        setIsProcessing(false);
      }
    }
  };

  const handleCancelRequest = () => {
    requestAbortControllerRef.current?.abort();
  };

  const handleNewChat = () => {
    requestAbortControllerRef.current?.abort();
    requestAbortControllerRef.current = null;
    setCurrentSessionId(null);
    setMessages([
      {
        id: 1,
        role: "assistant",
        text: "Yeni sohbet başlatıldı. Bir komut yazabilir veya mikrofon ile sesli komut verebilirsin.",
      },
    ]);
    setMessage("");
    setPendingResult(null);
    setWaitingFor(null);
    setPendingRedmineAction(null);
    setKeyboardMode(false);
    setIsProcessing(false);
  };

  const formatAssistantResponse = (response: unknown) => {
    if (typeof response === "string") {
      return response;
    }

    if (response === null || response === undefined) {
      return "";
    }

    if (Array.isArray(response)) {
      return response
        .map((item: any) =>
          [`id: ${item.id ?? ""}`, `subject: ${item.subject ?? ""}`].join(
            " | ",
          ),
        )
        .join("\n\n");
    }

    if (typeof response === "object") {
      const obj = response as Record<string, any>;

      if (Array.isArray(obj.issueSummary) && obj.issueSummary.length > 0) {
        return obj.issueSummary
          .map((item: any) =>
            [`id: ${item.id ?? ""}`, `subject: ${item.subject ?? ""}`].join(
              " | ",
            ),
          )
          .join("\n\n");
      }

      if (obj.assistantResponse) {
        return formatAssistantResponse(obj.assistantResponse);
      }

      if (obj.rawResponse) {
        return formatAssistantResponse(obj.rawResponse);
      }

      if (obj.response) {
        return formatAssistantResponse(obj.response);
      }

      return JSON.stringify(response, null, 2);
    }

    return String(response);
  };

  const loadLatestAssistantTextForSession = async (
    sessionId: number,
    signal?: AbortSignal,
  ) => {
    const response = await fetch(
      "http://localhost:5131/Api/AsistanYanit/Get-All",
      { signal },
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();
    const items = Array.isArray(result) ? result : (result?.data ?? result ?? []);
    const sessionItems = items.filter(
      (item: any) => String(item.sessionID ?? item.SessionID ?? "") === String(sessionId),
    );

    const latestAssistantItem = sessionItems
      .slice()
      .reverse()
      .find((item: any) => String(item.yanitTuru ?? item.YanitTuru ?? "").toUpperCase() !== "KOMUT");

    if (!latestAssistantItem) {
      return "";
    }

    const candidate =
      latestAssistantItem.asistanYanit ??
      latestAssistantItem.AsistanYanit ??
      latestAssistantItem.message ??
      latestAssistantItem.Message ??
      "";

    return formatAssistantResponse(candidate);
  };

  const handleConfirmYes = async () => {
    if (!pendingResult) return;
    // Burada backend'e kaydey isteği atılacak.
    // Örnek:
    // await apiClient.post('/assistant/confirm', {
    //   userInput: pendingResult.userInput,
    //   generatedAnswer: pendingResult.generatedAnswer,
    //   isCorrect: true
    // })
    try {
      // http://localhost:5131/Api/AsistanYanit/create-asistan-yanit
      await apiClient.post(
        `/assistant/text-command/${pendingResult.requestId}/confirm`,
        {
          isCorrect: true,
        },
      );

      addMessage("system", "Cevap doğru olarak işaretlendi ve kayıt edildi.");
      setPendingResult(null);
      setKeyboardMode(false);
    } catch (error) {
      console.error(error);
      addMessage("system", "Doğrulama kaydedilirken hata oluştu.");
    }
  };

  const handleConfirmNo = async () => {
    if (!pendingResult) return;
    // Burada istersen backend'e yanlÄ±ÅŸ cevap logu atabilirsin.
    // Ã–rnek:
    // await apiClient.post('/assistant/confirm', {
    //   userInput: pendingResult.userInput,
    //   generatedAnswer: pendingResult.generatedAnswer,
    //   isCorrect: false
    // })
    try {
      await apiClient.post(
        `/assistant/text-command/${pendingResult.requestId}/confirm`,
        {
          isCorrect: false,
        },
      );

      addMessage("system", "Cevap yanlış olarak işaretlendi.");
      addMessage("assistant", "Lütfen komutu daha Açık şekilde tekrar yaz.");

      setPendingResult(null);
      setKeyboardMode(true);
    } catch (error) {
      console.error(error);
      addMessage("system", "Doğrulama kaydedilirken hata oluştu.");
    }
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      //handleSend();
      handleSessionSend();
    }

    if (event.key === "Escape") {
      setKeyboardMode(false);
      setMessage("");
    }
  };

  return (
    <main className="assistant-page">
      <div
        className={`python-service-status ${pythonInputStatus}`}
        role="status"
        title="127.0.0.1:8766 Python giriş servisi"
      >
        <i aria-hidden="true"></i>
        <span>
          {pythonInputStatus === "checking"
            ? "Python kontrol ediliyor"
            : pythonInputStatus === "running"
              ? "Python çalışıyor"
              : "Python çalışmıyor"}
        </span>
      </div>
      <button
        type="button"
        className={`global-settings-button ${screen === "settings" ? "active" : ""}`}
        onClick={openSettings}
        aria-label="Ayarları aç"
        title="Ayarlar"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 8.95 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.58 15 1.7 1.7 0 0 0 3 14H3v-4h.08A1.7 1.7 0 0 0 4.6 8.95a1.7 1.7 0 0 0-.34-1.88L4.2 7l2.83-2.83.06.06a1.7 1.7 0 0 0 1.88.34A1.7 1.7 0 0 0 10 3.02V3h4v.08a1.7 1.7 0 0 0 1.05 1.52 1.7 1.7 0 0 0 1.88-.34l.06-.06L19.82 7l-.06.06a1.7 1.7 0 0 0-.34 1.88A1.7 1.7 0 0 0 21 10h.02v4h-.08A1.7 1.7 0 0 0 19.4 15Z" />
        </svg>
      </button>
      {screen === "home" && (
        <div>
          <HomeScreen onOpenSessions={() => setScreen("sessions")} />
        </div>
      )}
      {screen === "sessions" && (
        <AsistanSessionsScreen onHome={() => setScreen("home")} />
      )}
      {screen === "settings" && (
        <SettingsScreen
          settings={settings}
          onChange={setSettings}
          onBack={() => setScreen(previousScreen)}
          onReset={() => setSettings(DEFAULT_SETTINGS)}
        />
      )}

      {screen === "home" && (
        <>
      <section className="assistant-header">
        <div className="assistant-orb">
          <div
            className={isListening ? "orb-ring listening" : "orb-ring"}
          ></div>
          <div className="orb-core"></div>
        </div>

        <div className="assistant-header-content">
          <span className="assistant-kicker">Dijital çalışma asistanı</span>
          <h1>Şirket içi Sesli Asistan</h1>
          <p>
            Komut gir, sistem analiz etsin, sonucu doğrula ve kaydet.
          </p>

          <div className="assistant-header-meta">
            <span className={`assistant-status ${isProcessing ? "busy" : ""}`}>
              <i aria-hidden="true"></i>
              {isProcessing ? "Yanıt hazırlanıyor" : "Hazır"}
            </span>
            {currentSessionId && (
              <span className="assistant-session-id">
                Oturum #{currentSessionId}
              </span>
            )}
            <button
              type="button"
              className="new-chat-button"
              onClick={handleNewChat}
            >
              <span aria-hidden="true">＋</span>
              Yeni sohbet
            </button>
          </div>
        </div>
      </section>

      <section className="chat-panel">
        <div className="chat-panel-header">
          <div>
            <strong>Sohbet</strong>
            <span>{messages.length} mesaj</span>
          </div>
          <span className="chat-panel-hint">Mesaj detayları için “Devamını gör”ü kullan</span>
        </div>
        {uiError && (
          <div className="error-alert" role="alert">
            <div className="error-alert-content">
              <strong>{uiError.title}</strong>
              <span>{uiError.message}</span>
            </div>

            <button
              type="button"
              className="error-alert-close"
              onClick={() => setUiError(null)}
              aria-label="Hata mesajını kapat"
            >
              Ã—
            </button>
          </div>
        )}

        <div
          ref={chatMessagesRef}
          className="chat-messages"
          style={messageListStyle}
          onScroll={handleChatScroll}
        >
          {messages.map((item) => (
            <div key={item.id} className={`message-row ${item.role}`}>
              <div
                className="message-bubble"
                style={{ whiteSpace: "pre-wrap" }}
              >
                {(() => {
                  const containsJson = isJsonMessage(item.text);
                  const preview = getPreviewText(
                    containsJson ? "Yapılandırılmış sonuç hazır." : item.text,
                  );

                  return (
                    <>
                      <div className="message-text">{preview.text}</div>
                      {(preview.isTruncated || containsJson) && (
                        <button
                          type="button"
                          className="message-more-btn"
                          onClick={() => setExpandedMessage(item)}
                        >
                          {containsJson ? "Detayı gör" : "Devamını gör"}
                        </button>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          ))}

          {isProcessing && (
            <div className="message-row assistant">
              <div className="message-bubble typing-bubble">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          )}

          {pendingResult && (
            <div className="confirmation-card">
              <p>Üretilen Cevap Doğru mu?</p>

              <div className="confirmation-actions">
                <button
                  type="button"
                  className="confirm-yes"
                  onClick={handleConfirmYes}
                >
                  Evet, doğru
                </button>

                <button
                  type="button"
                  className="confirm-no"
                  onClick={handleConfirmNo}
                >
                  Hayır, tekrar dene
                </button>
              </div>
            </div>
          )}


        <div ref={chatEndRef}></div>
        </div>
        {showScrollDown && (
          <button
            type="button"
            className="chat-scroll-down"
            onClick={scrollToLatestMessage}
            aria-label="Son mesaja git"
            title="Son mesaja git"
          >
            ↓
          </button>
        )}
      </section>

      {expandedMessage && (
        <div
          className="message-modal-backdrop"
          onClick={() => setExpandedMessage(null)}
          role="presentation"
        >
          <div
            className="message-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="message-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="message-modal-header">
              <div>
                <p className="screen-label" id="message-modal-title">
                  Mesaj Detayı
                </p>
                <h3>{expandedMessage.role}</h3>
              </div>

              <button
                type="button"
                className="message-modal-close"
                onClick={() => setExpandedMessage(null)}
                aria-label="Modalı kapat"
              >
                ×
              </button>
            </div>

            <div className="message-modal-body">
              <pre>{expandedMessage.text}</pre>
            </div>
          </div>
        </div>
      )}

      <section className="bottom-control">
        {!keyboardMode ? (
          <div className="action-buttons">
            <button
              type="button"
              className={isListening ? "mic-button active" : "mic-button"}
              onClick={handleMicClick}
              disabled={!settings.voiceInputEnabled}
              aria-label={
                settings.voiceInputEnabled
                  ? "Mikrofonu başlat"
                  : "Sesli komut ayarlardan devre dışı bırakılmış"
              }
              title={
                settings.voiceInputEnabled
                  ? "Mikrofonu başlat"
                  : "Sesli komutu Ayarlar ekranından etkinleştirin"
              }
            >
              <svg
                viewBox="0 0 24 24"
                className="button-icon"
                aria-hidden="true"
              >
                <path d="M12 14c1.66 0 3-1.34 3-3V6c0-1.66-1.34-3-3-3S9 4.34 9 6v5c0 1.66 1.34 3 3 3Z" />
                <path d="M17.3 11c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.42 2.72 6.23 6.1 6.68V21h1.8v-3.32C16.28 17.23 19 14.42 19 11h-1.7Z" />
              </svg>
            </button>

            <button
              type="button"
              className="keyboard-button"
              onClick={handleKeyboardClick}
              aria-label="Klavye ile yaz"
            >
              <svg
                viewBox="0 0 24 24"
                className="button-icon"
                aria-hidden="true"
              >
                <path d="M4 6h16c1.1 0 2 .9 2 2v8c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V8c0-1.1.9-2 2-2Zm0 2v8h16V8H4Zm2 2h2v2H6v-2Zm3 0h2v2H9v-2Zm3 0h2v2h-2v-2Zm3 0h2v2h-2v-2Zm3 0h1v2h-1v-2ZM6 13h2v1H6v-1Zm3 0h6v1H9v-1Zm7 0h3v1h-3v-1Z" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="text-command-box">
            <input
              autoFocus
              type="text"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder={
                waitingFor === "TASK_ID"
                  ? "Task id yaz... örn: 29198"
                  : waitingFor === "ACIKLAMA"
                    ? "Göreve yazılacak açıklamayı yaz..."
                    : pendingResult
                      ? "Önce cevabı doğru/yanlış olarak işaretle"
                      : "Komut yaz... örn: 29198 nolu taskın açıklamasını değiştirmek istiyorum"
              }
              disabled={isProcessing || !!pendingResult}
            />

            <button
              type="button"
              className="send-button"
              onClick={handleSessionSend}
              disabled={!message.trim() || isProcessing || !!pendingResult}
            >
              Gönder
            </button>

            <div className="right-action-buttons">
              <button
                type="button"
                className="close-button"
                onClick={() => {
                  handleCancelRequest();
                  setKeyboardMode(false);
                  setMessage("");
                  void handleCancelSession(); // burada session iptali olacak ve sohbet kapatılacak. sphbet mesajı attığında eğer ki session kapalı ise açıcak.
                }}
                aria-label="Yazı modunu kapat"
              >
                ×
              </button>

              <button
                type="button"
                className="stop-button"
                onClick={handleCancelRequest}
                disabled={!isProcessing}
                aria-label="İsteği iptal et"
                title={isProcessing ? "İsteği iptal et" : "Aktif istek yok"}
              >
                <span className="stop-icon"></span>
              </button>
            </div>
          </div>
        )}
      </section>
        </>
      )}
    </main>
  );
}

export default App;
