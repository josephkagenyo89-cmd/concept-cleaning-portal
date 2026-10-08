import { describe, expect, it } from 'vitest';
import { buildAdminBookingNotificationBody } from './customerNotifications';

describe('buildAdminBookingNotificationBody', () => {
  it('includes the customer, service, time, address and total', () => {
    const body = buildAdminBookingNotificationBody({
      clientName: 'Mary Wanjiku',
      serviceName: 'Deep Cleaning',
      date: '2026-10-15',
      time: '10:30',
      location: 'Westlands, Nairobi',
      price: 3500,
    });

    expect(body).toContain('Mary Wanjiku');
    expect(body).toContain('Deep Cleaning');
    expect(body).toContain('10:30');
    expect(body).toContain('Westlands, Nairobi');
    expect(body).toContain('KES 3,500');
  });
});
