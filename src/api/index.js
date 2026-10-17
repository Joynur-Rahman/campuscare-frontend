// The single API the whole app imports — the live REST client for the FastAPI backend.
import { createRestApi } from './rest.js';

export const api = createRestApi();
