import axios, { AxiosInstance } from 'axios';

let instance: AxiosInstance | null = null;

export function getPaystackClient(): AxiosInstance {
  if (!instance) {
    instance = axios.create({
      baseURL: 'https://api.paystack.co',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
  }
  return instance;
}
