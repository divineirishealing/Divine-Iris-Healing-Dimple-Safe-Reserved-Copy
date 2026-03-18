import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardHeader, CardTitle, CardContent } from '../../ui/card';
import { Button } from '../../ui/button';
import { CreditCard, CheckCircle, Clock, AlertCircle } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const FinancialsPage = () => {
  const [financials, setFinancials] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // We fetch this via /api/student/home for now or dedicated endpoint
    // Let's assume we use /student/home to get basic data, or a new endpoint if detailed.
    // For now, let's hit /student/home
    axios.get(`${API}/api/student/home`, { withCredentials: true })
      .then(res => setFinancials(res.data.financials))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading...</div>;

  const statusColor = {
    'Paid': 'text-green-600 bg-green-50 border-green-200',
    'Due': 'text-red-600 bg-red-50 border-red-200',
    'EMI': 'text-blue-600 bg-blue-50 border-blue-200'
  }[financials?.status] || 'text-gray-600 bg-gray-50';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-serif font-bold text-gray-900">Financial Overview</h1>

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Current Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-sm text-gray-500">Program Status</p>
                <div className={`mt-1 px-3 py-1 rounded-full text-xs font-bold border inline-flex items-center gap-2 ${statusColor}`}>
                  {financials?.status === 'Paid' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                  {financials?.status || "No Active Plan"}
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Next Payment Due</p>
                <p className="text-lg font-bold text-gray-900">{financials?.next_due}</p>
              </div>
            </div>

            {financials?.emi_plan && (
              <div className="bg-gray-50 p-4 rounded-lg border">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                    <Clock size={16} className="text-[#5D3FD3]" />
                    {financials.emi_plan}
                  </h4>
                  <span className="text-xs text-gray-500">Active Plan</span>
                </div>
                {/* Progress Bar Placeholder */}
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden mt-3">
                  <div className="h-full bg-[#5D3FD3] w-1/3" />
                </div>
                <p className="text-[10px] text-gray-400 mt-1 text-right">3 of 12 Installments Paid</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-[#F3E8FF] border-[#5D3FD3] border-opacity-30">
          <CardHeader>
            <CardTitle className="text-[#5D3FD3]">Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full bg-[#5D3FD3] hover:bg-[#4c32b3]">
              <CreditCard size={16} className="mr-2" /> Pay Next Installment
            </Button>
            <Button variant="outline" className="w-full border-[#5D3FD3] text-[#5D3FD3] hover:bg-[#5D3FD3] hover:text-white">
              Upload Payment Proof
            </Button>
            <p className="text-[10px] text-[#5D3FD3]/70 text-center mt-2">
              Secure payments via Stripe or Razorpay.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-400 text-sm italic">
            No transaction history available yet.
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FinancialsPage;
