import {apiClient} from "./apiClient";

export type AsistanCheckResponse = {
  ok: boolean;
};

export const checkSession = async () => {

  const response = await apiClient.post<AsistanCheckResponse>(
    "/AsistanChat/checkSession"
  );

  if(!response.data.ok){
    return false;
  }

  return true;
};
