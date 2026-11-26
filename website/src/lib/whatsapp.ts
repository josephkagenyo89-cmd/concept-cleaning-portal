const PHONE = "254796563741";

export const whatsappLink = (message: string) =>
  `https://wa.me/${PHONE}?text=${encodeURIComponent(message)}`;

export const bookingConfirmationMessage = (data: {
  name: string;
  phone: string;
  service: string;
  location: string;
  date: string;
}) =>
  `Hello Concept Cleaning Services, I have made a booking.\n\nBooking Details:\nName: ${data.name}\nPhone: ${data.phone}\nService: ${data.service}\nLocation: ${data.location}\nDate: ${data.date}\n\nPlease confirm my booking.`;

export const adminBookingAlert = (data: {
  name: string;
  phone: string;
  service: string;
  location: string;
  date: string;
}) =>
  `New Booking Received:\nName: ${data.name}\nPhone: ${data.phone}\nService: ${data.service}\nLocation: ${data.location}\nDate: ${data.date}`;

export const invoiceWhatsappMessage = (data: {
  clientName: string;
  amount: number;
  invoiceNumber: string;
}) =>
  `Hello ${data.clientName}, here is your invoice from Concept Cleaning Services.\n\nAmount: KES ${data.amount.toLocaleString()}\nInvoice Number: ${data.invoiceNumber}\n\nThank you for choosing us.`;
