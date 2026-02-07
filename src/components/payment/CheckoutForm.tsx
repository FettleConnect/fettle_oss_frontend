import { PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CreditCard, Loader2, User, MapPin } from "lucide-react";
import { CONSULTATION_PRICE } from "@/types/dermatology";

interface BillingDetails {
  name: string;
  address: {
    line1: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  };
}

interface CheckoutFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  billingDetails?: BillingDetails;
}

export default function CheckoutForm({ onSuccess, onCancel, billingDetails }: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setLoading(true);
    setError(null);

    const result = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/success`,
        payment_method_data: billingDetails ? {
          billing_details: {
            name: billingDetails.name,
            address: {
              line1: billingDetails.address.line1,
              city: billingDetails.address.city,
              state: billingDetails.address.state,
              postal_code: billingDetails.address.postal_code,
              country: billingDetails.address.country,
            },
          },
        } : undefined,
      },
      redirect: "if_required",
    });

    if (result.error) {
      setError(result.error.message || "Payment failed");
      setLoading(false);
    } else if (result.paymentIntent?.status === "succeeded") {
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Billing Details Summary */}
      {billingDetails && (
        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <h4 className="text-sm font-medium text-foreground">Billing Details</h4>
          <div className="space-y-1 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <User className="h-3.5 w-3.5" />
              <span>{billingDetails.name}</span>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="h-3.5 w-3.5 mt-0.5" />
              <span>
                {billingDetails.address.line1}, {billingDetails.address.city}, {billingDetails.address.state} {billingDetails.address.postal_code}, {billingDetails.address.country}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Card Details */}
      <div>
        <h4 className="text-sm font-medium text-foreground mb-3">Card Details</h4>
        <PaymentElement />
      </div>

      <div className="space-y-3 pt-2">
        <Button
          type="submit"
          disabled={!stripe || !elements || loading}
          className="w-full"
          size="lg"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processing…
            </>
          ) : (
            <>
              <CreditCard className="h-4 w-4 mr-2" />
              Pay £{CONSULTATION_PRICE}
            </>
          )}
        </Button>

        {/* Development Helper: Bypass Payment */}
        {process.env.NODE_ENV === 'development' && (
          <Button
            type="button"
            variant="ghost"
            className="w-full text-xs text-muted-foreground hover:text-green-600"
            onClick={onSuccess}
          >
            [DEV] Simulate Payment Success
          </Button>
        )}

        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={loading}
          className="w-full"
        >
          Cancel
        </Button>
      </div>

      {error && (
        <p className="text-sm text-red-600 text-center">{error}</p>
      )}
    </form>
  );
}
