'use client';

import axios from 'axios';
import { toast } from 'sonner';

const adminApiClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

adminApiClient.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('admin_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

adminApiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const { status, data } = error.response;
      const errorMessage = data?.message || data?.error || 'An unexpected error occurred.';
      
      if (status === 401) {
        toast.error('Authentication failed. Please log in again.');
        if (typeof window !== 'undefined') {
          localStorage.removeItem('admin_token');
          window.location.href = '/admin/login';
        }
      } else {
        toast.error(errorMessage);
      }
    } else if (error.request) {
      toast.error('No response from server. Please check your network connection.');
    } else {
      toast.error(error.message);
    }
    
    return Promise.reject(error);
  }
);

export default adminApiClient;
