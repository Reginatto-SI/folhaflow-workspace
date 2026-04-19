import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { createElement } from "react";
import { Button } from "@/components/ui/button";

// Intervalo de polling do version.json em ms.
const POLL_INTERVAL_MS = 60_000;
// Tempo de "soneca" caso o usuário clique em "Depois".
const SNOOZE_MS = 10 * 60_000;

/**
 * Hook que detecta novas versões do app comparando o __BUILD_ID__ em memória
 * com o buildId publicado em /version.json. Quando detecta divergência,
 * dispara um toast persistente com ações "Atualizar agora" / "Depois".
 *
 * "Atualizar agora" limpa Cache Storage e força reload — evita o problema
 * clássico de assets antigos cacheados após deploy.
 */
export function useVersionCheck() {
  const snoozedUntilRef = useRef<number>(0);
  const toastShownRef = useRef<boolean>(false);

  useEffect(() => {
    const currentBuildId = __BUILD_ID__;

    const checkVersion = async () => {
      // Respeita o "depois" do usuário.
      if (Date.now() < snoozedUntilRef.current) return;

      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as { buildId?: string; buildTime?: string };
        if (!data?.buildId) return;
        if (data.buildId === currentBuildId) return;
        if (toastShownRef.current) return;

        toastShownRef.current = true;
        const snooze = () => {
          snoozedUntilRef.current = Date.now() + SNOOZE_MS;
          toastShownRef.current = false;
        };

        toast.custom(
          (t) =>
            createElement(
              "div",
              {
                className:
                  "w-[380px] max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-background shadow-lg p-4 flex gap-3 items-start transition-shadow hover:shadow-xl",
              },
              createElement(
                "div",
                {
                  className:
                    "shrink-0 h-9 w-9 rounded-md bg-primary/10 text-primary flex items-center justify-center",
                },
                createElement(RefreshCw, { className: "h-[18px] w-[18px]" }),
              ),
              createElement(
                "div",
                { className: "flex-1 min-w-0" },
                createElement(
                  "p",
                  { className: "text-sm font-semibold text-foreground leading-tight" },
                  "Nova versão disponível",
                ),
                createElement(
                  "p",
                  { className: "text-xs text-muted-foreground mt-1 leading-snug" },
                  "Atualize para receber as últimas melhorias.",
                ),
                createElement(
                  "div",
                  { className: "flex gap-2 justify-end mt-3" },
                  createElement(
                    Button,
                    {
                      variant: "ghost",
                      size: "sm",
                      className: "h-8 px-3 text-xs",
                      onClick: () => {
                        snooze();
                        toast.dismiss(t);
                      },
                    },
                    "Depois",
                  ),
                  createElement(
                    Button,
                    {
                      variant: "default",
                      size: "sm",
                      className: "h-8 px-3 text-xs",
                      onClick: () => {
                        toast.dismiss(t);
                        void hardReload();
                      },
                    },
                    "Atualizar agora",
                  ),
                ),
              ),
            ),
          {
            duration: Infinity,
            onDismiss: snooze,
          },
        );
      } catch {
        // Falhas de rede são silenciadas — tenta de novo no próximo ciclo.
      }
    };

    // Primeira checagem com pequeno atraso para não competir com hidratação.
    const initial = window.setTimeout(checkVersion, 5_000);
    const interval = window.setInterval(checkVersion, POLL_INTERVAL_MS);

    // Verifica também quando a aba volta ao foco (caso comum: usuário ficou horas longe).
    const onFocus = () => void checkVersion();
    window.addEventListener("focus", onFocus);

    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, []);
}

/**
 * Limpa Cache Storage do navegador e força reload completo.
 * Usado pelo botão "Atualizar agora".
 */
async function hardReload() {
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    // Ignora — o reload abaixo ainda resolve a maioria dos casos.
  }
  // Marca para evitar piscar o toast no próximo load enquanto o SW propaga.
  try {
    sessionStorage.setItem("app:just-updated", "1");
  } catch {
    /* noop */
  }
  window.location.reload();
}
