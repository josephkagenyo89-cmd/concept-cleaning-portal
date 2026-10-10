import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 50,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<3000'],
  },
};

const pages = [
  'https://www.conceptcleaningservices.co.ke/',
  'https://www.conceptcleaningservices.co.ke/marketplace',
  'https://www.conceptcleaningservices.co.ke/blog',
];

export default function () {
  const url = pages[(__ITER) % pages.length];
  const res = http.get(url);

  check(res, {
    'status is 200': (r) => r.status === 200,
    'HTML response received': (r) =>
      (r.headers['Content-Type'] || '').includes('text/html'),
  });

  sleep(1);
}
