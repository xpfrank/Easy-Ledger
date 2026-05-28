import {
  WebPlugin
} from "./chunk-6O6EI6JH.js";
import "./chunk-BUSYA2B4.js";

// node_modules/@capacitor/app/dist/esm/web.js
var AppWeb = class extends WebPlugin {
  constructor() {
    super();
    this.handleVisibilityChange = () => {
      const data = {
        isActive: document.hidden !== true
      };
      this.notifyListeners("appStateChange", data);
      if (document.hidden) {
        this.notifyListeners("pause", null);
      } else {
        this.notifyListeners("resume", null);
      }
    };
    document.addEventListener("visibilitychange", this.handleVisibilityChange, false);
  }
  exitApp() {
    throw this.unimplemented("Not implemented on web.");
  }
  async getInfo() {
    throw this.unimplemented("Not implemented on web.");
  }
  async getLaunchUrl() {
    return { url: "" };
  }
  async getState() {
    return { isActive: document.hidden !== true };
  }
  async minimizeApp() {
    throw this.unimplemented("Not implemented on web.");
  }
  async toggleBackButtonHandler() {
    throw this.unimplemented("Not implemented on web.");
  }
  async getAppLanguage() {
    return {
      value: navigator.language.split("-")[0].toLowerCase()
    };
  }
};
export {
  AppWeb
};
//# sourceMappingURL=web-Q4TDMFHQ.js.map
