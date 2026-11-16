import { BrowserRouter } from "react-router-dom";
import { AppRoutes } from "./router";
import { DemoStoreProvider } from "@/stores/DemoStore";

function App() {
  return (
    <DemoStoreProvider>
      <BrowserRouter basename={__BASE_PATH__}>
        <AppRoutes />
      </BrowserRouter>
    </DemoStoreProvider>
  );
}

export default App;
