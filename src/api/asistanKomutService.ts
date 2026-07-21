import { apiClient } from './apiClient'

// bu dosya python içerisinden gelen asistan yanıtlarını göstermek için kullanılacak.
// yani değiştirilecek 

export type CreateAsistanSendRequest = {
  AsistanYanit: string
  YanitTuru: string
  KomutId: number | null
}

export type AsistanSendResponse = {
  id?: number
  asistanYanit?: string
  yanitTuru?: string
  createdAt?: string
  updatedAt?: string
  komutId?: number | null
}

export const createPendingAsistanSend = async (
  asistanYanit: string,
  komutId: number | null = null
) => {
  const payload: CreateAsistanSendRequest = {
    AsistanYanit: asistanYanit,
    YanitTuru: 'PENDING',
    KomutId: komutId,
  }

  const response = await apiClient.post<AsistanSendResponse>(
    'http://localhost:5131/Api/AsistanYanit/send-asistan-komut',
    payload
  )

  return response.data
}