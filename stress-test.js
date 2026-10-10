import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 5,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<3000'],
  },
};

export default function () {
  const res = http.get('https://www.conceptcleaningservices.co.ke/');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'HTML response received': (r) =>
      (r.headers['Content-Type'] || '').includes('text/html'),
  });
  sleep(1);
}
