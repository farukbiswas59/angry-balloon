import { fileURLToPath } from 'node:url';
import { defineConfig,loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const root=fileURLToPath(new URL('.',import.meta.url));
export default defineConfig(({mode})=>{
  const env=loadEnv(mode,root,'');
  const server=process.env.NEXT_PUBLIC_GAME_SERVER_URL||env.NEXT_PUBLIC_GAME_SERVER_URL;
  if(!server||!/^https:\/\/[^/]+$/.test(server))throw Error('Mobile builds need NEXT_PUBLIC_GAME_SERVER_URL set to the backend HTTPS origin (no trailing slash).');
  return {
    root:fileURLToPath(new URL('./mobile',import.meta.url)),
    publicDir:fileURLToPath(new URL('./public',import.meta.url)),
    plugins:[react()],
    resolve:{alias:{'@':root}},
    define:{'process.env.NEXT_PUBLIC_GAME_SERVER_URL':JSON.stringify(server)},
    build:{outDir:fileURLToPath(new URL('./mobile-dist',import.meta.url)),emptyOutDir:true},
  };
});
