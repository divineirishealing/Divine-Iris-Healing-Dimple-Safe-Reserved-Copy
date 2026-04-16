/**
 * Retry safe GETs briefly after deploy blips (502/503/504) or transient network errors.
 * Does not retry POST/PUT/PATCH (payments, enrollment, etc.).
 */
import axios from 'axios';

const MAX_GET_RETRIES = 2;
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
      error.message === 'Network Error';
    if (!retryable) {
      return Promise.reject(error);
    }
    config.__retryCount = (config.__retryCount || 0) + 1;
    const delayMs = 400 * config.__retryCount;
    await new Promise((r) => setTimeout(r, delayMs));
    return axios(config);
  },
);
