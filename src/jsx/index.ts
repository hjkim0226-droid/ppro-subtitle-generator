// @include './lib/json2.js'

import { ns } from "../shared/shared";
import * as ppro from "./ppro/ppro";

//@ts-ignore
const host = typeof $ !== "undefined" ? $ : window;

// A safe way to get the app name
const getAppNameSafely = (): string => {
  const compare = (a: string, b: string) => {
    return a.toLowerCase().indexOf(b.toLowerCase()) > -1;
  };
  const exists = (a: any) => typeof a !== "undefined";
  const isBridgeTalkWorking =
    typeof BridgeTalk !== "undefined" &&
    typeof BridgeTalk.appName !== "undefined";

  if (isBridgeTalkWorking) {
    return BridgeTalk.appName;
  } else if (app) {
    //@ts-ignore
    if (exists(app.path)) {
      //@ts-ignore
      const path = app.path;
      if (compare(path, "premiere")) return "premierepro";
    }
  }
  return "unknown";
};

const appName = getAppNameSafely();
if (appName === "premierepro" || appName === "premiereprobeta") {
  host[ns] = ppro;
}

const empty = {};
export type Scripts = typeof empty & typeof ppro;
