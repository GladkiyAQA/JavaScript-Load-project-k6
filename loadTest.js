import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';

// Конфиги
import { endpoints } from './config/endpoints.js';
import { headers } from './config/headers.js';

// Сценарии
import { steadyLoad } from './scenarios/steadyLoad.js';
import { spikeTest } from './scenarios/spikeTest.js';
import { stressTest } from './scenarios/stressTest.js';
import { soakTest } from './scenarios/soakTest.js';
import { mixedLoad } from './scenarios/mixedLoad.js';

// Метрики
const requestCount = new Counter('http_requests');
const errorCount = new Counter('http_errors');
const requestTime = new Trend('http_req_duration', true);
const responseLength = new Trend('http_res_length', true);

// Храним данные о самом медленном запросе
let slowestRequest = { url: null, duration: 0 };
let errorRequests = [];

// Выбор сценария
export const options = steadyLoad; //меняем на нужный сценарий

export default function () {
  const baseUrl = __ENV.BASE_TEST_URL;
  if (!baseUrl) {
    throw new Error('BASE_URL не найден. Проверьте .env');
  }

  for (const endpoint of endpoints) {
    const url = `${baseUrl}${endpoint}`;
    const res = http.get(url, { headers });

    requestCount.add(1);
    requestTime.add(res.timings.duration);
    responseLength.add(res.body.length);

    if (res.timings.duration > slowestRequest.duration) {
      slowestRequest = { url, duration: res.timings.duration };
    }

    if (res.status !== 200) {
      errorCount.add(1);
      errorRequests.push({ url, status: res.status, duration: res.timings.duration });
    }

    console.log(
      `Request to: ${url}, Status: ${res.status}, Response time: ${res.timings.duration} ms`
    );

    check(res, {
      'status is 200': (r) => r.status === 200,
    });
  }

  sleep(1);
}

export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}
