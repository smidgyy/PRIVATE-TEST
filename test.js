import { execSync } from 'child_process';
try {
  execSync('npx vite build', { env: { ...process.env, GEMINI_API_KEY: undefined } });
  console.log('Success');
} catch (e) {
  console.error('Failed');
}
