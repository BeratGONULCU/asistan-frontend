import axios from 'axios'

export const apiClient = axios.create({
  baseURL: 'http://localhost:5131/Api',
  headers: {
    'Content-Type': 'application/json',
  },
})
