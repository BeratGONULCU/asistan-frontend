import { useEffect, useMemo, useRef, useState } from "react";

import {
  AsistanYanitTuru,
  sendAsistanChatMessage,
} from "../api/asistanChatService";

import "../style/AsistanSessionsScreen.css";

type AsistanYanit = {
  id: number;
  asistanYanit: string;
  yanitTuru: string;
  komutId: number | null;
  sessionID: string;
  createdAt?: string;
  tarihSaat?: string;
  jsonData?: unknown;
  JsonData?: unknown;
};

type SessionGroup = {
  sessionId: string;
  title: string;
  messages: AsistanYanit[];
};

type TruncatedMessage = {
  text: string;
  isTruncated: boolean;
};

type Props = {
  onHome: () => void;
};

export default function AsistanSessionsScreen({ onHome }: Props) {
  const [data, setData] = useState<AsistanYanit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null,
  );
  const [isNewChat, setIsNewChat] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [showAllSessions, setShowAllSessions] = useState(false);
  const [expandedMessage, setExpandedMessage] = useState<AsistanYanit | null>(
    null,
  );
  const [modalSearch, setModalSearch] = useState("");
  const [modalDateFrom, setModalDateFrom] = useState("");
  const [modalDateTo, setModalDateTo] = useState("");
  const [isCopied, setIsCopied] = useState(false);

  // bu kısım smoothscroll olduğunda nereye gideceğini göstermek için
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const chatPanelRef = useRef<HTMLDivElement | null>(null);
  const targetMessageRef = useRef<HTMLDivElement | null>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);

  const handleChatScroll = () => {
    const element = chatPanelRef.current;
    if (!element) return;
    setShowScrollDown(
      element.scrollHeight - element.scrollTop - element.clientHeight > 80,
    );
  };

  const scrollToLatestMessage = () => {
    chatPanelRef.current?.scrollTo({
      top: chatPanelRef.current.scrollHeight,
      behavior: "smooth",
    });
  };

  const loadSessions = async (preferredSessionId?: string | null) => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        "http://localhost:5131/Api/AsistanYanit/Get-All",
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      const items: AsistanYanit[] = Array.isArray(result)
        ? result
        : (result?.data ?? result ?? []);

      setData(items);

      if (preferredSessionId) {
        setSelectedSessionId(preferredSessionId);
      } else if (items.length > 0) {
        setSelectedSessionId(items[0].sessionID ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Veri alinamadi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSessions();
  }, []);

  const groupedSessions = useMemo<SessionGroup[]>(() => {
    const map = data.reduce(
      (acc, item) => {
        const key = String(item.sessionID ?? "unknown");

        if (!acc[key]) {
          acc[key] = {
            sessionId: key,
            title: item.asistanYanit,
            messages: [item],
          };
        } else {
          acc[key].messages.push(item);
        }

        return acc;
      },
      {} as Record<string, SessionGroup>,
    );

    return Object.values(map).sort((a, b) => {
      const aLast = a.messages[a.messages.length - 1];
      const bLast = b.messages[b.messages.length - 1];

      const aTime = aLast?.createdAt ?? "";
      const bTime = bLast?.createdAt ?? "";

      return bTime.localeCompare(aTime);
    });
  }, [data]);

  const selectedSession =
    groupedSessions.find((s) => s.sessionId === selectedSessionId) ?? null;
  const visibleSessions = showAllSessions
    ? groupedSessions
    : groupedSessions.slice(0, 5);
  const shouldLimitMessageList = (selectedSession?.messages.length ?? 0) > 8;
  const messageListStyle = shouldLimitMessageList
    ? {
        maxHeight: "min(60vh, 620px)",
        overflowY: "auto" as const,
      }
    : undefined;

  useEffect(() => {
    targetMessageRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });

    setTimeout(() => {
      window.scrollBy({top: -100, behavior:"smooth"})
    }, 300);
  }, [selectedSessionId]);

  const formatTime = (value?: string) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return new Intl.DateTimeFormat("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date);
  };

  const handleSelectSession = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setIsSidebarOpen(false);
    setMessage("");
    setSendError("");
    setShowAllSessions(false);
    setExpandedMessage(null);
  };

  const formatAssistantResponse = (value: unknown) => {
    if (typeof value === "string") {
      const trimmed = value.trim();

      if (!trimmed) return "";

      try {
        return JSON.stringify(JSON.parse(trimmed), null, 2);
      } catch {
        return value;
      }
    }

    if (value === null || value === undefined) {
      return "";
    }

    return JSON.stringify(value, null, 2);
  };

  const getMessageBody = (item: AsistanYanit) => {
    const text = formatAssistantResponse(item.asistanYanit);
    const rawJson = item.jsonData ?? item.JsonData ?? null;
    const jsonText =
      rawJson === null || rawJson === undefined
        ? ""
        : formatAssistantResponse(rawJson);

    const fullText = [text, jsonText].filter(Boolean).join("\n\n");

    return { text, jsonText, fullText, rawJson };
  };

  const parseJsonValue = (value: string) => {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  };

  const formatModalJson = (value: string) => {
    const parsed = parseJsonValue(value);

    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const obj = parsed as Record<string, unknown>;
    const idValue = obj.id;
    const projectValue = obj.project;
    const rest = { ...obj };

    delete rest.id;
    delete rest.project;

    const projectName =
      projectValue && typeof projectValue === "object"
        ? String((projectValue as Record<string, unknown>).name ?? "")
        : "";

    const issues = Array.isArray((obj as Record<string, unknown>).issues)
      ? ((obj as Record<string, unknown>).issues as Record<string, unknown>[])
      : [];
    const issueSummary = Array.isArray(
      (obj as Record<string, unknown>).issueSummary,
    )
      ? ((obj as Record<string, unknown>).issueSummary as Record<
          string,
          unknown
        >[])
      : [];

    return {
      id: idValue,
      projectName,
      items: [...issues, ...issueSummary],
      restJson: JSON.stringify(rest, null, 2),
    };
  };

  const getModalJsonSource = (item: AsistanYanit) => {
    const rawJson = item.jsonData ?? item.JsonData ?? null;

    if (rawJson !== null && rawJson !== undefined) {
      return formatAssistantResponse(rawJson);
    }

    const parsedText = parseJsonValue(item.asistanYanit);
    if (parsedText) {
      return JSON.stringify(parsedText, null, 2);
    }

    return "";
  };

  const handleCopyModalContent = async () => {
    if (!expandedMessage) return;

    const content =
      getModalJsonSource(expandedMessage) || getMessageBody(expandedMessage).fullText;

    await navigator.clipboard.writeText(content);
    setIsCopied(true);
    window.setTimeout(() => setIsCopied(false), 1500);
  };

  const formatModalItemText = (item: Record<string, unknown>) => {
    const id = item.id ?? item.issue_id ?? item.issueId ?? "";
    const subject = item.subject ?? item.title ?? "";
    const projectName =
      item.project_name ??
      (item.project && typeof item.project === "object"
        ? ((item.project as Record<string, unknown>).name ?? "")
        : "");
    const statusName =
      item.status_name ??
      (item.status && typeof item.status === "object"
        ? ((item.status as Record<string, unknown>).name ?? "")
        : "");

    return [
      id ? `#${String(id)}` : "",
      String(subject),
      projectName ? `[${String(projectName)}]` : "",
      statusName ? `(${String(statusName)})` : "",
    ]
      .filter(Boolean)
      .join(" ");
  };

  const getDateValue = (item: Record<string, unknown>) => {
    const candidates = [
      item.created_on,
      item.updated_on,
      item.createdAt,
      item.updatedAt,
      item.start_date,
      item.due_date,
      item.tarihSaat,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim()) {
        const date = new Date(candidate);
        if (!Number.isNaN(date.getTime())) {
          return date;
        }
      }
    }

    return null;
  };

  const filterModalItems = (items: Record<string, unknown>[]) => {
    const search = modalSearch.trim().toLowerCase();
    const fromDate = modalDateFrom ? new Date(modalDateFrom) : null;
    const toDate = modalDateTo ? new Date(`${modalDateTo}T23:59:59.999`) : null;

    return items.filter((item) => {
      const text = JSON.stringify(item).toLowerCase();
      const matchesSearch = !search || text.includes(search);

      const itemDate = getDateValue(item);
      const matchesFrom = !fromDate || !itemDate || itemDate >= fromDate;
      const matchesTo = !toDate || !itemDate || itemDate <= toDate;

      return matchesSearch && matchesFrom && matchesTo;
    });
  };

  const getPreviewText = (value: string): TruncatedMessage => {
    const trimmed = value.trim();
    const previewThreshold = 150;

    if (trimmed.length <= previewThreshold) {
      return { text: value, isTruncated: false };
    }

    const previewLength = Math.min(
      150,
      Math.max(1, Math.ceil(trimmed.length * 0.25)),
    );

    return {
      text: `${trimmed.slice(0, previewLength).trimEnd()}...`,
      isTruncated: true,
    };
  };

  const getSidebarTitle = (value: string) => {
    const trimmed = value.trim();
    const maxLength = 90;

    if (trimmed.length <= maxLength) {
      return trimmed;
    }

    return `${trimmed.slice(0, maxLength).trimEnd()}...`;
  };

  const handleMessageKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void handleSendMessage();
    }
  };

  const handleSendMessage = async () => {
    const trimmedMessage = message.trim();

    if (!trimmedMessage || !selectedSessionId || isSending) {
      return;
    }

    const numericSessionId = Number(selectedSessionId);

    if (!Number.isInteger(numericSessionId) || numericSessionId <= 0) {
      setSendError("Geçerli bir session ID bulunamadı.");
      return;
    }

    const now = new Date().toISOString();
    const localUserMessageId = Date.now();

    const userMessage: AsistanYanit = {
      id: localUserMessageId,
      asistanYanit: trimmedMessage,
      yanitTuru: "KOMUT",
      komutId: null,
      sessionID: selectedSessionId,
      createdAt: now,
    };

    setData((previous) => [...previous, userMessage]);

    setMessage("");
    setSendError("");
    setIsSending(true);

    try {
      const result = await sendAsistanChatMessage(
        trimmedMessage,
        AsistanYanitTuru.KOMUT,
        numericSessionId,
      );

      if (!result.ok) {
        throw new Error(result.message || "Mesaj işlenirken hata oluştu.");
      }

      await loadSessions(String(result.sessionId));
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Mesaj gönderilirken hata oluştu.";

      setSendError(errorMessage);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="sessions-page">
      <aside className="sessions-sidebar">
        <div className="sidebar-top">
          <button className="home-btn" onClick={onHome}>
            &larr; Home
          </button>

          <div>
            <p className="screen-label">Asistan Sohbetleri</p>
            <h1>Sohbet Listesi</h1>
          </div>
        </div>

        <div className="sidebar-summary">
          <span>{groupedSessions.length} sohbet</span>
          <span>{data.length} kayit</span>
        </div>

        <div className="session-list">
          {loading && <div className="state-box">Yukleniyor...</div>}
          {error && <div className="state-box error">{error}</div>}

          {!loading &&
            !error &&
            visibleSessions.map((session) => {
              const isActive = session.sessionId === selectedSessionId;
              const lastMessage = session.messages[session.messages.length - 1];

              return (
                <button
                  key={session.sessionId}
                  className={`session-card ${isActive ? "active" : ""}`}
                  onClick={() => handleSelectSession(session.sessionId)}
                >
                  <div className="session-card-header">
                    <span className="session-id">
                      {getSidebarTitle(session.title)}
                    </span>
                    <span className="message-count">
                      {session.messages.length} mesaj
                    </span>
                  </div>

                  <div className="session-preview">
                    Session ID: {session.sessionId}
                  </div>

                  <div className="session-footer">
                    <span>{lastMessage?.yanitTuru || "-"}</span>
                    <span>
                      {formatTime(
                        lastMessage?.createdAt ?? lastMessage?.tarihSaat,
                      )}
                    </span>
                  </div>
                </button>
              );
            })}

          {!loading && !error && groupedSessions.length > 5 && (
            <button
              type="button"
              className="session-show-more"
              onClick={() => setShowAllSessions((prev) => !prev)}
            >
              {showAllSessions ? "Daha az goster" : "Devamini gor"}
            </button>
          )}
        </div>
      </aside>

      <main className="sessions-main">
        <div className="main-header">
          <div>
            <p className="screen-label">Konusma Detayi</p>
            <h2>
              {selectedSession
                ? selectedSession.sessionId
                : "Secili sohbet yok"}
            </h2>
          </div>
        </div>

        <div
          ref={chatPanelRef}
          className="chat-panel"
          style={messageListStyle}
          onScroll={handleChatScroll}
        >
          {!selectedSession && !loading && !error && (
            <div className="empty-state">Soldan bir sohbet sec.</div>
          )}

          {selectedSession?.messages
            .slice()
            .sort((a, b) => {
              const aTime = new Date(
                a.createdAt ?? a.tarihSaat ?? "",
              ).getTime();
              const bTime = new Date(
                b.createdAt ?? b.tarihSaat ?? "",
              ).getTime();

              return aTime - bTime;
            })
            .map((item, index) => {
              const isUser = item.yanitTuru === "KOMUT";
              const body = getMessageBody(item);
              const preview = getPreviewText(body.fullText);

              return (
                <div
                  key={item.id}
                  ref={
                    index === selectedSession.messages.length - 2
                      ? targetMessageRef
                      : null
                  }
                  className={`message-row ${isUser ? "user" : "assistant"}`}
                >
                  <div className="message-bubble">
                    <div className="message-text">{preview.text}</div>
                    {preview.isTruncated && (
                      <button
                        type="button"
                        className="message-more-btn"
                        onClick={() => setExpandedMessage(item)}
                      >
                        Devamini gor
                      </button>
                    )}
                    <div className="message-meta">
                      <span>{isUser ? "Kullanici" : "Sistem"}</span>
                      <span>
                        {item.komutId ? `Komut: ${item.komutId}` : ""}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}

          {isSending && selectedSession && (
            <div className="message-row assistant">
              <div
                className="message-bubble typing-bubble"
                aria-label="Yanit hazirlaniyor"
              >
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>
        {showScrollDown && (
          <button
            type="button"
            className="session-chat-scroll-down"
            onClick={scrollToLatestMessage}
            aria-label="Son mesaja git"
            title="Son mesaja git"
          >
            ↓
          </button>
        )}

        {selectedSession && (
          <>
            <div className="session-message-composer">
              <input
                type="text"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={handleMessageKeyDown}
                placeholder="Mesaj yaz..."
                disabled={isSending}
              />

              <button
                type="button"
                onClick={() => void handleSendMessage()}
                disabled={!message.trim() || isSending}
              >
                Gönder
              </button>
            </div>

            {sendError && <div className="session-send-error">{sendError}</div>}
          </>
        )}
      </main>

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
                <h3>{expandedMessage.yanitTuru || "Mesaj"}</h3>
              </div>

              <div className="message-modal-actions">
                <button
                  type="button"
                  className="message-modal-filter-clear"
                  onClick={() => {
                    setModalSearch("");
                    setModalDateFrom("");
                    setModalDateTo("");
                  }}
                  disabled={!modalSearch && !modalDateFrom && !modalDateTo}
                  aria-label="Filtreleri temizle"
                  title="Filtreleri temizle"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 5h16l-6 7v5l-4 2v-7L4 5Z" />
                    <path d="m16 16 4 4m0-4-4 4" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="message-modal-copy"
                  onClick={() => void handleCopyModalContent()}
                  aria-label="Mesaj içeriğini kopyala"
                  title={isCopied ? "Kopyalandı" : "Kopyala"}
                >
                  {isCopied ? (
                    <span aria-hidden="true">✓</span>
                  ) : (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <rect x="9" y="9" width="11" height="11" rx="2" />
                      <path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3" />
                    </svg>
                  )}
                </button>
                <button
                  type="button"
                  className="message-modal-close"
                  onClick={() => setExpandedMessage(null)}
                  aria-label="Modalı kapat"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="message-modal-body">
              {(() => {
                const body = getMessageBody(expandedMessage);
                const jsonSource = getModalJsonSource(expandedMessage);
                const modalJson = jsonSource
                  ? formatModalJson(jsonSource)
                  : null;
                const filteredItems = modalJson
                  ? filterModalItems(modalJson.items)
                  : [];

                return (
                  <div className="modal-json-layout">
                    <div className="modal-json-filters">
                      <input
                        type="text"
                        value={modalSearch}
                        onChange={(event) => setModalSearch(event.target.value)}
                        placeholder="JSON içinde ara..."
                      />

                      <input
                        type="date"
                        value={modalDateFrom}
                        onChange={(event) =>
                          setModalDateFrom(event.target.value)
                        }
                        placeholder="Baslangıç tarihi"
                      />

                      <input
                        type="date"
                        value={modalDateTo}
                        onChange={(event) => setModalDateTo(event.target.value)}
                        placeholder="Bitiş tarihi"
                      />
                    </div>

                    {modalJson && filteredItems.length > 0 && (
                      <div className="modal-json-list">
                        {filteredItems.map((item, index) => (
                          <div
                            key={`${index}-${String(item.id ?? index)}`}
                            className="modal-json-item"
                          >
                            <div className="modal-json-item-title">
                              {formatModalItemText(item) ||
                                `Kayit ${index + 1}`}
                            </div>

                            <pre className="modal-json-rest">
                              {JSON.stringify(item, null, 2)}
                            </pre>
                          </div>
                        ))}
                      </div>
                    )}

                    {modalJson && 
                    filteredItems.length === 0 &&
                    (modalSearch || modalDateFrom  || modalDateTo) &&
                    (
                      <div className="state-box">Eşleşen kayıt bulunamadı.</div>
                    )}

                    {modalJson ? (
                      <pre className="modal-json-rest">
                        {modalJson.restJson}
                      </pre>
                    ) : (
                      <pre>{body.fullText}</pre>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
