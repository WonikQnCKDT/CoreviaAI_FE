import { BrowserRouter } from "react-router-dom";
import { AppRoutes } from "./router";
import { DemoStoreProvider } from "@/stores/DemoStore";
import AuthProvider from "@/features/auth/AuthProvider";
import I18nProvider from "./I18nProvider";

function App() {
  return (
    <DemoStoreProvider>
      <AuthProvider>
        <I18nProvider>
          <BrowserRouter basename={__BASE_PATH__}>
            <AppRoutes />
          </BrowserRouter>
        </I18nProvider>
      </AuthProvider>
    </DemoStoreProvider>
  );
}

export default App;
