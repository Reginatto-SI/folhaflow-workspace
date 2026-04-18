import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";

// Gera identificadores únicos por build.
// __BUILD_TIME__: ISO do momento do build (usado para exibir data/hora real)
// __BUILD_ID__: hash curto base36 do timestamp (usado como "commit lógico")
const BUILD_TIME = new Date().toISOString();
const BUILD_ID = Date.now().toString(36).slice(-6);

// Plugin inline: escreve public/version.json a cada build/dev start.
// O hook useVersionCheck faz polling deste arquivo para detectar deploys novos.
function versionJsonPlugin(): Plugin {
  const writeVersionFile = () => {
    try {
      const publicDir = path.resolve(__dirname, "public");
      if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
      fs.writeFileSync(
        path.join(publicDir, "version.json"),
        JSON.stringify({ buildId: BUILD_ID, buildTime: BUILD_TIME }, null, 2),
      );
    } catch (err) {
      console.warn("[version.json] falha ao escrever:", err);
    }
  };
  return {
    name: "version-json",
    buildStart() {
      writeVersionFile();
    },
    configureServer() {
      writeVersionFile();
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    versionJsonPlugin(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  define: {
    __BUILD_TIME__: JSON.stringify(BUILD_TIME),
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
