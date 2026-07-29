import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import {
  AsistanYanitTuru,
  sendAsistanChatMessage,
} from "../api/asistanChatService";
import {
  archiveAsistanSession,
  deleteAsistanSession,
  unarchiveAsistanSession,
} from "../api/asistanYanitService";

import "../style/AsistanSessionsScreen.css";

type AsistanYanit = {
  id: number;
  asistanYanit: string;
  yanitTuru: string;
  komutId: number | null;
  sessionID?: string | number;
  sessionId?: string | number;
  SessionID?: string | number;
  createdAt?: string;
  tarihSaat?: string;
  jsonData?: unknown;
  JsonData?: unknown;
  isArchived?: boolean | string | number;
  IsArchived?: boolean | string | number;
  is_archived?: boolean | string | number;
};

const getSessionId = (item: AsistanYanit) =>
  String(item.sessionID ?? item.sessionId ?? item.SessionID ?? "").trim();

type SessionGroup = {
  sessionID: number;
  sessionId: string;
  title: string;
  messages: AsistanYanit[];
  isArchived: boolean;
};

type TruncatedMessage = {
  text: string;
  isTruncated: boolean;
};

const isArchivedMessage = (item: AsistanYanit) => {
  const value =
    item.isArchived ??
    item.IsArchived ??
    item.is_archived ??
    false;

  return (
    value === true ||
    value === 1 ||
    (typeof value === "string" &&
      (value.trim().toLowerCase() === "true" || value.trim() === "1"))
  );
};

const FIELD_LABELS: Record<string, string> = {
  id: "ID",
  issueId: "Görev ID",
  issue_id: "Görev ID",
  subject: "Başlık",
  title: "Başlık",
  description: "Açıklama",
  project: "Proje",
  projectName: "Proje",
  project_name: "Proje",
  status: "Durum",
  statusName: "Durum",
  status_name: "Durum",
  priority: "Öncelik",
  assignedTo: "Atanan kişi",
  assigned_to: "Atanan kişi",
  author: "Oluşturan",
  createdAt: "Oluşturulma tarihi",
  created_on: "Oluşturulma tarihi",
  updatedAt: "Güncellenme tarihi",
  updated_on: "Güncellenme tarihi",
  start_date: "Başlangıç tarihi",
  due_date: "Bitiş tarihi",
  estimated_hours: "Tahmini süre",
  spent_hours: "Harcanan süre",
  done_ratio: "Tamamlanma oranı",
  total_count: "Toplam kayıt",
  calisacakKod: "Çalışacak kod",
  issues: "Görevler",
  type: "Veri türü",
  limit: "Limit",
  offset: "Başlangıç",
  domain: "Alan",
  target: "Hedef",
  operation: "İşlem",
  confidence: "Güven oranı",
  params: "Parametreler",
  redmine_action: "Redmine işlemi",
  name: "Ad",
  value: "Değer",
  requiresInput: "Durum",
  waitingFor: "Beklenen bilgi",
};

const FRIENDLY_VALUES: Record<string, string> = {
  DAILYREPORT: "Rapor tarihi bekleniyor",
  TASK_ID: "Görev seçimi bekleniyor",
  ACIKLAMA: "Açıklama bekleniyor",
  SEARCH: "Arama bilgisi bekleniyor",
  generate_daily_report: "Günlük rapor oluştur",
  error: "İşlem tamamlanamadı",
  command: "Komut",
  chat: "Sohbet",
};

const formatFieldLabel = (key: string) => {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];

  const readable = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();

  return readable
    ? readable.charAt(0).toLocaleUpperCase("tr-TR") + readable.slice(1)
    : key;
};

const formatScalarValue = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Evet" : "Hayır";
  if (typeof value === "string" && FRIENDLY_VALUES[value]) {
    return FRIENDLY_VALUES[value];
  }

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleString("tr-TR");
    }
  }

  return String(value);
};

const renderReadableValue = (value: unknown): ReactNode => {
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="modal-empty-value">Yok</span>;

    return (
      <div className="modal-readable-array">
        {value.map((entry, index) => (
          <div className="modal-readable-nested" key={index}>
            {renderReadableValue(entry)}
          </div>
        ))}
      </div>
    );
  }

  if (value && typeof value === "object") {
    const visibleEntries = Object.entries(
      value as Record<string, unknown>,
    ).filter(([, nestedValue]) => {
      if (nestedValue === null || nestedValue === undefined || nestedValue === "") {
        return false;
      }
      if (Array.isArray(nestedValue)) return nestedValue.length > 0;
      if (typeof nestedValue === "object") {
        return Object.keys(nestedValue as object).length > 0;
      }
      return true;
    });

    return (
      <div className="modal-readable-fields">
        {visibleEntries.map(
          ([key, nestedValue]) => (
            <div className="modal-readable-row" key={key}>
              <div className="modal-readable-label">
                {formatFieldLabel(key)}
              </div>
              <div className="modal-readable-value">
                {renderReadableValue(nestedValue)}
              </div>
            </div>
          ),
        )}
      </div>
    );
  }

  return formatScalarValue(value);
};

type Props = {
  onHome: () => void;
  ensurePythonRunning: () => Promise<boolean>;
  deadWord: string;
  settingsReady: boolean;
  settingsWarning: string;
};

export default function AsistanSessionsScreen({
  onHome,
  ensurePythonRunning,
  deadWord,
  settingsReady,
  settingsWarning,
}: Props) {
  const [data, setData] = useState<AsistanYanit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null,
  );
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [visibleSessionCount, setVisibleSessionCount] = useState(5);
  const [expandedMessage, setExpandedMessage] = useState<AsistanYanit | null>(
    null,
  );
  const [modalSearch, setModalSearch] = useState("");
  const [modalDateFrom, setModalDateFrom] = useState("");
  const [modalDateTo, setModalDateTo] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  const [sessionSearch, setSessionSearch] = useState("");
  const [showArchivedSessions, setShowArchivedSessions] = useState(false);
  const [openSessionMenuId, setOpenSessionMenuId] = useState<string | null>(null);
  const [sessionMenuPosition, setSessionMenuPosition] = useState({
    top: 0,
    left: 0,
  });
  const [copiedMessageId, setCopiedMessageId] = useState<number | null>(null);
  const [messageFeedback, setMessageFeedback] = useState<
    Record<number, "positive" | "negative">
  >({});
  const [confirmationAnswer, setConfirmationAnswer] = useState<
    Record<number, "evet" | "hayır">
  >({});
  const [answeringConfirmationId, setAnsweringConfirmationId] = useState<
    number | null
  >(null);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [archivingSessionId, setArchivingSessionId] = useState<string | null>(
    null,
  );

  // bu kısım smoothscroll olduğunda nereye gideceğini göstermek için
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const chatPanelRef = useRef<HTMLDivElement | null>(null);
  const targetMessageRef = useRef<HTMLDivElement | null>(null);
  const previousMessageCountRef = useRef(0);
  const sendAbortControllerRef = useRef<AbortController | null>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);

  const handleChatScroll = () => {
    const element = chatPanelRef.current;
    if (!element) return;
    const isAwayFromBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight > 80;
    setShowScrollDown(isAwayFromBottom);
    if (!isAwayFromBottom) setNewMessageCount(0);
  };

  const scrollToLatestMessage = () => {
    chatPanelRef.current?.scrollTo({
      top: chatPanelRef.current.scrollHeight,
      behavior: "smooth",
    });
    setNewMessageCount(0);
  };

  const loadSessions = async (
    preferredSessionId?: string | null,
    silent = false,
  ) => {
    try {
      if (!silent) {
        setLoading(true);
        setError("");
      }

      // Aktif ve arşivlenmiş sohbetler backend'deki ayrı kaynaklardan alınır.
      const [activeResponse, archivedResponse] = await Promise.all([
        fetch("http://localhost:5131/Api/AsistanYanit/Get-All", {
          cache: "no-store",
        }),
        fetch(
          "http://localhost:5131/Api/AsistanYanit/Get-Archived-Sohbet",
          { cache: "no-store" },
        ),
      ]);
      if (!activeResponse.ok) {
        throw new Error(`Aktif sohbetler alınamadı (HTTP ${activeResponse.status}).`);
      }
      if (!archivedResponse.ok) {
        throw new Error(
          `Arşivlenmiş sohbetler alınamadı (HTTP ${archivedResponse.status}).`,
        );
      }

      const [activeResult, archivedResult] = await Promise.all([
        activeResponse.json(),
        archivedResponse.json(),
      ]);
      const activeItems: AsistanYanit[] = Array.isArray(activeResult)
        ? activeResult
        : (activeResult?.data ?? activeResult ?? []);
      const archivedItems: AsistanYanit[] = Array.isArray(archivedResult)
        ? archivedResult
        : (archivedResult?.data ?? archivedResult ?? []);
      const itemMap = new Map<string, AsistanYanit>();

      for (const item of activeItems) {
        itemMap.set(`${getSessionId(item)}:${item.id}`, {
          ...item,
          isArchived: false,
          IsArchived: false,
          is_archived: false,
        });
      }
      for (const item of archivedItems) {
        itemMap.set(`${getSessionId(item)}:${item.id}`, {
          ...item,
          isArchived: true,
          IsArchived: true,
          is_archived: true,
        });
      }
      const items = [...itemMap.values()];

      setData(items);

      if (preferredSessionId) {
        setSelectedSessionId(preferredSessionId);
      } else if (items.length > 0) {
        const firstActiveItem = items.find(
          (item) => !isArchivedMessage(item),
        );
        setSelectedSessionId(
          firstActiveItem ? getSessionId(firstActiveItem) || null : null,
        );
      }
    } catch (err) {
      if (!silent) {
        setError(err instanceof Error ? err.message : "Veri alınamadı.");
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    // Initial API synchronization is intentionally triggered on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSessions();
  }, []);

  useEffect(() => {
    if (!selectedSessionId) return;

    const refreshActiveSession = () => {
      if (document.visibilityState === "visible") {
        void loadSessions(selectedSessionId, true);
      }
    };

    const intervalId = window.setInterval(refreshActiveSession, 2000);
    document.addEventListener("visibilitychange", refreshActiveSession);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshActiveSession);
    };
  }, [selectedSessionId]);

  useEffect(() => {
    if (!openSessionMenuId) return;

    const closeMenu = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Element &&
        (target.closest(".session-card-menu") ||
          target.closest(".session-menu-button"))
      ) {
        return;
      }
      setOpenSessionMenuId(null);
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenSessionMenuId(null);
    };

    document.addEventListener("pointerdown", closeMenu);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeMenu);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [openSessionMenuId]);

  const groupedSessions = useMemo<SessionGroup[]>(() => {
    const map = data.reduce(
      (acc, item) => {
        const key = getSessionId(item);
        const sessionID = Number(key);
        if (!Number.isInteger(sessionID) || sessionID <= 0) return acc;

        if (!acc[key]) {
          acc[key] = {
            sessionID,
            sessionId: key,
            title: "",
            messages: [item],
            isArchived: false,
          };
        } else {
          acc[key].messages.push(item);
        }

        return acc;
      },
      {} as Record<string, SessionGroup>,
    );

    const sessions = Object.values(map).map((session) => {
      const messages = session.messages.slice().sort((a, b) => {
        const aTime = new Date(a.createdAt ?? a.tarihSaat ?? "").getTime();
        const bTime = new Date(b.createdAt ?? b.tarihSaat ?? "").getTime();

        return aTime - bTime;
      });
      const firstCommand = messages.find(
        (message) =>
          message.yanitTuru?.toUpperCase() === "KOMUT" &&
          message.asistanYanit?.trim(),
      );

      return {
        ...session,
        messages,
        isArchived:
          messages.length > 0 && messages.some(isArchivedMessage),
        title:
          firstCommand?.asistanYanit.trim().replace(/\s+/g, " ") ||
          `Sohbet #${session.sessionId}`,
      };
    });

    return sessions.sort((a, b) => {
      const aLast = a.messages[a.messages.length - 1];
      const bLast = b.messages[b.messages.length - 1];

      const aTime = aLast?.createdAt ?? aLast?.tarihSaat ?? "";
      const bTime = bLast?.createdAt ?? bLast?.tarihSaat ?? "";

      return bTime.localeCompare(aTime);
    });
  }, [data]);

  const selectedSession =
    groupedSessions.find((s) => s.sessionId === selectedSessionId) ?? null;
  const normalizedSessionSearch = sessionSearch.trim().toLocaleLowerCase("tr-TR");
  const filteredSessions = groupedSessions.filter((session) => {
    if (session.isArchived !== showArchivedSessions) return false;
    if (!normalizedSessionSearch) return true;

    const lastMessage = session.messages[session.messages.length - 1];
    return `${session.title} ${lastMessage?.asistanYanit ?? ""}`
      .toLocaleLowerCase("tr-TR")
      .includes(normalizedSessionSearch);
  });
  const filteredRecordCount = filteredSessions.reduce(
    (total, session) => total + session.messages.length,
    0,
  );
  const openMenuSession =
    groupedSessions.find(
      (session) => session.sessionId === openSessionMenuId,
    ) ?? null;
  const visibleSessions = filteredSessions.slice(0, visibleSessionCount);
  const shouldLimitMessageList = (selectedSession?.messages.length ?? 0) > 8;
  const messageListStyle = shouldLimitMessageList
    ? {
        maxHeight: "min(60vh, 620px)",
        overflowY: "auto" as const,
      }
    : undefined;
  const selectedMessageCount = selectedSession?.messages.length ?? 0;
  const sortedSelectedMessages = useMemo(
    () =>
      selectedSession?.messages.slice().sort((a, b) => {
        const aTime = new Date(a.createdAt ?? a.tarihSaat ?? "").getTime();
        const bTime = new Date(b.createdAt ?? b.tarihSaat ?? "").getTime();

        return aTime - bTime;
      }) ?? [],
    [selectedSession],
  );

  useEffect(() => {
    const previousCount = previousMessageCountRef.current;
    const addedMessageCount = Math.max(0, selectedMessageCount - previousCount);
    previousMessageCountRef.current = selectedMessageCount;

    if (selectedMessageCount === 0 || addedMessageCount === 0) return;

    if (showScrollDown) {
      setNewMessageCount((count) => count + addedMessageCount);
    } else {
      window.requestAnimationFrame(scrollToLatestMessage);
    }
  }, [selectedMessageCount, showScrollDown]);

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

  const getSessionDateGroup = (session: SessionGroup) => {
    const lastMessage = session.messages[session.messages.length - 1];
    const value = lastMessage?.createdAt ?? lastMessage?.tarihSaat;
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return "Daha eski";

    const today = new Date();
    const startOfToday = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );
    const startOfDate = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
    );
    const dayDifference = Math.round(
      (startOfToday.getTime() - startOfDate.getTime()) / 86_400_000,
    );

    if (dayDifference === 0) return "Bugün";
    if (dayDifference === 1) return "Dün";
    if (dayDifference < 7) return "Geçen hafta";
    return "Daha eski";
  };

  const groupedVisibleSessions = visibleSessions.reduce<
    { label: string; sessions: SessionGroup[] }[]
  >((groups, session) => {
    const label = getSessionDateGroup(session);
    const existingGroup = groups.find((group) => group.label === label);
    if (existingGroup) {
      existingGroup.sessions.push(session);
    } else {
      groups.push({ label, sessions: [session] });
    }
    return groups;
  }, []);

  const getMessageType = (item: AsistanYanit) => {
    const parsed = parseJsonValue(item.jsonData ?? item.JsonData);
    const jsonType =
      parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? String((parsed as Record<string, unknown>).type ?? "")
        : "";
    const rawType = jsonType || item.yanitTuru || "YANIT";
    return rawType.toLocaleLowerCase("tr-TR");
  };

  const getMessageTypeLabel = (item: AsistanYanit) => {
    const type = getMessageType(item);
    if (type === "komut" || type === "command") return "Komut";
    if (type === "error" || type === "hata") return "Hata";
    if (type === "pending") return "Bekliyor";
    if (type === "onayyanit") return "Onay";
    if (type === "chat") return "Sohbet";
    if (type === "system") return "Sistem";
    return "Yanıt";
  };

  const handleSelectSession = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setMessage("");
    setSendError("");
    setExpandedMessage(null);
    setNewMessageCount(0);
    previousMessageCountRef.current = 0;
  };

  const handleArchiveSession = async (
    session: SessionGroup,
    archive: boolean,
  ) => {
    const { sessionID, sessionId } = session;
    if (!Number.isInteger(sessionID) || sessionID <= 0) {
      setError("Geçerli bir session ID bulunamadı.");
      return;
    }

    try {
      setArchivingSessionId(sessionId);
      setError("");

      if (archive) {
        await archiveAsistanSession(sessionID);
      } else {
        await unarchiveAsistanSession(sessionID);
      }
      setData((items) =>
        items.map((item) =>
          getSessionId(item) === sessionId
            ? {
                ...item,
                isArchived: archive,
                IsArchived: archive,
                is_archived: archive,
              }
            : item,
        ),
      );
      setOpenSessionMenuId(null);
      if (selectedSessionId === sessionId) setSelectedSessionId(null);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : archive
            ? "Sohbet arşivlenemedi."
            : "Sohbet arşivden kaldırılamadı.",
      );
    } finally {
      setArchivingSessionId(null);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    const confirmed = window.confirm(
      "Bu sohbet silinecek ve silinen sohbetler tablosuna taşınacak. Devam etmek istiyor musunuz?",
    );
    if (!confirmed) return;

    const numericSessionId = Number(sessionId);
    if (!Number.isInteger(numericSessionId) || numericSessionId <= 0) {
      setError("Geçerli bir session ID bulunamadı.");
      return;
    }

    try {
      setDeletingSessionId(sessionId);
      setError("");
      await deleteAsistanSession(numericSessionId);
      setData((items) =>
        items.filter((item) => getSessionId(item) !== sessionId),
      );
      setOpenSessionMenuId(null);
      if (selectedSessionId === sessionId) setSelectedSessionId(null);
    } catch {
      setError(
        "Sohbet silinemedi. Backend delete-session endpoint'ini kontrol edin.",
      );
    } finally {
      setDeletingSessionId(null);
    }
  };

  const handleCopyMessage = async (item: AsistanYanit) => {
    const body = getMessageBody(item);
    const jsonSource = getModalJsonSource(item);
    await navigator.clipboard.writeText(
      [body.text, jsonSource].filter(Boolean).join("\n\n"),
    );
    setCopiedMessageId(item.id);
    window.setTimeout(() => setCopiedMessageId(null), 1500);
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

  const parseJsonValue = (value: unknown) => {
    let parsed = value;

    for (let index = 0; index < 3 && typeof parsed === "string"; index += 1) {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        return null;
      }
    }

    return parsed;
  };

  const getVisibleJsonData = (item: AsistanYanit) => {
    const rawJson = item.jsonData ?? item.JsonData ?? null;

    if (
      rawJson === null ||
      rawJson === undefined
    ) {
      return rawJson;
    }

    const parsed = parseJsonValue(rawJson);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return rawJson;
    }

    const type = (parsed as Record<string, unknown>).type;

    if (
      typeof type === "string" &&
      type.trim().toLowerCase() === "chat"
    ) {
      return null;
    }

    return rawJson;
  };

  const getMessageBody = (item: AsistanYanit) => {
    const text = formatAssistantResponse(item.asistanYanit);
    const rawJson = getVisibleJsonData(item);
    const jsonText =
      rawJson === null || rawJson === undefined
        ? ""
        : formatAssistantResponse(rawJson);

    const fullText = text;

    return { text, jsonText, fullText, rawJson };
  };

  const formatModalJson = (value: string) => {
    const parsed = parseJsonValue(value);

    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    if (Array.isArray(parsed)) {
      return {
        id: null,
        projectName: "",
        items: parsed.map((item) =>
          item && typeof item === "object"
            ? (item as Record<string, unknown>)
            : { value: item },
        ),
        totalCount: parsed.length,
        restJson: "",
      };
    }

    const obj = parsed as Record<string, unknown>;
    const idValue = obj.id;
    const projectValue = obj.project;

    const projectName =
      projectValue && typeof projectValue === "object"
        ? String((projectValue as Record<string, unknown>).name ?? "")
        : "";

    const rawIssues = obj.issues ?? obj.Issues;
    const parsedIssues =
      typeof rawIssues === "string" ? parseJsonValue(rawIssues) : rawIssues;
    const issues = Array.isArray(parsedIssues)
      ? parsedIssues.filter(
          (item): item is Record<string, unknown> =>
            Boolean(item) && typeof item === "object",
        )
      : [];
    const issueSummary = Array.isArray(
      (obj as Record<string, unknown>).issueSummary,
    )
      ? ((obj as Record<string, unknown>).issueSummary as Record<
          string,
          unknown
        >[])
      : [];

    const items = issues.length > 0 ? issues : issueSummary;
    const hasCollection = issues.length > 0 || issueSummary.length > 0;

    return {
      id: idValue,
      projectName,
      items: hasCollection ? items : [obj],
      totalCount:
        typeof obj.total_count === "number"
          ? obj.total_count
          : hasCollection
            ? items.length
            : 1,
      restJson: "",
    };
  };

  const getModalJsonSource = (item: AsistanYanit) => {
    const rawJson = getVisibleJsonData(item);

    if (rawJson === null || rawJson === undefined) {
      return "";
    }

    return formatAssistantResponse(rawJson);
  };

  const handleCopyModalContent = async () => {
    if (!expandedMessage) return;

    const body = getMessageBody(expandedMessage);
    const jsonSource = getModalJsonSource(expandedMessage);
    const content = [body.text, jsonSource].filter(Boolean).join("\n\n");

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
    const normalizeSearchText = (value: string) =>
      value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/ı/g, "i");

    const searchTerms = normalizeSearchText(modalSearch.trim())
      .split(/\s+/)
      .filter(Boolean);
    const fromDate = modalDateFrom ? new Date(modalDateFrom) : null;
    const toDate = modalDateTo ? new Date(`${modalDateTo}T23:59:59.999`) : null;

    return items.filter((item) => {
      const text = normalizeSearchText(JSON.stringify(item));
      const matchesSearch = searchTerms.every((term) => text.includes(term));

      const itemDate = getDateValue(item);
      const matchesFrom = !fromDate || (!!itemDate && itemDate >= fromDate);
      const matchesTo = !toDate || (!!itemDate && itemDate <= toDate);

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
    const maxLength = 64;

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
    if (!settingsReady) {
      setSendError(settingsWarning);
      return;
    }

    const numericSessionId = Number(selectedSessionId);

    if (!Number.isInteger(numericSessionId) || numericSessionId <= 0) {
      setSendError("Geçerli bir session ID bulunamadı.");
      return;
    }

    setIsSending(true);
    setSendError("");
    const pythonIsReady = await ensurePythonRunning();
    if (!pythonIsReady) {
      setIsSending(false);
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
    const requestController = new AbortController();
    sendAbortControllerRef.current = requestController;

    try {
      const result = await sendAsistanChatMessage(
        trimmedMessage,
        AsistanYanitTuru.KOMUT,
        numericSessionId,
        requestController.signal,
      );

      if (!result.ok) {
        throw new Error(result.message || "Mesaj işlenirken hata oluştu.");
      }

      await loadSessions(String(result.sessionId));
    } catch (error) {
      if (requestController.signal.aborted) {
        setSendError("İstek iptal edildi.");
        return;
      }

      const errorMessage =
        error instanceof Error
          ? error.message
          : "Mesaj gönderilirken hata oluştu.";

      setSendError(errorMessage);
    } finally {
      if (sendAbortControllerRef.current === requestController) {
        sendAbortControllerRef.current = null;
        setIsSending(false);
      }
    }
  };

  const handleConfirmationAnswer = async (
    confirmation: AsistanYanit,
    answer: "evet" | "hayır",
  ) => {
    if (!selectedSessionId || answeringConfirmationId !== null) return;

    const numericSessionId = Number(selectedSessionId);
    if (!Number.isInteger(numericSessionId) || numericSessionId <= 0) {
      setSendError("Geçerli bir session ID bulunamadı.");
      return;
    }

    setAnsweringConfirmationId(confirmation.id);
    setSendError("");

    try {
      const result = await sendAsistanChatMessage(
        answer,
        AsistanYanitTuru.ONAYYANIT,
        numericSessionId,
      );

      if (!result.ok) {
        throw new Error(result.message || "Onay yanıtı işlenemedi.");
      }

      setConfirmationAnswer((answers) => ({
        ...answers,
        [confirmation.id]: answer,
      }));
      await loadSessions(String(result.sessionId), true);
    } catch (error) {
      setSendError(
        error instanceof Error
          ? error.message
          : "Onay yanıtı gönderilirken hata oluştu.",
      );
    } finally {
      setAnsweringConfirmationId(null);
    }
  };

  const handleCancelMessage = async () => {
    sendAbortControllerRef.current?.abort();
    sendAbortControllerRef.current = null;

    const cancelMessage = deadWord.trim();
    if (!cancelMessage) {
      setIsSending(false);
      setSendError("Veritabanında dead word tanımlı değil.");
      return;
    }

    try {
      const numericSessionId = Number(selectedSessionId);
      const result = await sendAsistanChatMessage(
        cancelMessage,
        AsistanYanitTuru.KOMUT,
        Number.isInteger(numericSessionId) && numericSessionId > 0
          ? numericSessionId
          : null,
      );

      if (!result.ok) {
        throw new Error(result.message || "İptal mesajı işlenemedi.");
      }

      setSendError("");
      await loadSessions(String(result.sessionId), true);
    } catch (error) {
      setSendError(
        error instanceof Error
          ? error.message
          : "İptal mesajı backend'e gönderilemedi.",
      );
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
          <span>{filteredSessions.length} sohbet</span>
          <span>{filteredRecordCount} kayıt</span>
        </div>

        <div className="session-view-tabs">
          <button
            type="button"
            className={!showArchivedSessions ? "active" : ""}
            onClick={() => {
              setShowArchivedSessions(false);
              setSelectedSessionId(null);
              setVisibleSessionCount(5);
            }}
          >
            Aktif sohbetler
          </button>
          <button
            type="button"
            className={showArchivedSessions ? "active" : ""}
            onClick={() => {
              setShowArchivedSessions(true);
              setSelectedSessionId(null);
              setVisibleSessionCount(5);
            }}
          >
            Arşiv
          </button>
        </div>

        <label className="session-search">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m16 16 5 5" />
          </svg>
          <input
            type="search"
            value={sessionSearch}
            onChange={(event) => setSessionSearch(event.target.value)}
            placeholder="Sohbetlerde ara..."
          />
        </label>

        <div
          className={`session-list ${visibleSessionCount > 5 ? "expanded" : ""}`}
        >
          {loading && <div className="state-box">Yükleniyor...</div>}
          {error && <div className="state-box error">{error}</div>}
          {!loading && !error && groupedVisibleSessions.length === 0 && (
            <div className="state-box">
              {sessionSearch
                ? "Aramanızla eşleşen sohbet bulunamadı."
                : "Gösterilecek sohbet bulunamadı."}
            </div>
          )}

          {!loading &&
            !error &&
            groupedVisibleSessions.map((group) => (
              <section className="session-date-group" key={group.label}>
                <div className="session-date-label">{group.label}</div>
                {group.sessions.map((session) => {
              const isActive = session.sessionId === selectedSessionId;
              const lastMessage = session.messages[session.messages.length - 1];
              const lastPreview = getPreviewText(lastMessage?.asistanYanit ?? "");

              return (
                <div
                  key={session.sessionId}
                  className={`session-card ${isActive ? "active" : ""}`}
                  onClick={() => handleSelectSession(session.sessionId)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      handleSelectSession(session.sessionId);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div className="session-card-header">
                    <span className="session-id">
                      {getSidebarTitle(session.title)}
                    </span>
                    <button
                      type="button"
                      className="session-menu-button"
                      aria-label="Sohbet seçenekleri"
                      onClick={(event) => {
                        event.stopPropagation();
                        const rect = event.currentTarget.getBoundingClientRect();
                        setSessionMenuPosition({
                          top: rect.top,
                          left: rect.right + 8,
                        });
                        setOpenSessionMenuId((current) =>
                          current === session.sessionId ? null : session.sessionId,
                        );
                      }}
                    >
                      •••
                    </button>
                  </div>

                  <div className="session-preview">
                    {lastPreview.text || "Henüz mesaj yok"}
                  </div>

                  <div className="session-footer">
                    <span>{session.messages.length} mesaj</span>
                    <span>
                      {formatTime(
                        lastMessage?.createdAt ?? lastMessage?.tarihSaat,
                      )}
                    </span>
                  </div>

                </div>
              );
                })}
              </section>
            ))}

        </div>

        {!loading && !error && filteredSessions.length > 5 && (
          <button
            type="button"
            className="session-show-more"
            onClick={() =>
              setVisibleSessionCount((count) =>
                count >= filteredSessions.length ? 5 : count + 5,
              )
            }
          >
            {visibleSessionCount >= filteredSessions.length
              ? "Daha az göster"
              : "Devamını gör"}
          </button>
        )}
      </aside>

      <main className="sessions-main">
        <div className="main-header">
          <div>
            <p className="screen-label">Konuşma Detayı</p>
            <h2>
              {selectedSession
                ? getSidebarTitle(selectedSession.title)
                : "Seçili sohbet yok"}
            </h2>
            {selectedSession && (
              <span className="main-session-meta">
                Sohbet #{selectedSession.sessionId} · {selectedSession.messages.length} mesaj
              </span>
            )}
          </div>
        </div>

        <div
          ref={chatPanelRef}
          className="chat-panel"
          style={messageListStyle}
          onScroll={handleChatScroll}
        >
          {!selectedSession && !loading && !error && (
            <div className="empty-state">Soldan bir sohbet seç.</div>
          )}

          {sortedSelectedMessages.map((item, index) => {
              const isConfirmation =
                item.yanitTuru?.toUpperCase() === AsistanYanitTuru.ONAY;
              if (isConfirmation) return null;

              const normalizedResponseType = item.yanitTuru?.toUpperCase();
              const isUser =
                normalizedResponseType === AsistanYanitTuru.KOMUT ||
                normalizedResponseType === AsistanYanitTuru.ONAYYANIT;
              const confirmation =
                !isUser &&
                sortedSelectedMessages[index + 1]?.yanitTuru?.toUpperCase() ===
                  AsistanYanitTuru.ONAY
                  ? sortedSelectedMessages[index + 1]
                  : null;
              const persistedConfirmationAnswer =
                confirmation &&
                sortedSelectedMessages[index + 2]?.yanitTuru?.toUpperCase() ===
                  AsistanYanitTuru.ONAYYANIT
                  ? sortedSelectedMessages[index + 2].asistanYanit
                      .trim()
                      .toLocaleLowerCase("tr-TR")
                  : "";
              const selectedConfirmationAnswer =
                (confirmation && confirmationAnswer[confirmation.id]) ||
                (persistedConfirmationAnswer === "evet" ||
                persistedConfirmationAnswer === "hayır"
                  ? persistedConfirmationAnswer
                  : undefined);
              const body = getMessageBody(item);
              const hasJsonContent = Boolean(getModalJsonSource(item));
              const assistantTextIsJson = Boolean(
                parseJsonValue(item.asistanYanit),
              );
              const visibleText = assistantTextIsJson
                ? "Yapılandırılmış sonuç hazır."
                : body.text || (hasJsonContent ? "Yapılandırılmış sonuç hazır." : "");
              const preview = getPreviewText(visibleText);
              const messageType = getMessageType(item);
              const messageTypeLabel = getMessageTypeLabel(item);

              return (
                <div
                  key={item.id}
                  ref={
                    index === sortedSelectedMessages.length - 2
                      ? targetMessageRef
                      : null
                  }
                  className={`message-row ${isUser ? "user" : "assistant"} message-${messageType}`}
                >
                  <div className="message-avatar" aria-hidden="true">
                    {isUser ? (
                      <svg viewBox="0 0 24 24">
                        <circle cx="12" cy="8" r="4" />
                        <path d="M5 20c.7-4 3.1-6 7-6s6.3 2 7 6" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24">
                        <path d="m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3Z" />
                        <path d="m18.5 15 .7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7.7-2.3Z" />
                      </svg>
                    )}
                  </div>
                  <div className="message-content">
                    <div className="message-heading">
                      <strong>{isUser ? "Siz" : "Asistan"}</strong>
                      <span className={`message-type-badge badge-${messageType}`}>
                        {messageTypeLabel}
                      </span>
                    </div>
                    <div className="message-bubble">
                      <div className="message-text">{preview.text}</div>
                      {(preview.isTruncated || hasJsonContent) && (
                        <button
                          type="button"
                          className="message-more-btn"
                          onClick={() => setExpandedMessage(item)}
                        >
                          {hasJsonContent ? "Detayı gör" : "Devamını gör"}
                        </button>
                      )}
                      <div className="message-meta">
                        <span>
                          {formatTime(item.createdAt ?? item.tarihSaat)}
                        </span>
                        {item.komutId && <span>Komut #{item.komutId}</span>}
                      </div>
                      {confirmation && (
                        <div className="confirmation-section">
                          <div className="confirmation-question">
                            {confirmation.asistanYanit}
                          </div>
                          <div
                            className="confirmation-actions"
                            role="group"
                            aria-label="Onay yanıtı"
                          >
                            <button
                              type="button"
                              className={
                                selectedConfirmationAnswer === "evet"
                                  ? "selected"
                                  : ""
                              }
                              disabled={
                                answeringConfirmationId !== null ||
                                Boolean(selectedConfirmationAnswer)
                              }
                              onClick={() =>
                                void handleConfirmationAnswer(confirmation, "evet")
                              }
                            >
                              Evet
                            </button>
                            <button
                              type="button"
                              className={
                                selectedConfirmationAnswer === "hayır"
                                  ? "selected"
                                  : ""
                              }
                              disabled={
                                answeringConfirmationId !== null ||
                                Boolean(selectedConfirmationAnswer)
                              }
                              onClick={() =>
                                void handleConfirmationAnswer(confirmation, "hayır")
                              }
                            >
                              Hayır
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="message-actions">
                      <button
                        type="button"
                        onClick={() => void handleCopyMessage(item)}
                        title="Mesajı kopyala"
                      >
                        {copiedMessageId === item.id ? "Kopyalandı" : "Kopyala"}
                      </button>
                      {!isUser && (
                        <>
                          <button
                            type="button"
                            className={
                              messageFeedback[item.id] === "positive" ? "active" : ""
                            }
                            onClick={() =>
                              setMessageFeedback((feedback) => ({
                                ...feedback,
                                [item.id]: "positive",
                              }))
                            }
                            aria-label="Faydalı yanıt"
                            title="Faydalı"
                          >
                            👍
                          </button>
                          <button
                            type="button"
                            className={
                              messageFeedback[item.id] === "negative" ? "active" : ""
                            }
                            onClick={() =>
                              setMessageFeedback((feedback) => ({
                                ...feedback,
                                [item.id]: "negative",
                              }))
                            }
                            aria-label="Faydasız yanıt"
                            title="Faydasız"
                          >
                            👎
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

          {isSending && selectedSession && (
            <div className="message-row assistant">
              <div
                className="message-bubble typing-bubble"
                aria-label="Yanıt hazırlanıyor"
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
            {newMessageCount > 0 ? (
              <span>{newMessageCount} yeni mesaj</span>
            ) : (
              "↓"
            )}
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
                placeholder={
                  selectedSession?.isArchived
                    ? "Arşivlenmiş sohbetlere mesaj gönderilemez."
                    : "Mesaj yaz..."
                }
                disabled={
                  isSending ||
                  selectedSession?.isArchived ||
                  !settingsReady
                }
              />

              <button
                type="button"
                onClick={() => void handleSendMessage()}
                disabled={
                  !message.trim() ||
                  isSending ||
                  selectedSession?.isArchived ||
                  !settingsReady
                }
              >
                Gönder
              </button>

              <button
                type="button"
                className="session-stop-button"
                onClick={() => void handleCancelMessage()}
                disabled={!isSending}
                aria-label="İsteği iptal et"
                title={isSending ? "İsteği iptal et" : "Aktif istek yok"}
              >
                <span className="stop-icon"></span>
              </button>
            </div>

            {sendError && <div className="session-send-error">{sendError}</div>}
          </>
        )}
      </main>

      {openSessionMenuId &&
        openMenuSession &&
        createPortal(
          <div
            className="session-card-menu session-card-menu-portal"
            style={{
              top: sessionMenuPosition.top,
              left: sessionMenuPosition.left,
            }}
          >
            <button
              type="button"
              disabled={archivingSessionId === openSessionMenuId}
              onClick={() =>
                void handleArchiveSession(
                  openMenuSession,
                  !openMenuSession.isArchived,
                )
              }
            >
              {archivingSessionId === openSessionMenuId
                ? "İşleniyor..."
                : openMenuSession.isArchived
                  ? "Arşivden kaldır"
                  : "Sohbeti arşivle"}
            </button>
            <button
              type="button"
              className="session-delete-button"
              disabled={deletingSessionId === openSessionMenuId}
              onClick={() => void handleDeleteSession(openSessionMenuId)}
            >
              {deletingSessionId === openSessionMenuId
                ? "Siliniyor..."
                : "Sohbeti sil"}
            </button>
          </div>,
          document.body,
        )}

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
                <h3>{getMessageTypeLabel(expandedMessage)}</h3>
              </div>

              <div className="message-modal-actions">
                {getModalJsonSource(expandedMessage) && (
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
                )}
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
                const parsedDetail = jsonSource
                  ? parseJsonValue(jsonSource)
                  : null;
                const detailObject =
                  parsedDetail &&
                  typeof parsedDetail === "object" &&
                  !Array.isArray(parsedDetail)
                    ? (parsedDetail as Record<string, unknown>)
                    : null;
                const detailType = String(detailObject?.type ?? "").toLowerCase();
                const hasTaskCollection = Boolean(
                  detailObject?.issues ||
                    detailObject?.Issues ||
                    detailObject?.issueSummary,
                );
                const detailTitle = hasTaskCollection
                  ? "Görevler"
                  : detailType === "error"
                    ? "Hata ayrıntıları"
                    : detailType === "command"
                      ? "Komut ayrıntıları"
                      : "Yanıt ayrıntıları";
                const filteredItems = modalJson
                  ? filterModalItems(modalJson.items)
                  : [];

                return (
                  <div className={`modal-json-layout detail-${detailType || "response"}`}>
                    {body.text && modalJson && (
                      <div className="modal-response-summary">
                        <span>Asistan yanıtı</span>
                        <p>{body.text}</p>
                      </div>
                    )}

                    {modalJson && (
                      <div className="modal-json-filters">
                        <label className="modal-filter-field">
                          <span>İçerikte ara</span>
                          <input
                            type="text"
                            value={modalSearch}
                            onChange={(event) =>
                              setModalSearch(event.target.value)
                            }
                            placeholder="Başlık, proje veya açıklama..."
                          />
                        </label>

                        <label className="modal-filter-field">
                          <span>Başlangıç tarihi</span>
                          <input
                            type="date"
                            value={modalDateFrom}
                            onChange={(event) =>
                              setModalDateFrom(event.target.value)
                            }
                          />
                        </label>

                        <label className="modal-filter-field">
                          <span>Bitiş tarihi</span>
                          <input
                            type="date"
                            value={modalDateTo}
                            onChange={(event) =>
                              setModalDateTo(event.target.value)
                            }
                          />
                        </label>
                      </div>
                    )}

                    {modalJson && filteredItems.length > 0 && (
                      <div className="modal-json-list">
                        <div className="modal-task-list-heading">
                          <strong>{detailTitle}</strong>
                          <span>
                            {filteredItems.length} kayıt
                          </span>
                        </div>
                        {filteredItems.map((item, index) => (
                          <div
                            key={`${index}-${String(item.id ?? index)}`}
                            className="modal-json-item"
                          >
                            <div className="modal-json-item-title">
                              {formatModalItemText(item) ||
                                `Kayıt ${index + 1}`}
                            </div>

                            {renderReadableValue(item)}
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

                    {!modalJson && <pre>{body.text}</pre>}
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
