import {apiClient} from './apiClient';

export type AsistanCancelResponse = {
  ok: boolean;
  message: string;
  killedPids: number[];
};


export const cancelSession = async () => {

  const response = await apiClient.post<AsistanCancelResponse>(
    "/AsistanChat/cancelSession"
  );

  if(!response.data.ok){
    throw new Error(response.data.message || "Session cancellation failed.");
  }

  return response.data;
};
