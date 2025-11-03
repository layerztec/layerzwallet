import { Redirect } from 'expo-router';
import React from 'react';

const SendIndex: React.FC = () => {
  // Entry point for send flow - redirect to address screen
  return <Redirect href="/send/send-address" />;
};

export default SendIndex;
