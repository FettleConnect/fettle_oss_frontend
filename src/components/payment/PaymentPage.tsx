import React, { useState } from 'react';
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import axios from "axios";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CreditCard, X, Shield, CheckCircle, Loader2, ArrowLeft, ArrowRight } from 'lucide-react';
import { CONSULTATION_PRICE } from '@/types/dermatology';
import { BASE_URL } from '@/base_url';
import CheckoutForm from './CheckoutForm';

const stripePromise = loadStripe("pk_test_51NL6PWSGW2ceGOqN7dWFBSrkr0Wlyxy4yZQ6kgjrCE3Bcu9hcr3BMNgATRlTf8tah3ItroHgoMDicHxemOs5AuN0003tZ0lBE8");

interface PaymentPageProps {
  onPaymentSuccess: () => void;
  onCancel: () => void;
}

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

type Step = 'info' | 'billing' | 'checkout';

export const PaymentPage: React.FC<PaymentPageProps> = ({ onPaymentSuccess, onCancel }) => {
  const [step, setStep] = useState<Step>('info');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Billing details state (pre-filled with test data)
  const [billingDetails, setBillingDetails] = useState<BillingDetails>({
    name: "Test Customer",
    address: {
      line1: "Test Address",
      city: "Mumbai",
      state: "MH",
      postal_code: "400001",
      country: "IN",
    },
  });

  const handleGoToBilling = () => {
    setStep('billing');
  };

  const handleProceedToCheckout = async () => {
    setLoading(true);
    setError(null);

    try {
      const authToken = localStorage.getItem('authToken');
      const response = await axios.post(`${BASE_URL}:8000/api/create-payment-intent/`, {
        amount: CONSULTATION_PRICE * 100, // Convert to pence
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
      }, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      setClientSecret(response.data.clientSecret);
      setStep('checkout');
    } catch (err) {
      console.error("Error creating payment intent:", err);
      setError("Failed to initialize payment. Please check your connection or try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleBackToInfo = () => {
    setStep('info');
  };

  const handleBackToBilling = () => {
    setStep('billing');
    setClientSecret(null);
  };

  const updateBillingField = (field: string, value: string) => {
    if (field === 'name') {
      setBillingDetails(prev => ({ ...prev, name: value }));
    } else {
      setBillingDetails(prev => ({
        ...prev,
        address: { ...prev.address, [field]: value }
      }));
    }
  };

  // Step 3: Show Stripe checkout form
  if (step === 'checkout' && clientSecret) {
    return (
      <div className="flex items-center justify-center min-h-full p-4 bg-muted/30">
        <Card className="w-full max-w-md">
          <CardHeader>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleBackToBilling}
              className="w-fit -ml-2 mb-2"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <CardTitle>Complete Payment</CardTitle>
            <CardDescription>
              Enter your card details below
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <Elements
              stripe={stripePromise}
              options={{ 
                clientSecret,
                appearance: {
                  theme: 'stripe',
                },
              }}
            >
              <CheckoutForm 
                onSuccess={onPaymentSuccess} 
                onCancel={onCancel}
                billingDetails={billingDetails}
              />
            </Elements>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Step 2: Billing details form
  if (step === 'billing') {
    return (
      <div className="flex items-center justify-center min-h-full p-4 bg-muted/30">
        <Card className="w-full max-w-md">
          <CardHeader>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleBackToInfo}
              className="w-fit -ml-2 mb-2"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <CardTitle>Billing Details</CardTitle>
            <CardDescription>
              Please fill in your billing information
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={billingDetails.name}
                onChange={(e) => updateBillingField('name', e.target.value)}
                placeholder="Enter your full name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="line1">Address</Label>
              <Input
                id="line1"
                value={billingDetails.address.line1}
                onChange={(e) => updateBillingField('line1', e.target.value)}
                placeholder="Street address"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={billingDetails.address.city}
                  onChange={(e) => updateBillingField('city', e.target.value)}
                  placeholder="City"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={billingDetails.address.state}
                  onChange={(e) => updateBillingField('state', e.target.value)}
                  placeholder="State"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="postal_code">Postal Code</Label>
                <Input
                  id="postal_code"
                  value={billingDetails.address.postal_code}
                  onChange={(e) => updateBillingField('postal_code', e.target.value)}
                  placeholder="Postal code"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  value={billingDetails.address.country}
                  onChange={(e) => updateBillingField('country', e.target.value)}
                  placeholder="Country code (e.g., IN)"
                />
              </div>
            </div>

            {/* Error message */}
            {error && (
              <p className="text-sm text-red-600 text-center">{error}</p>
            )}

            {/* Buttons */}
            <div className="space-y-3 pt-2">
              <Button 
                onClick={handleProceedToCheckout} 
                className="w-full"
                size="lg"
                disabled={loading || !billingDetails.name || !billingDetails.address.line1}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    Proceed to Checkout
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
              
              <Button 
                onClick={onCancel} 
                variant="outline" 
                className="w-full"
                disabled={loading}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Step 1: Payment info page
  return (
    <div className="flex items-center justify-center min-h-full p-4 bg-muted/30">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-2">
            <CreditCard className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Dermatologist Consultation</CardTitle>
          <CardDescription>
            Get a professional review from a board-certified dermatologist
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Price */}
          <div className="text-center">
            <span className="text-4xl font-bold text-foreground">£{CONSULTATION_PRICE}</span>
            <span className="text-muted-foreground ml-1">one-time</span>
          </div>

          {/* Features */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span>Board-certified dermatologist review</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span>Personalized assessment & recommendations</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span>Secure & confidential consultation</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span>Response within 24-48 hours</span>
            </div>
          </div>

          {/* Security badge */}
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg py-2">
            <Shield className="h-3.5 w-3.5" />
            <span>Secure payment processing</span>
          </div>

          {/* Payment buttons */}
          <div className="space-y-3">
            <Button 
              onClick={handleGoToBilling} 
              className="w-full"
              size="lg"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Pay £{CONSULTATION_PRICE}
            </Button>
            
            <Button 
              onClick={onCancel} 
              variant="outline" 
              className="w-full"
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          </div>

        </CardContent>
      </Card>
    </div>
  );
};
