import axios, { AxiosError } from "axios";

type BackendErrorResponse = {
  message?: string;
  error?: string;
  detail?: string;
  title?: string;
  errors?: Record<string, string[]>;
};

export type UiErrorResult = {
  title: string;
  message: string;
  status?: number;
};

const getValidationMessage = (
  errors?: Record<string, string[]>,
): string | null => {
  if (!errors) return null;

  const messages = Object.values(errors).flat();

  return messages.length > 0 ? messages.join(" ") : null;
};

const handleBadRequest = (
  data?: BackendErrorResponse,
): UiErrorResult => {
  const validationMessage = getValidationMessage(data?.errors);

  return {
    title: "Geçersiz istek",
    message:
      validationMessage ||
      data?.message ||
      data?.detail ||
      data?.error ||
      "Gönderilen bilgiler geçerli değil.",
    status: 400,
  };
};

const handleUnauthorized = (): UiErrorResult => ({
  title: "Oturum geçersiz",
  message: "Oturum süreniz dolmuş olabilir. Lütfen yeniden giriş yapın.",
  status: 401,
});

const handleForbidden = (): UiErrorResult => ({
  title: "Yetkisiz işlem",
  message: "Bu işlemi gerçekleştirmek için yetkiniz bulunmuyor.",
  status: 403,
});

const handleNotFound = (
  data?: BackendErrorResponse,
): UiErrorResult => ({
  title: "Kayıt bulunamadı",
  message:
    data?.message ||
    data?.detail ||
    "İstenen kayıt veya servis bulunamadı.",
  status: 404,
});

const handleConflict = (
  data?: BackendErrorResponse,
): UiErrorResult => ({
  title: "İşlem çakışması",
  message:
    data?.message ||
    data?.detail ||
    "Bu işlem mevcut verilerle çakışıyor.",
  status: 409,
});

const handleValidationError = (
  data?: BackendErrorResponse,
): UiErrorResult => ({
  title: "Bilgileri kontrol edin",
  message:
    getValidationMessage(data?.errors) ||
    data?.message ||
    data?.detail ||
    "Bazı alanlar geçerli değil.",
  status: 422,
});

const handleTooManyRequests = (): UiErrorResult => ({
  title: "Çok fazla istek",
  message: "Kısa sürede çok fazla işlem yaptınız. Biraz bekleyip tekrar deneyin.",
  status: 429,
});

const handleServerError = (
  data?: BackendErrorResponse,
): UiErrorResult => ({
  title: "Sunucu hatası",
  message:
    data?.message ||
    data?.detail ||
    "Sunucuda beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.",
  status: 500,
});

const handleNetworkError = (): UiErrorResult => ({
  title: "Bağlantı hatası",
  message:
    "Backend servisine ulaşılamadı. İnternet bağlantısını ve backend'in çalıştığını kontrol edin.",
});

const handleTimeoutError = (): UiErrorResult => ({
  title: "İstek zaman aşımına uğradı",
  message: "İşlem beklenenden uzun sürdü. Lütfen tekrar deneyin.",
});

const handleCancelledRequest = (): UiErrorResult => ({
  title: "İşlem durduruldu",
  message: "İstek kullanıcı tarafından iptal edildi.",
});

const handleUnknownError = (): UiErrorResult => ({
  title: "Beklenmeyen hata",
  message: "İşlem sırasında beklenmeyen bir hata oluştu.",
});

export const handleApiError = (error: unknown): UiErrorResult => {
  if (axios.isCancel(error)) {
    return handleCancelledRequest();
  }

  if (!axios.isAxiosError(error)) {
    return handleUnknownError();
  }

  const axiosError = error as AxiosError<BackendErrorResponse>;

  if (
    axiosError.code === "ECONNABORTED" ||
    axiosError.code === "ETIMEDOUT"
  ) {
    return handleTimeoutError();
  }

  if (!axiosError.response) {
    return handleNetworkError();
  }

  const { status, data } = axiosError.response;

  switch (status) {
    case 400:
      return handleBadRequest(data);

    case 401:
      return handleUnauthorized();

    case 403:
      return handleForbidden();

    case 404:
      return handleNotFound(data);

    case 409:
      return handleConflict(data);

    case 422:
      return handleValidationError(data);

    case 429:
      return handleTooManyRequests();

    default:
      if (status >= 500) {
        return handleServerError(data);
      }

      return {
        title: "İşlem başarısız",
        message:
          data?.message ||
          data?.detail ||
          data?.error ||
          `İşlem tamamlanamadı. HTTP durum kodu: ${status}`,
        status,
      };
  }
};