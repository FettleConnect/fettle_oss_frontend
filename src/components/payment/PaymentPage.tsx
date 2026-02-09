import React, { useState, useEffect } from 'react';
import axios from "axios";
import { PayPalButtons, usePayPalScriptReducer } from "@paypal/react-paypal-js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreditCard, X, Shield, CheckCircle, Loader2, ArrowLeft, AlertTriangle } from 'lucide-react';
import { CONSULTATION_PRICE } from '@/types/dermatology';
import { BASE_URL } from '@/base_url';

interface PaymentPageProps {
  onPaymentSuccess: () => void;
  onCancel: () => void;
}

type Step = 'info' | 'checkout';

export const PaymentPage: React.FC<PaymentPageProps> = ({ onPaymentSuccess, onCancel }) => {
  const [step, setStep] = useState<Step>('info');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [{ isPending, isResolved, isRejected }] = usePayPalScriptReducer();

  const handleGoToCheckout = () => {
    setStep('checkout');
  };

  const handleBackToInfo = () => {
    setStep('info');
  };

  const createOrder = async () => {
    try {
      const authToken = localStorage.getItem('authToken');
      const response = await axios.post(`${BASE_URL}:8000/api/create-payment-intent/`, {
        amount: CONSULTATION_PRICE,
      }, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      return response.data.orderID;
    } catch (err) {
      console.error("Error creating order:", err);
      setError("Failed to initialize PayPal order.");
      throw err;
    }
  };

  const onApprove = async (data: any) => {
    setLoading(true);
    try {
      const authToken = localStorage.getItem('authToken');
      const response = await axios.post(`${BASE_URL}:8000/api/capture_payment/`, {
        orderID: data.orderID,
      }, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (response.data.status === 'COMPLETED') {
        onPaymentSuccess();
      } else {
        throw new Error("Payment not completed");
      }
    } catch (err) {
      console.error("Error capturing payment:", err);
      setError("Failed to capture PayPal payment.");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Show PayPal buttons
  if (step === 'checkout') {
    const sdkFailed = isRejected;
    
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
            <CardTitle>Complete Payment</CardTitle>
            <CardDescription>
              Pay securely with PayPal or Debit/Credit Card
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-md text-center">
                {error}
              </div>
            )}

            {sdkFailed ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-center space-y-3 text-left">
                <div className="flex justify-center text-amber-600">
                  <AlertTriangle className="h-8 w-8" />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-amber-900 text-center">PayPal SDK Blocked</p>
                  <p className="text-xs text-amber-700 leading-relaxed">
                    The payment gateway is being blocked by your browser's security settings. 
                  </p>
                  <div className="bg-white/50 p-2 rounded border border-amber-100 text-[10px] space-y-1">
                    <p className="font-bold text-amber-800 uppercase tracking-wider">Edge Browser Fix:</p>
                    <ul className="list-disc pl-4 space-y-0.5 text-amber-800">
                      <li>Use <strong>InPrivate Window</strong> (fastest fix)</li>
                      <li>Go to <code className="bg-amber-100 px-1">edge://settings/content/cookies</code></li>
                      <li>Toggle <strong>"Block third-party cookies"</strong> to <strong>Off</strong></li>
                      <li>Add <code className="bg-amber-100 px-1">paypal.com</code> to the <strong>Allow</strong> list</li>
                    </ul>
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative z-0 min-h-[150px]">
                {isPending && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                )}
                <PayPalButtons 
                  style={{ layout: "vertical" }}
                  createOrder={createOrder}
                  onApprove={onApprove}
                  disabled={loading}
                />
              </div>
            )}

            {loading && (
              <div className="flex flex-col items-center justify-center py-4 gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Verifying payment...</p>
              </div>
            )}

            {/* Development Helper: Bypass Payment */}
            <div className="pt-2">
              <Button
                type="button"
                variant={sdkFailed ? "default" : "ghost"}
                className={sdkFailed ? "w-full" : "w-full text-xs text-muted-foreground hover:text-green-600"}
                onClick={onPaymentSuccess}
              >
                {sdkFailed ? "Bypass Payment (Dev Mode)" : "[DEV] Simulate PayPal Success"}
              </Button>
              {sdkFailed && (
                <p className="text-[10px] text-center text-muted-foreground mt-2 italic">
                  Since the SDK is blocked, use this button to proceed with testing.
                </p>
              )}
            </div>

            <Button 
              onClick={onCancel} 
              variant="outline" 
              className="w-full"
              disabled={loading}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
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
            <span className="text-4xl font-bold text-foreground">₹{CONSULTATION_PRICE}</span>
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
            <span>Secure payment processing via PayPal (INR)</span>
          </div>

          {/* Payment buttons */}
          <div className="space-y-3">
            <Button 
              onClick={handleGoToCheckout} 
              className="w-full"
              size="lg"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Pay ₹{CONSULTATION_PRICE}
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
