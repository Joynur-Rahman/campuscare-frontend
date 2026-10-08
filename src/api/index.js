// The single API the whole app imports. Mock (standalone) or live REST.
import { USE_MOCK } from './config.js';
import { createRestApi } from './rest.js';
import { createMockApi } from './mock.js';

export const api = USE_MOCK ? createMockApi() : createRestApi();
export const IS_MOCK = USE_MOCK;
