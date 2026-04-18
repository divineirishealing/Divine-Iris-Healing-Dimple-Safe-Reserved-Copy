import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { ManualPaymentProofBody } from '../components/dashboard/ManualPaymentProofBody';

const ManualPaymentPage = () => {
  const { enrollmentId } = useParams();
  const navigate = useNavigate();

  return (
    <>
      <Header />
      <ManualPaymentProofBody
        enrollmentId={enrollmentId}
        variant="page"
        onBack={() => navigate(-1)}
        onSubmitted={() => navigate('/')}
      />
      <Footer />
    </>
  );
};

export default ManualPaymentPage;
