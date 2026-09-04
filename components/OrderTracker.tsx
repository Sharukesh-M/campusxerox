'use client';

import { OrderStatus, PaymentStatus } from '@/types';

const STATUS_STEPS = [
  { key: 'PAYMENT_SUBMITTED', label: 'Payment Submitted' },
  { key: 'PAYMENT_VERIFIED', label: 'Payment Verified' },
  { key: 'ACCEPTED', label: 'Order Accepted' },
  { key: 'READY_FOR_PICKUP', label: 'Ready for Pickup' },
  { key: 'COMPLETED', label: 'Completed' },
];

interface OrderTrackerProps {
  orderStatus: string;
  paymentStatus: string;
}

function getCompletedStepIndex(orderStatus: string, paymentStatus: string): number {
  if (orderStatus === 'COMPLETED') return 4;
  if (orderStatus === 'READY_FOR_PICKUP') return 3;
  if (orderStatus === 'ACCEPTED' || orderStatus === 'PRINTING') return 2;
  if (paymentStatus === 'PAYMENT_VERIFIED') return 1;
  if (paymentStatus === 'PAYMENT_SUBMITTED' || orderStatus === 'PAYMENT_SUBMITTED') return 0;
  return -1;
}

export default function OrderTracker({ orderStatus, paymentStatus }: OrderTrackerProps) {
  const isRejected = orderStatus === OrderStatus.REJECTED || paymentStatus === PaymentStatus.REJECTED;
  const isCancelled = orderStatus === OrderStatus.CANCELLED;
  const completedIndex = getCompletedStepIndex(orderStatus, paymentStatus);

  if (isRejected) {
    return (
      <div className="bg-danger-50 border border-danger-500/20 rounded-xl p-4 text-center">
        <div className="text-danger-600 font-semibold text-lg">
          {paymentStatus === PaymentStatus.REJECTED ? 'Payment Rejected' : 'Order Rejected'}
        </div>
        <p className="text-sm text-danger-500 mt-1">
          {paymentStatus === PaymentStatus.REJECTED
            ? 'Please resubmit your payment proof.'
            : 'This order has been rejected by the admin.'}
        </p>
      </div>
    );
  }

  if (isCancelled) {
    return (
      <div className="bg-surface-100 border border-surface-300 rounded-xl p-4 text-center">
        <div className="text-surface-500 font-semibold text-lg">Order Cancelled</div>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {STATUS_STEPS.map((step, index) => {
        const isCompleted = index <= completedIndex;
        const isCurrent = index === completedIndex;

        return (
          <div key={step.key} className="flex items-start gap-3">
            {/* Vertical line + circle */}
            <div className="flex flex-col items-center">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  isCompleted
                    ? 'bg-primary-600 text-white'
                    : 'bg-surface-200 text-surface-400'
                } ${isCurrent ? 'ring-2 ring-primary-300 ring-offset-2' : ''}`}
              >
                {isCompleted ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span className="w-2 h-2 rounded-full bg-surface-300" />
                )}
              </div>
              {index < STATUS_STEPS.length - 1 && (
                <div
                  className={`w-0.5 h-8 ${
                    index < completedIndex ? 'bg-primary-600' : 'bg-surface-200'
                  }`}
                />
              )}
            </div>

            {/* Label */}
            <div className={`pt-1 ${isCurrent ? 'font-semibold text-primary-700' : isCompleted ? 'text-surface-700' : 'text-surface-400'}`}>
              <span className="text-sm">{step.label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
