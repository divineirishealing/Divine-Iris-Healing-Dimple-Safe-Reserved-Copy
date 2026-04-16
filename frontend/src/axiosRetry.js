/**
 * Retry safe GETs through free-tier API restarts (502/503/504) and network blips.
 * Exponential backoff ~2–90s total — helps single-instance deploys without paid rolling updates.
 * Does not retry POST/PUT/PATCH (payments, enrollment, etc.).
 */
import axios from 'axios';

const MAX_GET_RETRIES = 6;
const RETRY_STATUSES = new Set([502, 503, 504]);

axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    if (!config || config.__retryCount >= MAX_GET_RETRIES) {
      return Promise.reject(error);
    }
    const method = (config.method || 'get').toLowerCase();
    if (method !== 'get') {
      return Promise.reject(error);
    }
    const status = error.response?.status;
    const retryable =
      RETRY_STATUSES.has(status) ||
      error.code === 'ERR_NETWORK' ||
      error.code === 'ECONNABORTED' ||
      error.message === 'Network Error';
    if (!retryable) {
      return Promise.reject(error);
    }
    config.__retryCount = (config.__retryCount || 0) + 1;
    const delayMs = Math.min(8000, 600 * 2 ** (config.__retryCount - 1));
    await new Promise((r) => setTimeout(r, delayMs));
    return axios(config);
  },
);
