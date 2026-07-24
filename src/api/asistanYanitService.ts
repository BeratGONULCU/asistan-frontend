import { apiClient } from './apiClient'

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
  const response = await apiClient.delete<boolean>(
    `/AsistanYanit/delete-session/${sessionId}`,
  )

  return response.data
}
