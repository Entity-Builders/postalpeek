import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

import { cloudflare } from '@cloudflare/vite-plugin';

// Resolve the absolute path to react-native-web to avoid duplicate module warnings
const rnwPath = path.resolve(__dirname, '../../node_modules/react-native-web');
const codegenStub = path.resolve(
  __dirname,
  'src/stubs/codegenNativeComponent.js',
);

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react(), tailwindcss(), cloudflare()],
    define: {
      'process.env.EXPO_PUBLIC_SUPABASE_URL': JSON.stringify(
        env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321',
      ),
      'process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY': JSON.stringify(
        env.VITE_SUPABASE_ANON_KEY ||
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
      ),
      __DEV__: mode !== 'production',
    },
    resolve: {
      dedupe: ['react', 'react-dom'],
      alias: [
        // Stub native-only deep imports BEFORE the general RNW alias
        {
          find: /^react-native\/Libraries\/.*/,
          replacement: codegenStub,
        },
        // General react-native → react-native-web (absolute path)
        {
          find: 'react-native',
          replacement: rnwPath,
        },
      ],
      extensions: ['.web.tsx', '.web.ts', '.web.js', '.tsx', '.ts', '.js'],
    },
    optimizeDeps: {
      exclude: ['@cloudflare/unenv-preset'],
      // Tell esbuild to also respect our aliasing during dep pre-bundling
      esbuildOptions: {
        resolveExtensions: [
          '.web.tsx',
          '.web.ts',
          '.web.js',
          '.tsx',
          '.ts',
          '.js',
        ],
        plugins: [
          {
            name: 'react-native-web-aliases',
            setup(build) {
              // Intercept any deep react-native/Libraries/* imports and resolve to stub
              build.onResolve(
                { filter: /^react-native\/Libraries\/.*/ },
                () => ({
                  path: codegenStub,
                }),
              );
              // Redirect react-native → react-native-web
              build.onResolve({ filter: /^react-native$/ }, () => ({
                path: path.resolve(rnwPath, 'dist/index.js'),
              }));
            },
          },
        ],
      },
    },
  };
});
