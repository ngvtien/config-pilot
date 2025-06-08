// import { defineConfig } from 'vite'
// import react from '@vitejs/plugin-react'
// import tailwindcss from '@tailwindcss/vite'

// // https://vite.dev/config/
// export default defineConfig({
//   plugins: [
//     react(),
//     tailwindcss(),
//   ],
//   base: './',
//   build: {
//     outDir: 'dist-react',
//   },
//   server: {
//     port: 5125,
//     strictPort: true,
//   },
// })



import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createHtmlPlugin } from 'vite-plugin-html'
import path from 'path'
// import tailwindcss from "@tailwindcss/vite"

// https://vite.dev/config/
export default defineConfig({
  optimizeDeps: {
    include: ['@emotion/react', 'tailwindcss'],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  plugins: [
    react(),
    // tailwindcss(),
    createHtmlPlugin({
      inject: {
        data: {
          cspPolicy: process.env.NODE_ENV === "development"
            ? `
              default-src 'self';
              script-src 'self' 'unsafe-inline' http://localhost:5125;
              style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
              style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com;
              font-src 'self' https://fonts.gstatic.com;
              img-src 'self' data:;
              connect-src 'self' http://localhost:5125 ws://localhost:5125 https://raw.githubusercontent.com https://api.github.com;
            `
            : `
              default-src 'self';
              script-src 'self';
              style-src 'self' https://fonts.googleapis.com;
              style-src-elem 'self' https://fonts.googleapis.com;
              font-src 'self' https://fonts.gstatic.com;
              img-src 'self' data:;
              connect-src 'self';
            `,
        }
      }
    }),
  ],
  base: './',
  build: {
    outDir: 'dist-react',
    chunkSizeWarningLimit: 1000, // Increase from default 500KB to 1MB
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
      },
    },
  },
  server: {
    port: 5125,
    strictPort: true,
  },
})


// import { defineConfig } from 'vite';
// import react from '@vitejs/plugin-react';
// import { join } from 'path';

// export default defineConfig({
//   plugins: [react()],
//   build: {
//     outDir: 'dist-react',
//     emptyOutDir: true,
//   },
//   server: {
//     port: 5125,
//     strictPort: true,
//   },
//   resolve: {
//     alias: {
//       '@': join(__dirname, './src'),
//     },
//   },
// });