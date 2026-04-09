import type { KrpanoViewer } from "./krpanoViewer";

export {};

declare global {
  interface Window {
    embedpano?: (opts: KrpanoEmbedOptions) => void;
    removepano?: (id: string | HTMLElement) => void;
    reactKrpano?: {
      onStart: () => void;
      /** Début de chargement d’une nouvelle scène (avant la fin du blend). */
      onSceneTransitionStart: () => void;
      onSceneChange: (sceneName: string) => void;
      onPanoLoadComplete: () => void;
      /** Entrée / sortie WebXR — `body.kr-vr-mode` + barre VR krpano (plugin webvr dans tour.xml). */
      onEnterVR: () => void;
      onExitVR: () => void;
      /** Hotspots barre VR bas (tour-vr-bottombar-generated.xml). */
      vrNavigateToScene: (sceneId: string) => void;
    };
  }
}

type KrpanoViewerApi = KrpanoViewer;

type KrpanoEmbedOptions = {
  xml: string;
  target: string;
  id?: string;
  html5?: "auto" | "only" | "prefer" | "always" | "fallback";
  /** Si true, les query params de la page peuvent écraser startscene (écran noir au reload). */
  passQueryParameters?: boolean;
  basepath?: string;
  consolelog?: boolean;
  /** Variables krpano avant parse du XML (ex. startscene). */
  initvars?: Record<string, string | number | boolean>;
  onready?: (krpano: KrpanoViewerApi) => void;
};
