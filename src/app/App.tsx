import { BrowserRouter } from "react-router-dom";
import { AppRoutes } from "./router";
import { DemoStoreProvider } from "@/stores/DemoStore";
import AuthProvider from "@/features/auth/AuthProvider";

function App() {
  return (
    <DemoStoreProvider>
      <AuthProvider>
        <BrowserRouter basename={__BASE_PATH__}>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </DemoStoreProvider>
  );
}

export default App;
