/**
 * BOOKING AGENT FLOW WRAPPER
 * Manages the conversation → photo upload → service selection flow
 */

import { useState } from 'react';
import BookingAgentDialogue from './BookingAgentDialogue';
import BookingAgentPhotoUpload from './BookingAgentPhotoUpload';

type FlowStep = 'dialogue' | 'photos' | 'complete';

interface BookingAgentFlowProps {
  userId: string;
  onServiceSelected: (serviceId: string, requestId: string) => void;
  onCancel: () => void;
}

export default function BookingAgentFlow({
  userId,
  onServiceSelected,
  onCancel,
}: BookingAgentFlowProps) {
  const [currentStep, setCurrentStep] = useState<FlowStep>('dialogue');
  const [requestId, setRequestId] = useState<string | null>(null);
  const [photoReason, setPhotoReason] = useState<string>('required');
  const [requestItemId, setRequestItemId] = useState<string | null>(null);

  const handlePhotosRequired = (reqId: string, reason: string) => {
    setRequestId(reqId);
    setPhotoReason(reason);
    setCurrentStep('photos');
  };

  const handlePhotoUploadComplete = () => {
    // After photos are uploaded, we can proceed to service questions
    // The request is already created with photos attached
    if (requestId) {
      setCurrentStep('complete');
      // onServiceSelected will be called by the parent after this
    }
  };

  const handleCancel = () => {
    if (currentStep === 'photos') {
      setCurrentStep('dialogue');
    } else {
      onCancel();
    }
  };

  return (
    <div className="space-y-4">
      {currentStep === 'dialogue' && (
        <BookingAgentDialogue
          userId={userId}
          onServiceSelected={onServiceSelected}
          onPhotosRequired={handlePhotosRequired}
        />
      )}

      {currentStep === 'photos' && requestId && (
        <BookingAgentPhotoUpload
          requestId={requestId}
          requestItemId={requestItemId || undefined}
          userId={userId}
          reason={photoReason}
          onComplete={handlePhotoUploadComplete}
          onCancel={handleCancel}
        />
      )}

      {currentStep === 'complete' && requestId && (
        <div className="rounded-lg bg-green-50 p-4 text-center">
          <p className="text-sm font-medium text-green-900">
            ✓ Ready to proceed! Your request is being prepared.
          </p>
          <p className="mt-1 text-xs text-green-700">
            Request ID: {requestId.substring(0, 8)}...
          </p>
        </div>
      )}
    </div>
  );
}
