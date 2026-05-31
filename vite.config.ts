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
    server: {
      allowedHosts: true,
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return;

            // Heavy vendor groups — each gets its own chunk
            if (id.includes('framer-motion')) return 'vendor-motion';
            if (id.includes('embla-carousel')) return 'vendor-carousel';
            if (id.includes('@lottiefiles') || id.includes('dotlottie'))
              return 'vendor-lottie';
            if (id.includes('lucide-react')) return 'vendor-icons';
            if (id.includes('react-native-web')) return 'vendor-rnw';
            if (id.includes('@supabase') || id.includes('supabase-js'))
              return 'vendor-supabase';
            if (id.includes('posthog')) return 'vendor-analytics';

            // React core
            if (
              id.includes('/react/') ||
              id.includes('/react-dom/') ||
              id.includes('react-router') ||
              id.includes('scheduler')
            )
              return 'vendor-react';

            // Everything else from node_modules
            return 'vendor-misc';
          },
        },
      },
    },
    plugins: [react(), tailwindcss(), cloudflare()],
    define: {
      'process.env.EXPO_PUBLIC_SUPABASE_URL': JSON.stringify(
        env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321',
      ),
      'process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY': JSON.stringify(
        env.VITE_SUPABASE_ANON_KEY ||
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
      ),
      'process.env.VITE_SUPABASE_SCHEMA': JSON.stringify(env.VITE_SUPABASE_SCHEMA || 'postalpeek'),
      'process.env.EXPO_PUBLIC_SUPABASE_SCHEMA': JSON.stringify(env.VITE_SUPABASE_SCHEMA || 'postalpeek'),
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
        // Ignore RN-only analytics in web
        {
          find: 'posthog-react-native',
          replacement: codegenStub,
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
              // Ignore posthog-react-native
              build.onResolve({ filter: /^posthog-react-native$/ }, () => ({
                path: codegenStub,
              }));
            },
          },
        ],
      },
    },
  };
});
