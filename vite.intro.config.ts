import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import tsconfigPaths from 'vite-tsconfig-paths';
export default defineConfig({plugins:[react(),tailwindcss(),tsconfigPaths()],server:{host:'127.0.0.1',port:5174,open:'/intro-preview.html'},build:{outDir:'dist/intro',rollupOptions:{input:'intro-preview.html'}}});
