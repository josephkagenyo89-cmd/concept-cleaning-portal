// @ts-nocheck
import { useState } from 'react';
import { X, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface ReferralFormProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ReferralForm({ isOpen, onClose }: ReferralFormProps) {
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    referrerName: '',
    referrerPhone: '',
    referrerMpesa: '',
    selectedService: '',
    clientName: '',
    clientPhone: '',
    additionalInfo: '',
  });

  // Load services on mount
  useState(() => {
    const loadServices = async () => {
      try {
        const { data, error } = await supabase
          .from('services')
          .select('id, name, base_price')
          .order('name')
          .limit(191);

        if (error) throw error;
        setServices(data || []);
      } catch (error) {
        console.error('Error loading services:', error);
        toast({ title: 'Error', description: 'Failed to load services', variant: 'destructive' });
      }
    };
    loadServices();
  }, []);

  const validatePhone = (phone: string): boolean => {
    const phoneRegex = /^(0|\+254)[0-9]{9}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
  };

  const calculateReward = (serviceName: string): number => {
    const match = serviceName?.trim().toLowerCase();
    const service = services.find(s => (s.name || '').toLowerCase() === match);
    if (!service) return 0;
    return service.base_price >= 7000 ? 1000 : 500;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.referrerName.trim()) {
      toast({ title: 'Error', description: 'Please enter your name' });
      return;
    }
    if (!validatePhone(formData.referrerPhone)) {
      toast({ title: 'Error', description: 'Please enter a valid phone number (0712XXXXXX or +254712XXXXXX)' });
      return;
    }
    if (!validatePhone(formData.referrerMpesa)) {
      toast({ title: 'Error', description: 'Please enter a valid M-Pesa number' });
      return;
    }
    if (!formData.selectedService) {
      toast({ title: 'Error', description: 'Please select a service' });
      return;
    }
    if (!formData.clientName.trim()) {
      toast({ title: 'Error', description: 'Please enter client name' });
      return;
    }
    if (!validatePhone(formData.clientPhone)) {
      toast({ title: 'Error', description: 'Please enter a valid client phone number' });
      return;
    }

    setLoading(true);

    try {
      const reward = calculateReward(formData.selectedService);
      const selectedServiceObj = services.find(s => (s.name || '').toLowerCase() === (formData.selectedService || '').trim().toLowerCase());

        const basePriceText = selectedServiceObj?.base_price ? `KES ${Number(selectedServiceObj.base_price).toLocaleString('en-KE')}` : 'N/A';

        const message = `
*NEW REFERRAL - Concept Cleaning Services*

*Referrer Information*
Name: ${formData.referrerName}
Phone: ${formData.referrerPhone}
M-Pesa: ${formData.referrerMpesa}

*Service Being Referred*
Service: ${formData.selectedService}
Base Price: ${basePriceText}
Referrer Reward: *KES ${reward}* (after service completion)

*Client Information*
Name: ${formData.clientName}
Phone: ${formData.clientPhone}

*Additional Information*
${formData.additionalInfo || 'None'}

---
Reward will be paid after the referred service is successfully completed.
      `.trim();

      // Open WhatsApp with pre-filled message
      const whatsappUrl = `https://wa.me/254796563741?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');

      // Clear form
      setFormData({
        referrerName: '',
        referrerPhone: '',
        referrerMpesa: '',
        selectedService: '',
        clientName: '',
        clientPhone: '',
        additionalInfo: '',
      });

      toast({ title: 'Success', description: 'WhatsApp message opened. Send it to complete your referral!' });
      
      // Close modal after a short delay
      setTimeout(() => onClose(), 1500);
    } catch (error) {
      console.error('Error:', error);
      toast({ title: 'Error', description: 'Failed to process referral' });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-blue-600 text-white p-4 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">💰 Refer & Earn</h2>
            <p className="text-sm opacity-90">Earn KES 500-1,000 per successful referral</p>
          </div>
          <button onClick={onClose} className="hover:bg-blue-700 p-2 rounded">
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-blue-50 border-l-4 border-blue-600 p-4 mb-4">
            <p className="text-sm text-blue-900">
              ✅ Earn <strong>KES 500</strong> for services under KES 7,000 or <strong>KES 1,000</strong> for services KES 7,000+
            </p>
            <p className="text-xs text-blue-800 mt-2">Reward paid after the referred service is successfully completed</p>
          </div>

          {/* Your Information */}
          <div className="border-t pt-4">
            <h3 className="font-bold text-lg mb-3">Your Information</h3>

            <div>
              <label className="block text-sm font-medium mb-1">Your Name *</label>
              <input
                type="text"
                value={formData.referrerName}
                onChange={(e) => setFormData({ ...formData, referrerName: e.target.value })}
                placeholder="John Kamau"
                className="w-full border rounded px-3 py-2"
              />
            </div>

            <div className="mt-3">
              <label className="block text-sm font-medium mb-1">Your Phone Number *</label>
              <input
                type="tel"
                value={formData.referrerPhone}
                onChange={(e) => setFormData({ ...formData, referrerPhone: e.target.value })}
                placeholder="0712345678 or +254712345678"
                className="w-full border rounded px-3 py-2"
              />
            </div>

            <div className="mt-3">
              <label className="block text-sm font-medium mb-1">Your M-Pesa Number *</label>
              <input
                type="tel"
                value={formData.referrerMpesa}
                onChange={(e) => setFormData({ ...formData, referrerMpesa: e.target.value })}
                placeholder="0712345678 or +254712345678"
                className="w-full border rounded px-3 py-2"
              />
            </div>
          </div>

          {/* Service & Client */}
          <div className="border-t pt-4">
            <h3 className="font-bold text-lg mb-3">Service & Client Details</h3>

            <div>
              <label className="block text-sm font-medium mb-1">Which Service Are You Referring? *</label>
              <input
                list="services-list"
                type="text"
                value={formData.selectedService}
                onChange={(e) => setFormData({ ...formData, selectedService: e.target.value })}
                placeholder="Type the service name"
                className="w-full border rounded px-3 py-2"
              />

              <datalist id="services-list">
                {services.map((service) => (
                  <option key={service.id} value={service.name} />
                ))}
              </datalist>
            </div>

            <div className="mt-3">
              <label className="block text-sm font-medium mb-1">Client's Name *</label>
              <input
                type="text"
                value={formData.clientName}
                onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                placeholder="Mary Wanjiku"
                className="w-full border rounded px-3 py-2"
              />
            </div>

            <div className="mt-3">
              <label className="block text-sm font-medium mb-1">Client's Phone Number *</label>
              <input
                type="tel"
                value={formData.clientPhone}
                onChange={(e) => setFormData({ ...formData, clientPhone: e.target.value })}
                placeholder="0722345678 or +254722345678"
                className="w-full border rounded px-3 py-2"
              />
            </div>
          </div>

          {/* Additional Info */}
          <div className="border-t pt-4">
            <label className="block text-sm font-medium mb-1">Additional Information</label>
            <textarea
              value={formData.additionalInfo}
              onChange={(e) => setFormData({ ...formData, additionalInfo: e.target.value })}
              placeholder="Service needed this weekend, customer has pets, etc."
              rows={3}
              className="w-full border rounded px-3 py-2"
            />
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-900 px-4 py-3 rounded font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded font-bold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Send size={18} />
              Submit via WhatsApp
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
