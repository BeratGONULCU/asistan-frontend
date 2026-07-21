import { useEffect, useMemo, useState } from "react";
import "../style/AsistanSessionsScreen.css";

type AsistanYanit = {
  id: number;
  asistanYanit: string;
  yanitTuru: string;
  komutId: number | null;
  sessionID: string;
  createdAt?: string;
  tarihSaat?: string;
};

type SessionGroup = {
  sessionId: string;
  title: string;
  messages: AsistanYanit[];
};

type Props = {
  onHome: () => void;
};

export default function AsistanSessionsScreen({ onHome }: Props) {
  const [data, setData] = useState<AsistanYanit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await fetch("http://localhost:5131/Api/AsistanYanit/Get-All");
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();
        const items: AsistanYanit[] = Array.isArray(result)
          ? result
          : result?.data ?? result ?? [];

        setData(items);

        if (items.length > 0) {
          setSelectedSessionId(items[0].sessionID ?? null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Veri alınamadı.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const groupedSessions = useMemo<SessionGroup[]>(() => {
  const map = data.reduce((acc, item) => {
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
  }, {} as Record<string, SessionGroup>);

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

  return (
    <div className="sessions-page">
      <aside className="sessions-sidebar">
        <div className="sidebar-top">
          <button className="home-btn" onClick={onHome}>
            ← Home
          </button>

          <div>
            <p className="screen-label">Asistan Sohbetleri</p>
            <h1>Sohbet Listesi</h1>
          </div>
        </div>

        <div className="sidebar-summary">
          <span>{groupedSessions.length} sohbet</span>
          <span>{data.length} kayıt</span>
        </div>

        <div className="session-list">
          {loading && <div className="state-box">Yükleniyor...</div>}
          {error && <div className="state-box error">{error}</div>}

          {!loading &&
            !error &&
            groupedSessions.map((session) => {
              const isActive = session.sessionId === selectedSessionId;
              const lastMessage = session.messages[session.messages.length - 1];

              return (
                <button
                  key={session.sessionId}
                  className={`session-card ${isActive ? "active" : ""}`}
                  onClick={() => setSelectedSessionId(session.sessionId)}
                >
                  <div className="session-card-header">
                    <span className="session-id">{session.title}</span>
                    <span className="message-count">{session.messages.length} mesaj</span>
                  </div>

                  <div className="session-preview">
                    Session ID: {session.sessionId}
                  </div>

                  <div className="session-footer">
                    <span>{lastMessage?.yanitTuru || "-"}</span>
                    <span>
                      {formatTime(lastMessage?.createdAt ?? lastMessage?.tarihSaat)}
                    </span>
                  </div>
                </button>
              );
            })}
        </div>
      </aside>

      <main className="sessions-main">
        <div className="main-header">
          <div>
            <p className="screen-label">Konuşma Detayı</p>
            <h2>{selectedSession ? selectedSession.sessionId : "Seçili sohbet yok"}</h2>
          </div>
        </div>

        <div className="chat-panel">
          {!selectedSession && !loading && !error && (
            <div className="empty-state">Soldan bir sohbet seç.</div>
          )}

          {selectedSession?.messages.map((item) => {
            const isUser = item.yanitTuru === "KOMUT";

            return (
              <div
                key={item.id}
                className={`message-row ${isUser ? "user" : "assistant"}`}
              >
                <div className="message-bubble">
                  <div className="message-text">{item.asistanYanit}</div>
                  <div className="message-meta">
                    <span>{isUser ? "Kullanıcı" : "Sistem"}</span>
                    <span>{item.komutId ? `Komut: ${item.komutId}` : ""}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}