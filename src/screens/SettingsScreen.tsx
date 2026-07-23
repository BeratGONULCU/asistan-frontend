import { useState } from "react";
import {
  checkOllamaStatus,
  downloadOllamaInstaller,
  CreateAsistanSetting,
  GetAllAssistanSetting,
  UpdateAsistanSetting,
  type AsistanSettingsResponse,
  type OllamaStatus,
} from "../api/systemSettingsService";
import "../style/SettingsScreen.css";

export type AiProvider = "gemini" | "llama" | "openai";

export type AppSettings = {
  redmineToken: string;
  wakeWord: string;
  deadWord: string;
  activeProvider: AiProvider;
  geminiApiKey: string;
  geminiModel: string;
  openAiApiKey: string;
  openAiModel: string;
  ollamaModel: string;
  aiFallbackProvider?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

type Props = {
  settings: AppSettings;
  onChange: (settings: AppSettings) => void;
  onBack: () => void;
  onReset: () => void;
};

export default function SettingsScreen({
  settings,
  onChange,
  onBack,
  onReset,
}: Props) {
  const [showSecrets, setShowSecrets] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null);
  const [isCheckingOllama, setIsCheckingOllama] = useState(false);
  const [isDownloadingOllama, setIsDownloadingOllama] = useState(false);
  const [validationMessage, setValidationMessage] = useState("");
  const [noticeType, setNoticeType] = useState<"success" | "error">("success");

  const updateSetting = <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K],
  ) => {
    if (typeof onChange === "function") {
      onChange({ ...settings, [key]: value });
    }
    setValidationMessage("");
  };

  const validate = () => {
    if (!settings?.redmineToken?.trim()) return "Redmine token zorunludur.";
    if (settings.activeProvider === "gemini" && !settings.geminiApiKey?.trim())
      return "Gemini sağlayıcısı için API anahtarı zorunludur.";
    if (settings.activeProvider === "gemini" && !settings.geminiModel?.trim())
      return "Gemini modeli seçilmelidir.";
    if (
      settings.activeProvider === "llama" &&
      ollamaStatus &&
      !ollamaStatus.available
    )
      return "Llama/Ollama bu bilgisayarda çalışır durumda değil.";
    if (settings.activeProvider === "openai" && !settings.openAiApiKey?.trim())
      return "OpenAI sağlayıcısı için API anahtarı zorunludur.";
    if (settings.activeProvider === "openai" && !settings.openAiModel?.trim())
      return "OpenAI modeli girilmelidir.";
    return "";
  };

  // burada bir kontrol fonksiyon olacak - eğer ki get-all ile kayıt gelirse sadece update , gelmezse create yapabilir

  const handleCheckSettings = async (): Promise<boolean> => {
    try {
      const error = validate();
      if (error){
          setValidationMessage(error);
          return false;
      }

      const response = await GetAllAssistanSetting();
      return Array.isArray(response) ? response.length > 0 : Boolean(response);
    }
    catch(error: any)
    {
      console.error("ayar bilgileri kontrol edilemedi");
      setValidationMessage("ayar bilgileri getirilemedi");
      return false;
    }
  }

  const handleUpdate = async () => {
    try {
      const response = await GetAllAssistanSetting();
      const records: AsistanSettingsResponse[] = Array.isArray(response)
        ? response
        : [response];
      const currentSetting = records.at(-1);
      const id = currentSetting?.id ?? currentSetting?.Id;

      if (id === undefined) {
        await handleCreate();
        return;
      }

      const updatedSetting = await UpdateAsistanSetting({
        id,
        redmineToken: settings.redmineToken,
        wakeWord: settings.wakeWord,
        deadWord: settings.deadWord,
        activeProvider: settings.activeProvider.toUpperCase(),
        geminiApiKey: settings.geminiApiKey,
        geminiModel: settings.geminiModel,
        openAiApiKey: settings.openAiApiKey,
        openAiModel: settings.openAiModel,
        ollamaModel: settings.ollamaModel,
        aiFallbackProvider: settings.aiFallbackProvider ?? "OLLAMA",
      });

      setNoticeType("success");
      setValidationMessage("ayarlar başarıyla güncellendi");
      console.log("ayarlar güncellendi", updatedSetting);
    } catch (error) {
      setNoticeType("error");
      setValidationMessage("ayarlar güncellenemedi, lütfen bağlantınızı kontrol edin");
      console.error("ayarlar güncellenemedi", error);
    }
  };

  const handleCreate = async () => {
    try {
      const error = validate();
      if (error) {
        setValidationMessage(error);
        return;
      }

      const response = await CreateAsistanSetting({
        redmineToken: settings.redmineToken,
        wakeWord: settings.wakeWord,
        deadWord: settings.deadWord,
        activeProvider: settings.activeProvider.toUpperCase(),
        geminiApiKey: settings.geminiApiKey,
        geminiModel: settings.geminiModel,
        openAiApiKey: settings.openAiApiKey,
        openAiModel: settings.openAiModel,
        ollamaModel: settings.ollamaModel,
        aiFallbackProvider: settings.aiFallbackProvider ?? "OLLAMA",
      });

      setNoticeType("success");
      setValidationMessage("ayarlar başarıyla kaydedildi");
      console.log("ayarlar kaydedildi", response);
    } catch (error: any) {
      setNoticeType("error");
      console.error("ayarlar başarıyla kaydedilemedi");
      setValidationMessage("lütfen bağlantınızı kontrol edin");
    }
  };

  const handleCheckOllama = async () => {
    setIsCheckingOllama(true);
    setOllamaStatus(null);
    try {
      const status = await checkOllamaStatus();
      setOllamaStatus(status);

      if (
        !status.available &&
        window.confirm(
          "Ollama bilgisayarda bulunamadı. Kurulum dosyası indirilsin mi?",
        )
      ) {
        setIsDownloadingOllama(true);
        try {
          await downloadOllamaInstaller();
          setOllamaStatus({
            ...status,
            message: "OllamaSetup.exe seçtiğiniz konuma indirildi.",
          });
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") {
            setOllamaStatus({
              ...status,
              message: "Dosya seçimi iptal edildi.",
            });
          } else {
            setOllamaStatus({
              ...status,
              message: "Ollama kurulum dosyası indirilemedi.",
            });
          }
        } finally {
          setIsDownloadingOllama(false);
        }
      }
    } catch {
      setOllamaStatus({
        available: false,
        serviceRunning: false,
        models: [],
        message: "Backend'e ulaşılamadı.",
      });
    } finally {
      setIsCheckingOllama(false);
    }
  };

  return (
    <section className="settings-page" aria-labelledby="settings-title">
      <div className="settings-shell">
        <header className="settings-header">
          <button type="button" className="settings-back" onClick={onBack}>
            ← Geri
          </button>
          <div>
            <p className="settings-eyebrow">Sistem yapılandırması</p>
            <h1 id="settings-title">Ayarlar</h1>
            <p>Redmine ve yapay zekâ sağlayıcısı bağlantılarını yapılandır.</p>
          </div>
        </header>

        <div className="settings-card">
          <div className="settings-card-heading">
            <span className="settings-card-icon" aria-hidden="true">
              ⚙
            </span>
            <div>
              <h2>Bağlantı ayarları</h2>
              <p>Aktif sağlayıcıya ait model kullanılır.</p>
            </div>
          </div>

          <div className="settings-form">
            <label className="settings-field">
              <span>Redmine token</span>
              <div className="secret-input">
                <input
                  type={showSecrets ? "text" : "password"}
                  value={settings.redmineToken || ""}
                  onChange={(e) =>
                    updateSetting("redmineToken", e.target.value)
                  }
                  placeholder="Redmine API token"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowSecrets((value) => !value)}
                >
                  {showSecrets ? "Gizle" : "Göster"}
                </button>
              </div>
            </label>

            <div className="provider-settings">
              <label className="settings-field">
                <span>Uyandırma kelimesi</span>
                <input
                  value={settings.wakeWord || ""}
                  onChange={(e) => updateSetting("wakeWord", e.target.value)}
                  placeholder="asistan"
                  autoComplete="off"
                />
              </label>

              <label className="settings-field">
                <span>Kapatma kelimesi</span>
                <input
                  value={settings.deadWord || ""}
                  onChange={(e) => updateSetting("deadWord", e.target.value)}
                  placeholder="kapat"
                  autoComplete="off"
                />
              </label>
            </div>

            <fieldset className="provider-fieldset">
              <legend>Aktif provider</legend>
              <div className="provider-options">
                <label
                  className={
                    settings.activeProvider === "gemini" ? "selected" : ""
                  }
                >
                  <input
                    type="radio"
                    name="provider"
                    checked={settings.activeProvider === "gemini"}
                    onChange={() => updateSetting("activeProvider", "gemini")}
                  />
                  <strong>Gemini</strong>
                  <small>Google Gemini API</small>
                </label>
                <label
                  className={
                    settings.activeProvider === "llama" ? "selected" : ""
                  }
                >
                  <input
                    type="radio"
                    name="provider"
                    checked={settings.activeProvider === "llama"}
                    onChange={() => updateSetting("activeProvider", "llama")}
                  />
                  <strong>Llama</strong>
                  <small>Yerel Ollama servisi</small>
                </label>
                <label
                  className={
                    settings.activeProvider === "openai" ? "selected" : ""
                  }
                >
                  <input
                    type="radio"
                    name="provider"
                    checked={settings.activeProvider === "openai"}
                    onChange={() => updateSetting("activeProvider", "openai")}
                  />
                  <strong>OpenAI / ChatGPT</strong>
                  <small>OpenAI API</small>
                </label>
              </div>
            </fieldset>

            {settings.activeProvider === "gemini" && (
              <div className="provider-settings">
                <label className="settings-field">
                  <span>Gemini API key</span>
                  <input
                    type={showSecrets ? "text" : "password"}
                    value={settings.geminiApiKey || ""}
                    onChange={(e) =>
                      updateSetting("geminiApiKey", e.target.value)
                    }
                    placeholder="AIza..."
                    autoComplete="off"
                  />
                </label>
                <label className="settings-field">
                  <span>Gemini model</span>
                  <select
                    value={settings.geminiModel || ""}
                    onChange={(e) =>
                      updateSetting("geminiModel", e.target.value)
                    }
                  >
                    <option value="">Model seç</option>
                    <option value="gemini-2.5-flash-lite">
                      gemini-2.5-flash-lite
                    </option>
                    <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                    <option value="gemini-2.5-pro">gemini-2.5-pro</option>
                    <option value="gemini-2.0-flash">gemini-2.0-flash</option>
                  </select>
                </label>
              </div>
            )}

            {settings.activeProvider === "llama" && (
              <div className="provider-settings">
                <label className="settings-field">
                  <span>Ollama modeli</span>
                  <input
                    value={settings.ollamaModel || ""}
                    onChange={(e) =>
                      updateSetting("ollamaModel", e.target.value)
                    }
                    placeholder="llama3.1:8b"
                    autoComplete="off"
                  />
                </label>
                <div className="ollama-info">
                  <strong>Model seçimi gerekmiyor</strong>
                  <p>
                    Backend, bilgisayarda kullanılabilir olan Llama/Ollama
                    kurulumunu kullanacak.
                  </p>
                </div>
                <div className="ollama-check">
                  <button
                    type="button"
                    onClick={() => void handleCheckOllama()}
                    disabled={isCheckingOllama || isDownloadingOllama}
                  >
                    {isDownloadingOllama
                      ? "İndiriliyor..."
                      : isCheckingOllama
                        ? "Kontrol ediliyor..."
                        : "Llama kurulumunu kontrol et"}
                  </button>
                  {ollamaStatus && (
                    <p className={ollamaStatus.available ? "success" : "error"}>
                      {ollamaStatus.message}
                      {ollamaStatus.models.length > 0
                        ? ` (${ollamaStatus.models.length} yerel model)`
                        : ""}
                    </p>
                  )}
                </div>
              </div>
            )}

            {settings.activeProvider === "openai" && (
              <div className="provider-settings">
                <label className="settings-field">
                  <span>OpenAI API key</span>
                  <input
                    type={showSecrets ? "text" : "password"}
                    value={settings.openAiApiKey || ""}
                    onChange={(e) =>
                      updateSetting("openAiApiKey", e.target.value)
                    }
                    placeholder="sk-..."
                    autoComplete="off"
                  />
                </label>
                <label className="settings-field">
                  <span>OpenAI modeli</span>
                  <input
                    value={settings.openAiModel || ""}
                    onChange={(e) =>
                      updateSetting("openAiModel", e.target.value)
                    }
                    placeholder="Örn. gpt-4o-mini"
                  />
                </label>
              </div>
            )}
          </div>
        </div>

        {validationMessage && (
          <div 
          className={`settings-notice ${noticeType}`} role="status">
            {validationMessage}
          </div>
        )}
        <div className="settings-footer">
          <button type="button" className="settings-reset" onClick={onReset}>
            Varsayılanlara dön
          </button>
          <button
            type="button"
            className="settings-apply"
            onClick={async () => (await handleCheckSettings()) ? await handleUpdate() : await handleCreate()}
          >
            Ayarları doğrula
          </button>
        </div>
      </div>
    </section>
  );
}
