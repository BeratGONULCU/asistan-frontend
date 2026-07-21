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
  const [pendingResult, setPendingResult] = useState<PendingResult | null>(
    null,
  );
  const [screen, setScreen] = useState<"home" | "sessions">("home");
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

  // # ID gerektirmeyen ve ek parametre gerektirmeyen iÅŸlemler listesi
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
      <div>
        <button onClick={onOpenSessions}>Sohbetler</button>
      </div>
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

  const handleMicClick = () => {
    setKeyboardMode(false);
    setIsListening((prev) => !prev);

    // Sonradan burada ses dinleme veya backend'e ses gÃ¶nderme iÅŸlemi olacak.
  };

  // buraya bir kere basÄ±ldÄ±ktan sonra createcommandhandler Ã§alÄ±ÅŸacak ve sohbet kaydÄ± girilecek.
  // sonrasÄ±nda her komut iÃ§in sendCommandHandler iÃ§erisine gÃ¶ndermeli.
  const handleKeyboardClick = () => {
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
        (await loadLatestAssistantTextForSession(result.sessionId));

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
      console.error("Asistan chat hatası:", error);

      const handledError = handleApiError(error);

      setUiError(handledError);

      addMessage("system", `${handledError.title}: ${handledError.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleNewChat = () => {
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

  const loadLatestAssistantTextForSession = async (sessionId: number) => {
    const response = await fetch("http://localhost:5131/Api/AsistanYanit/Get-All");

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
      {screen === "home" && (
        <div>
          <HomeScreen onOpenSessions={() => setScreen("sessions")} />
        </div>
      )}
      {screen === "sessions" && (
        <AsistanSessionsScreen onHome={() => setScreen("home")} />
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

        <div>
          <h1>Şirket içi Sesli Asistan</h1>
          <p>
            Komut gir, sistem analiz etsin, sonucu doğrula ve kaydet.
            {currentSessionId ? ` Aktif Session ID: ${currentSessionId}` : ""}
          </p>

          <button type="button" className="home-btn" onClick={handleNewChat}>
            Yeni Sohbet
          </button>
        </div>
      </section>

      <section className="chat-panel">
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
                  const preview = getPreviewText(item.text);

                  return (
                    <>
                      <div className="message-text">{preview.text}</div>
                      {preview.isTruncated && (
                        <button
                          type="button"
                          className="message-more-btn"
                          onClick={() => setExpandedMessage(item)}
                        >
                          Devamını gör
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
              aria-label="Mikrofonu başlat"
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
                onClick={() => {
                  setIsProcessing(false);
                  //void handleCancelSession(); --> burada sadece o anki işlemi iptal ettirmek gerekiyor
                }}
                aria-label="Anlık durdur"
                title="Anlık durdur"
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
