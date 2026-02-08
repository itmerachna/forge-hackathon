import { Opik } from 'opik';

let _opikClient: Opik | null = null;

export function isOpikConfigured(): boolean {
  return Boolean(process.env.OPIK_API_KEY);
}

export function getOpikClient(): Opik | null {
  if (!isOpikConfigured()) return null;

  if (!_opikClient) {
    _opikClient = new Opik({
      apiKey: process.env.OPIK_API_KEY,
      projectName: 'forge-ai-coach',
    });
  }
  return _opikClient;
}
